import express from "express";
import {
  registerAttendee,
  getAttendees,
} from "../controllers/attendeecontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const attendeeRouter = express.Router();

attendeeRouter.post(
  "/register",
  authenticate,
  authorize("attendee"),
  registerAttendee
);

attendeeRouter.get(
  "/all",
  authenticate,
  authorize("admin", "organizer", "attendee"),
  getAttendees
);

export default attendeeRouter;