import bcrypt from "bcrypt";
import User from "../models/authmodel.js";
import { createToken } from "../middleware/authmiddleware.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "attendee",
  };
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    /\S/.test(password)
  );
}

export async function Register(req, res) {
  try {
    const { name, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    const role = req.body?.role ?? "attendee";

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      return res.status(400).json({
        msg: "Name must contain between 2 and 80 characters",
      });
    }

    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({ msg: "Enter a valid email address" });
    }

    if (!validPassword(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters and at most 72 bytes",
      });
    }

    if (!["attendee", "exhibitor"].includes(role)) {
      return res.status(400).json({
        msg: "Public signup is available for attendees and exhibitors",
      });
    }

    const existing = await User.exists({ email });

    if (existing) {
      return res.status(409).json({
        msg: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      role,
    });

    const token = createToken(user);

    return res.status(201).json({
      msg: "Account created successfully",
      token,
      data: safeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "An account with this email already exists",
      });
    }

    console.error("Registration failed:", error.name);

    return res.status(500).json({
      msg: "Unable to create account. Please try again",
    });
  }
}

export async function Login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (
      !emailPattern.test(email) ||
      email.length > 254 ||
      typeof password !== "string" ||
      !password ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        msg: "Enter a valid email and password",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        msg: "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      msg: "Logged in successfully",
      token,
      existingUser: safeUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error.name);

    return res.status(500).json({
      msg: "Unable to log in. Please try again",
    });
  }
}

export function getMe(req, res) {
  return res.status(200).json({ user: safeUser(req.user) });
}

export async function allUsers(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 20;

    const users = await User.find()
      .select("name email role createdAt")
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      msg: "Users retrieved successfully",
      allUsers: users,
      page,
      limit,
    });
  } catch {
    return res.status(500).json({ msg: "Unable to retrieve users" });
  }
}