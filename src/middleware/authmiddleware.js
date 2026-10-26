import "dotenv/config";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/authmodel.js";

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("Set JWT_SECRET to a strong random value in Backend/.env");
}

export function createToken(user) {
  return jwt.sign(
    { version: user.tokenVersion || 0 },
    secret,
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      expiresIn: "1h",
      issuer: "eventsphere-api",
      audience: "eventsphere-web",
    }
  );
}

export async function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer (\S+)$/i);

  if (!match) {
    return res.status(401).json({
      msg: "Please log in to continue",
    });
  }

  let payload;

  try {
    payload = jwt.verify(match[1], secret, {
      algorithms: ["HS256"],
      issuer: "eventsphere-api",
      audience: "eventsphere-web",
    });

    if (
      typeof payload !== "object" ||
      !mongoose.isObjectIdOrHexString(payload.sub) ||
      !Number.isInteger(payload.version)
    ) {
      return res.status(401).json({
        msg: "Please log in again",
      });
    }
  } catch {
    return res.status(401).json({
      msg: "Your session is invalid or expired. Please log in again",
    });
  }

  try {
    const user = await User.findById(payload.sub);

    if (!user || payload.version !== user.tokenVersion) {
      return res.status(401).json({
        msg: "Please log in again",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        msg: "Please log in to continue",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        msg: "You do not have permission to perform this action",
      });
    }

    next();
  };
}