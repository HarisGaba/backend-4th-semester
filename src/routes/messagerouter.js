import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  getConversations,
  getMessages,
  sendMessage,
} from "../controllers/messagecontroller.js";
import {
  authenticate,
  authorize,
} from "../middleware/authmiddleware.js";

const messageRouter = express.Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many messages. Please wait a minute",
  },
});

messageRouter.use(
  authenticate,
  authorize("organizer", "attendee", "exhibitor")
);

messageRouter.get("/conversations", getConversations);

messageRouter.get(
  "/thread/:eventId/:participantId",
  getMessages
);

messageRouter.post(
  "/thread/:eventId/:participantId",
  messageLimiter,
  sendMessage
);

export default messageRouter;