import express from "express";
import {
  createSession,
  getEventSessions,
  updateSession,
  deleteSession,
} from "../controllers/sessioncontroller.js";
import {
  getSessionActivity,
  updateSessionActivity,
} from "../controllers/sessionactivitycontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const sessionRouter = express.Router();

sessionRouter.get("/event/:eventId", getEventSessions);

sessionRouter.get(
  "/:id/activity",
  authenticate,
  authorize("attendee"),
  getSessionActivity
);

sessionRouter.put(
  "/:id/activity",
  authenticate,
  authorize("attendee"),
  updateSessionActivity
);

sessionRouter.post(
  "/create",
  authenticate,
  authorize("admin", "organizer"),
  createSession
);

sessionRouter.put(
  "/update/:id",
  authenticate,
  authorize("admin", "organizer"),
  updateSession
);

sessionRouter.delete(
  "/delete/:id",
  authenticate,
  authorize("admin", "organizer"),
  deleteSession
);

export default sessionRouter;