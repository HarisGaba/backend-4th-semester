import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import User from "../models/authmodel.js";
import sendEmail from "../configs/mailerconfig.js";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyemail(req, res) {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return res.status(400).json({
        msg: "Enter a valid email address",
      });
    }

    if (
      !process.env.FRONTEND_URL ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      return res.status(503).json({
        msg: "Password recovery is not configured yet",
      });
    }

    const frontend = new URL(process.env.FRONTEND_URL);

    if (!["http:", "https:"].includes(frontend.protocol)) {
      return res.status(503).json({
        msg: "Password recovery is not configured correctly",
      });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const now = new Date();
    const cooldown = new Date(now.getTime() - 60000);

    const user = await User.findOneAndUpdate(
      {
        email,
        $or: [
          { passwordResetRequestedAt: { $exists: false } },
          { passwordResetRequestedAt: null },
          { passwordResetRequestedAt: { $lte: cooldown } },
        ],
      },
      {
        $set: {
          passwordResetToken: tokenHash,
          passwordResetExpires: new Date(
            now.getTime() + 15 * 60 * 1000
          ),
          passwordResetRequestedAt: now,
        },
      },
      { returnDocument: "after" }
    );

    if (user) {
      const link = new URL("/dashboard/reset", frontend.origin);
      link.searchParams.set("token", token);

      try {
        await sendEmail(
          user.email,
          "Reset your EventSphere password",
          `
            <h2>Reset your password</h2>
            <p>Use the link below to choose a new password.</p>
            <p><a href="${link.href}">Reset Password</a></p>
            <p>This link expires in 15 minutes and can only be used once.</p>
            <p>If you did not request this, ignore this email.</p>
          `,
          `Reset your EventSphere password: ${link.href}\n\nThis link expires in 15 minutes.`
        );
      } catch (error) {
        await User.updateOne(
          {
            _id: user._id,
            passwordResetToken: tokenHash,
          },
          {
            $unset: {
              passwordResetToken: "",
              passwordResetExpires: "",
            },
          }
        );

        console.error(
          "Password reset email failed:",
          error.code || "EMAIL_SEND_FAILED"
        );
      }
    }

    return res.status(200).json({
      msg: "If an eligible account exists, a reset link will be emailed. Check your inbox and spam folder",
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to process password recovery. Please try again",
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return res.status(400).json({
        msg: "Invalid reset link. Request a new one",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !/\S/.test(password)
    ) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and at most 72 bytes",
      });
    }

    const tokenHash = hashToken(token);

    const exists = await User.exists({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!exists) {
      return res.status(400).json({
        msg: "This reset link has expired or already been used",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.findOneAndUpdate(
      {
        passwordResetToken: tokenHash,
        passwordResetExpires: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
        },
        $inc: {
          tokenVersion: 1,
        },
        $unset: {
          passwordResetToken: "",
          passwordResetExpires: "",
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(400).json({
        msg: "This reset link has expired or already been used",
      });
    }

    return res.status(200).json({
      msg: "Password updated successfully. Please log in again",
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to reset password. Please try again",
    });
  }
}

export { verifyemail, resetPassword };