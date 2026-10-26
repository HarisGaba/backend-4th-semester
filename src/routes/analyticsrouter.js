import express from "express";
import { getExpoAnalytics } from "../controllers/analyticscontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const analyticsRouter = express.Router();

analyticsRouter.get(
  "/summary",
  authenticate,
  authorize("admin", "organizer"),
  getExpoAnalytics
);

export default analyticsRouter;