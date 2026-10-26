import express from "express";
import {
  createBooth,
  getEventBooths,
  reserveBooth,
} from "../controllers/boothcontroller.js";
import {
  cancelBoothReservation,
} from "../controllers/boothcancellationcontroller.js";
import {
  assignBooth,
} from "../controllers/boothassignmentcontroller.js";
import {
  getMyVisits,
  recordVisit,
} from "../controllers/boothvisitcontroller.js";
import {
  getFloorPlan,
  saveFloorPlan,
} from "../controllers/floorplancontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const boothRouter = express.Router();

boothRouter.get("/event/:eventId", getEventBooths);

boothRouter.get("/layout/:eventId", getFloorPlan);

boothRouter.put(
  "/layout/:eventId",
  authenticate,
  authorize("admin", "organizer"),
  saveFloorPlan
);

boothRouter.get(
  "/visits/mine",
  authenticate,
  authorize("attendee"),
  getMyVisits
);

boothRouter.post(
  "/visit",
  authenticate,
  authorize("attendee"),
  recordVisit
);

boothRouter.post(
  "/create",
  authenticate,
  authorize("admin", "organizer"),
  createBooth
);

boothRouter.post(
  "/reserve",
  authenticate,
  authorize("exhibitor"),
  reserveBooth
);

boothRouter.post(
  "/cancel",
  authenticate,
  authorize("exhibitor"),
  cancelBoothReservation
);

boothRouter.post(
  "/assign",
  authenticate,
  authorize("admin", "organizer"),
  assignBooth
);

export default boothRouter;