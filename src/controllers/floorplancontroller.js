import mongoose from "mongoose";
import FloorPlan from "../models/floorplanmodel.js";
import Event from "../models/eventmodel.js";
import Booth from "../models/boothmodel.js";

export async function getFloorPlan(req, res) {
  const { eventId } = req.params;

  if (!mongoose.isObjectIdOrHexString(eventId)) {
    return res.status(400).json({ msg: "Invalid event ID" });
  }

  try {
    const event = await Event.exists({ _id: eventId });

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const saved = await FloorPlan.findOne({ event: eventId })
      .select("rows columns placements revision -_id")
      .lean();

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      layout: saved || {
        rows: 8,
        columns: 8,
        placements: [],
        revision: 0,
      },
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to load floor plan",
    });
  }
}

export async function saveFloorPlan(req, res) {
  const { eventId } = req.params;
  const { rows, columns, placements, revision } = req.body || {};

  if (!mongoose.isObjectIdOrHexString(eventId)) {
    return res.status(400).json({ msg: "Invalid event ID" });
  }

  if (
    !Number.isInteger(rows) ||
    rows < 1 ||
    rows > 20 ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 20 ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision === Number.MAX_SAFE_INTEGER ||
    !Array.isArray(placements) ||
    placements.length > rows * columns
  ) {
    return res.status(400).json({
      msg: "Provide a valid grid, placements and layout revision",
    });
  }

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const canManage =
      req.user.role === "admin" ||
      (req.user.role === "organizer" &&
        event.organizer.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({
        msg: "You can only edit floor plans for your own events",
      });
    }

    const boothIds = new Set();
    const occupiedCells = new Set();
    const cleaned = [];

    for (const item of placements) {
      if (
        !item ||
        typeof item.booth !== "string" ||
        !mongoose.isObjectIdOrHexString(item.booth) ||
        !Number.isInteger(item.row) ||
        item.row < 1 ||
        item.row > rows ||
        !Number.isInteger(item.column) ||
        item.column < 1 ||
        item.column > columns
      ) {
        return res.status(400).json({
          msg: "Each booth needs a valid position inside the grid",
        });
      }

      const boothId = item.booth.toLowerCase();
      const cell = `${item.row}:${item.column}`;

      if (boothIds.has(boothId) || occupiedCells.has(cell)) {
        return res.status(400).json({
          msg: "A booth or grid position cannot be used twice",
        });
      }

      boothIds.add(boothId);
      occupiedCells.add(cell);

      cleaned.push({
        booth: boothId,
        row: item.row,
        column: item.column,
      });
    }

    const matchingBooths = await Booth.countDocuments({
      event: event._id,
      _id: { $in: [...boothIds] },
    });

    if (matchingBooths !== boothIds.size) {
      return res.status(400).json({
        msg: "All placed booths must belong to this event",
      });
    }

    await FloorPlan.init();

    const layout = await FloorPlan.findOneAndUpdate(
      {
        event: event._id,
        revision,
      },
      {
        $set: {
          rows,
          columns,
          placements: cleaned,
        },
        $inc: { revision: 1 },
      },
      {
        upsert: revision === 0,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: false,
      }
    ).select("rows columns placements revision -_id");

    if (!layout) {
      return res.status(409).json({
        msg: "The floor plan changed. Reload it before saving again",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      msg: "Floor plan saved successfully",
      layout,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "The floor plan changed. Reload it before saving again",
      });
    }

    console.error("Floor plan save failed:", error.name);

    return res.status(500).json({
      msg: "Unable to save floor plan",
    });
  }
}