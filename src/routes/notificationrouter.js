import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationcontroller.js";
import { authenticate } from "../middleware/authmiddleware.js";

const notificationRouter = express.Router();

notificationRouter.use(authenticate);

notificationRouter.get("/mine", getNotifications);
notificationRouter.patch("/read-all", markAllAsRead);
notificationRouter.patch("/:id/read", markAsRead);

export default notificationRouter;