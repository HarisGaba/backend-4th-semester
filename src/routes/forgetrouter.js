import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  verifyemail,
  resetPassword,
} from "../controllers/forgetcontroller.js";

const forgetrouter = express.Router();

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many reset requests. Please try again later",
  },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many attempts. Please try again later",
  },
});

forgetrouter.post("/verifyemail", requestLimiter, verifyemail);
forgetrouter.post("/resetPassword", resetLimiter, resetPassword);

export default forgetrouter;