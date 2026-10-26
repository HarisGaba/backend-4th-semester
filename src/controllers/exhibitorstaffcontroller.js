import mongoose from "mongoose";
import Exhibitor from "../models/exhibitormodel.js";
import Event from "../models/eventmodel.js";

export async function getStaff(req, res) {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({
      msg: "Invalid application ID",
    });
  }

  try {
    const application = await Exhibitor.findById(id)
      .select("+staff");

    if (!application) {
      return res.status(404).json({
        msg: "Application not found",
      });
    }

    const owner =
      req.user.role === "exhibitor" &&
      application.contactPerson.toString() === req.user._id.toString();

    let permitted = owner || req.user.role === "admin";

    if (req.user.role === "organizer") {
      permitted = Boolean(
        await Event.exists({
          _id: application.event,
          organizer: req.user._id,
        })
      );
    }

    if (!permitted) {
      return res.status(403).json({
        msg: "You do not have access to this staff list",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      staff: application.staff || [],
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to load staff",
    });
  }
}

export async function updateStaff(req, res) {
  const { id } = req.params;
  const members = req.body?.staff;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({
      msg: "Invalid application ID",
    });
  }

  if (!Array.isArray(members) || members.length > 20) {
    return res.status(400).json({
      msg: "Provide a staff list with up to 20 members",
    });
  }

  const staff = [];

  for (const member of members) {
    if (
      !member ||
      typeof member.name !== "string" ||
      !member.name.trim() ||
      member.name.trim().length > 80 ||
      typeof member.duty !== "string" ||
      !member.duty.trim() ||
      member.duty.trim().length > 100
    ) {
      return res.status(400).json({
        msg: "Each staff member needs a valid name and duty",
      });
    }

    staff.push({
      name: member.name.trim(),
      duty: member.duty.trim(),
    });
  }

  try {
    const application = await Exhibitor.findOneAndUpdate(
      {
        _id: id,
        contactPerson: req.user._id,
        status: "Approved",
      },
      {
        $set: { staff },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).select("+staff");

    if (!application) {
      return res.status(403).json({
        msg: "You can only update staff for your own approved application",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      msg: "Staff list saved successfully",
      staff: application.staff,
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to save staff",
    });
  }
}