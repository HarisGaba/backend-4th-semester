import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  registerExhibitor,
  getExhibitors,
} from "../controllers/exhibitorcontroller.js";
import {
  updateApplicationStatus,
} from "../controllers/exhibitorstatuscontroller.js";
import {
  updateProfile,
  searchProfiles,
} from "../controllers/exhibitorprofilecontroller.js";
import {
  getStaff,
  updateStaff,
} from "../controllers/exhibitorstaffcontroller.js";
import {
  getServiceRequests,
  createServiceRequest,
  updateServiceRequest,
} from "../controllers/servicerequestcontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const exhibitorRouter = express.Router();

const serviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many service requests. Please try again later",
  },
});

exhibitorRouter.get("/search", searchProfiles);

exhibitorRouter.post(
  "/register",
  authenticate,
  authorize("exhibitor"),
  registerExhibitor
);

exhibitorRouter.get(
  "/all",
  authenticate,
  authorize("admin", "organizer", "exhibitor"),
  getExhibitors
);

exhibitorRouter.get(
  "/staff/:id",
  authenticate,
  authorize("admin", "organizer", "exhibitor"),
  getStaff
);

exhibitorRouter.put(
  "/staff/:id",
  authenticate,
  authorize("exhibitor"),
  updateStaff
);

exhibitorRouter.get(
  "/services/:id",
  authenticate,
  authorize("admin", "organizer", "exhibitor"),
  getServiceRequests
);

exhibitorRouter.post(
  "/services/:id",
  authenticate,
  authorize("exhibitor"),
  serviceLimiter,
  createServiceRequest
);

exhibitorRouter.put(
  "/service-requests/:requestId/status",
  authenticate,
  authorize("admin", "organizer"),
  updateServiceRequest
);

exhibitorRouter.put(
  "/profile/:id",
  authenticate,
  authorize("exhibitor"),
  updateProfile
);

exhibitorRouter.put(
  "/status/:id",
  authenticate,
  authorize("admin", "organizer"),
  updateApplicationStatus
);

export default exhibitorRouter;