import Session from "../models/sessionmodel.js";
import Notification from "../models/notificationmodel.js";

let running = false;
let timer;

async function checkReminders() {
  if (running) return;

  running = true;

  try {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + 15 * 60 * 1000);

    const sessions = Session.find({
      startTime: {
        $gt: now,
        $lte: reminderWindow,
      },
      "bookmarkedBy.0": { $exists: true },
    })
      .select("title event startTime +bookmarkedBy")
      .populate("event", "title")
      .cursor();

    for await (const session of sessions) {
      if (!session.event) continue;
      if (session.startTime.getTime() <= Date.now()) continue;

      for (const userId of session.bookmarkedBy) {
        const reminderKey = [
          session._id.toString(),
          session.startTime.toISOString(),
          userId.toString(),
        ].join(":");

        try {
          await Notification.updateOne(
            { reminderKey },
            {
              $setOnInsert: {
                recipient: userId,
                message: `${session.title} at ${session.event.title} will start soon.`,
                session: session._id,
                startTime: session.startTime,
                read: false,
                reminderKey,
              },
            },
            { upsert: true }
          );
        } catch (error) {
          if (error.code !== 11000) {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    console.error("Session reminder check failed:", error.message);
  } finally {
    running = false;
  }
}

export function startSessionReminders() {
  if (timer) return;

  checkReminders();

  timer = setInterval(checkReminders, 30000);
  timer.unref();
}