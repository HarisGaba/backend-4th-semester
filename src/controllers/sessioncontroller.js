import mongoose from "mongoose";
import Session from "../models/sessionmodel.js";
import Event from "../models/eventmodel.js";
import Notification from "../models/notificationmodel.js";

function canManage(user, event) {
  return (
    user.role === "admin" ||
    (user.role === "organizer" &&
      event.organizer.toString() === user._id.toString())
  );
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function readSession(body = {}) {
  const limits = {
    title: 150,
    speaker: 100,
    topic: 200,
    location: 200,
  };

  const data = {};

  for (const field of Object.keys(limits)) {
    if (
      typeof body[field] !== "string" ||
      !body[field].trim() ||
      body[field].trim().length > limits[field]
    ) {
      return { error: `Enter a valid ${field}` };
    }

    data[field] = body[field].trim();
  }

  const description = body.description ?? "";

  if (
    typeof description !== "string" ||
    description.length > 3000
  ) {
    return {
      error: "Description must be at most 3000 characters",
    };
  }

  if (
    typeof body.startTime !== "string" ||
    typeof body.endTime !== "string" ||
    !/T.*(Z|[+-]\d{2}:\d{2})$/.test(body.startTime) ||
    !/T.*(Z|[+-]\d{2}:\d{2})$/.test(body.endTime)
  ) {
    return { error: "Enter valid start and end times" };
  }

  const startTime = new Date(body.startTime);
  const endTime = new Date(body.endTime);

  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime()) ||
    endTime <= startTime
  ) {
    return { error: "End time must be after start time" };
  }

  return {
    data: {
      ...data,
      description: description.trim(),
      startTime,
      endTime,
    },
  };
}

function publicSession(session) {
  const data = session.toObject();
  delete data.registeredUsers;
  delete data.bookmarkedBy;
  return data;
}

async function notifyAttendees(session, message, transaction) {
  const recipients = [
    ...new Set(
      [
        ...(session.registeredUsers || []),
        ...(session.bookmarkedBy || []),
      ].map((id) => id.toString())
    ),
  ];

  if (recipients.length === 0) return;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient,
      message,
      session: session._id,
    })),
    { session: transaction }
  );
}

async function createSession(req, res) {
  try {
    const eventId = req.body?.event;

    if (!mongoose.isObjectIdOrHexString(eventId)) {
      return res.status(400).json({
        msg: "Select a valid event",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (!canManage(req.user, event)) {
      return res.status(403).json({
        msg: "You can only create sessions for your own events",
      });
    }

    const result = readSession(req.body);

    if (result.error) {
      return res.status(400).json({ msg: result.error });
    }

    const session = await Session.create({
      ...result.data,
      event: event._id,
    });

    return res.status(201).json({
      msg: "Session created successfully",
      session: publicSession(session),
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to create session",
    });
  }
}

async function getEventSessions(req, res) {
  try {
    const { eventId } = req.params;

    if (!mongoose.isObjectIdOrHexString(eventId)) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const event = await Event.exists({ _id: eventId });

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const sessions = await Session.find({ event: eventId })
      .sort({ startTime: 1 });

    return res.status(200).json({ sessions });
  } catch {
    return res.status(500).json({
      msg: "Unable to load sessions",
    });
  }
}

async function manageSession(req, res, deleting) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ msg: "Invalid session ID" });
  }

  const result = deleting ? null : readSession(req.body);

  if (result?.error) {
    return res.status(400).json({ msg: result.error });
  }

  try {
    const updatedSession = await mongoose.connection.transaction(
      async (transaction) => {
        const session = await Session.findById(req.params.id)
          .select("+registeredUsers +bookmarkedBy")
          .session(transaction);

        if (!session) {
          fail(404, "Session not found");
        }

        const event = await Event.findById(session.event)
          .session(transaction);

        if (!event) {
          fail(404, "Event not found");
        }

        if (!canManage(req.user, event)) {
          fail(403, "You can only manage sessions for your own events");
        }

        if (deleting) {
          await session.deleteOne({ session: transaction });

          await notifyAttendees(
            session,
            `Session "${session.title}" at "${event.title}" has been cancelled.`,
            transaction
          );

          return null;
        }

        const changed = Object.entries(result.data).some(
          ([field, value]) =>
            value instanceof Date
              ? session[field]?.getTime() !== value.getTime()
              : session[field] !== value
        );

        if (changed) {
          const previousTitle = session.title;

          Object.assign(session, result.data);
          await session.save({ session: transaction });

          await notifyAttendees(
            session,
            `Session "${previousTitle}" at "${event.title}" has been updated. Open Sessions and load the latest schedule to check its details.`,
            transaction
          );
        }

        return publicSession(session);
      }
    );

    return res.status(200).json(
      deleting
        ? { msg: "Session deleted successfully" }
        : {
            msg: "Session updated successfully",
            session: updatedSession,
          }
    );
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        msg: error.message,
      });
    }

    console.error("Session change failed:", error.name);

    return res.status(500).json({
      msg: deleting
        ? "Unable to delete session"
        : "Unable to update session",
    });
  }
}

async function updateSession(req, res) {
  return manageSession(req, res, false);
}

async function deleteSession(req, res) {
  return manageSession(req, res, true);
}

export {
  createSession,
  getEventSessions,
  updateSession,
  deleteSession,
};