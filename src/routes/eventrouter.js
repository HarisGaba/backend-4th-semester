import express from "express";
import {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/eventcontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const eventRouter = express.Router();

eventRouter.get("/all", getEvents);
eventRouter.get("/:id", getEvent);

eventRouter.post(
  "/create",
  authenticate,
  authorize("admin", "organizer"),
  createEvent
);

eventRouter.put(
  "/update/:id",
  authenticate,
  authorize("admin", "organizer"),
  updateEvent
);

eventRouter.delete(
  "/delete/:id",
  authenticate,
  authorize("admin", "organizer"),
  deleteEvent
);

export default eventRouter;