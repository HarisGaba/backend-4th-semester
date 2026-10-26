import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  Login,
  Register,
  getMe,
  allUsers,
} from "../controllers/authcontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    msg: "Too many login attempts. Please try again after 15 minutes",
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many signup attempts. Please try again later",
  },
});

authRouter.post("/login", loginLimiter, Login);
authRouter.post("/register", signupLimiter, Register);

authRouter.get("/me", authenticate, getMe);
authRouter.get("/allusers", authenticate, authorize("admin"), allUsers);

export default authRouter;