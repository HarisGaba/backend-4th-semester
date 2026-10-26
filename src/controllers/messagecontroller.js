import mongoose from "mongoose";
import Message from "../models/messagemodel.js";
import Event from "../models/eventmodel.js";
import Attendee from "../models/attendeemodel.js";
import Exhibitor from "../models/exhibitormodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sendError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      msg: error.message,
    });
  }

  console.error("Messaging request failed:", error.name);

  return res.status(500).json({
    msg: "Unable to process messages. Please try again",
  });
}

async function checkConversation(user, eventId, participantId) {
  if (
    !mongoose.isObjectIdOrHexString(eventId) ||
    !mongoose.isObjectIdOrHexString(participantId)
  ) {
    fail(400, "Invalid event or participant ID");
  }

  const event = await Event.findById(eventId);

  if (!event) {
    fail(404, "Event not found");
  }

  const organizer =
    user.role === "organizer" &&
    event.organizer.toString() === user._id.toString();

  const participant =
    ["attendee", "exhibitor"].includes(user.role) &&
    user._id.toString() === participantId;

  if (!organizer && !participant) {
    fail(403, "You do not have access to this conversation");
  }

  const [registration, application] = await Promise.all([
    Attendee.exists({
      event: event._id,
      user: participantId,
    }),
    Exhibitor.exists({
      event: event._id,
      contactPerson: participantId,
    }),
  ]);

  if (!registration && !application) {
    fail(
      403,
      "The participant must have an event registration or exhibitor application"
    );
  }

  return event;
}

export async function getConversations(req, res) {
  try {
    let filter;

    if (req.user.role === "organizer") {
      const events = await Event.find({
        organizer: req.user._id,
      }).select("_id");

      filter = {
        event: { $in: events.map((event) => event._id) },
      };
    } else {
      filter = {
        participant: req.user._id,
      };
    }

    const results = await Message.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: {
            event: "$event",
            participant: "$participant",
          },
          lastMessage: { $first: "$text" },
          lastMessageAt: { $first: "$createdAt" },
          lastSender: { $first: "$sender" },
        },
      },
      { $sort: { lastMessageAt: -1, "_id.event": 1 } },
      { $limit: 50 },
    ]);

    const conversations = results.map((item) => ({
      event: item._id.event,
      participant: item._id.participant,
      lastMessage: item.lastMessage,
      lastMessageAt: item.lastMessageAt,
      lastSender: item.lastSender,
    }));

    await Message.populate(conversations, [
      { path: "event", select: "title organizer" },
      { path: "participant", select: "name role" },
      { path: "lastSender", select: "name role" },
    ]);

    const visible = conversations.filter(
      (item) => item.event && item.participant
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      conversations: visible,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMessages(req, res) {
  try {
    const { eventId, participantId } = req.params;
    const before = req.query.before;

    await checkConversation(req.user, eventId, participantId);

    const filter = {
      event: eventId,
      participant: participantId,
    };

    if (before !== undefined) {
      if (
        typeof before !== "string" ||
        !mongoose.isObjectIdOrHexString(before)
      ) {
        fail(400, "Invalid message cursor");
      }

      filter._id = { $lt: before };
    }

    const results = await Message.find(filter)
      .populate("sender", "name role")
      .sort({ _id: -1 })
      .limit(51)
      .lean();

    const hasMore = results.length > 50;
    const page = results.slice(0, 50);
    const nextBefore =
      hasMore && page.length ? page[page.length - 1]._id : null;

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      messages: page.reverse(),
      hasMore,
      nextBefore,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function sendMessage(req, res) {
  try {
    const { eventId, participantId } = req.params;
    const text = req.body?.text;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.trim().length > 2000
    ) {
      fail(400, "Enter a message between 1 and 2000 characters");
    }

    await checkConversation(req.user, eventId, participantId);

    const message = await Message.create({
      event: eventId,
      participant: participantId,
      sender: req.user._id,
      text: text.trim(),
    });

    await message.populate("sender", "name role");

    res.set("Cache-Control", "no-store");

    return res.status(201).json({
      msg: "Message sent",
      message,
    });
  } catch (error) {
    return sendError(res, error);
  }
}