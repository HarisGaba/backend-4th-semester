import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/authrouter.js";
import forgetRouter from "./routes/forgetrouter.js";
import eventRouter from "./routes/eventrouter.js";
import exhibitorRouter from "./routes/exhibitorrouter.js";
import attendeeRouter from "./routes/attendeerouter.js";
import notificationRouter from "./routes/notificationrouter.js";
import sessionRouter from "./routes/sessionrouter.js";
import analyticsRouter from "./routes/analyticsrouter.js";
import feedbackRouter from "./routes/feedbackrouter.js";
import boothRouter from "./routes/boothrouter.js";
import exhibitorFileRouter from "./routes/exhibitorfilerouter.js";
import messageRouter from "./routes/messagerouter.js";
import mongoose from "mongoose";
import { announceChanges, streamUpdates } from "./services/liveupdates.js";
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  const started = performance.now();
  res.once('finish', () => {
    if (process.env.NODE_ENV !== 'test') console.info(JSON.stringify({
      method: req.method,
      route: req.route?.path || 'unmatched',
      status: res.statusCode,
      durationMs: Math.round(performance.now() - started)
    }));
  });
  next();
});
app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'database-unavailable'
  });
});
app.get('/updates', streamUpdates);
app.use(announceChanges);
app.use(express.json({
  limit: "100kb"
}));
app.use("/auth", authRouter);
app.use("/forget", forgetRouter);
app.use("/events", eventRouter);
app.use("/exhibitors", exhibitorRouter);
app.use("/attendees", attendeeRouter);
app.use("/notifications", notificationRouter);
app.use("/sessions", sessionRouter);
app.use("/analytics", analyticsRouter);
app.use("/feedback", feedbackRouter);
app.use("/booths", boothRouter);
app.use("/exhibitor-files", exhibitorFileRouter);
app.use("/messages", messageRouter);
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      msg: "Invalid JSON request"
    });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      msg: "Request is too large"
    });
  }
  console.error("Request failed:", error.name);
  return res.status(500).json({
    msg: "Something went wrong. Please try again"
  });
});
export default app;
