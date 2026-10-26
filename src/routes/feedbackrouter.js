import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  submitFeedback,
  getFeedbacks,
  updateFeedback,
} from "../controllers/feedbackcontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const feedbackRouter = express.Router();

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many submissions. Please try again later",
  },
});

feedbackRouter.use(authenticate);

feedbackRouter.post("/submit", feedbackLimiter, submitFeedback);
feedbackRouter.get("/all", getFeedbacks);

feedbackRouter.put(
  "/update/:id",
  authorize("admin", "organizer"),
  updateFeedback
);

export default feedbackRouter;