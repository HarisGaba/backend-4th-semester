import mongoose from "mongoose";
import Exhibitor from "../models/exhibitormodel.js";

const publicFields = [
  "companyName",
  "category",
  "description",
  "products",
  "contactEmail",
  "phone",
  "website",
  "event",
  "boothNumber",
  "status",
].join(" ");

async function updateProfile(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ msg: "Invalid profile ID" });
    }

    const limits = {
      companyName: 150,
      category: 100,
      description: 2000,
      products: 2000,
      contactEmail: 254,
      phone: 30,
      website: 300,
    };

    const requiredFields = [
      "companyName",
      "category",
      "description",
    ];

    const data = {};

    for (const field of Object.keys(limits)) {
      const value = body[field] ?? "";

      if (
        typeof value !== "string" ||
        value.trim().length > limits[field] ||
        (requiredFields.includes(field) && !value.trim())
      ) {
        return res.status(400).json({
          msg: `Enter a valid ${field}`,
        });
      }

      data[field] = value.trim();
    }

    data.contactEmail = data.contactEmail.toLowerCase();

    if (
      data.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)
    ) {
      return res.status(400).json({
        msg: "Enter a valid public contact email",
      });
    }

    if (
      data.phone &&
      !/^\+?[0-9 ()-]{7,30}$/.test(data.phone)
    ) {
      return res.status(400).json({
        msg: "Enter a valid contact phone number",
      });
    }

    if (data.website) {
      let website;

      try {
        website = new URL(data.website);
      } catch {
        return res.status(400).json({
          msg: "Enter a full website address, such as https://example.com",
        });
      }

      if (
        !["https:", "http:"].includes(website.protocol) ||
        website.username ||
        website.password
      ) {
        return res.status(400).json({
          msg: "Enter a valid HTTP or HTTPS website address",
        });
      }
    }

    const exhibitor = await Exhibitor.findOneAndUpdate(
      {
        _id: id,
        contactPerson: req.user._id,
      },
      { $set: data },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).populate("event", "title");

    if (!exhibitor) {
      return res.status(404).json({
        msg: "Profile not found or it does not belong to your account",
      });
    }

    return res.status(200).json({
      msg: "Company profile updated successfully",
      exhibitor,
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to update company profile",
    });
  }
}

async function searchProfiles(req, res) {
  try {
    const {
      keyword = "",
      category = "",
      eventId = "",
    } = req.query;

    if (
      typeof keyword !== "string" ||
      typeof category !== "string" ||
      typeof eventId !== "string" ||
      keyword.length > 100 ||
      category.length > 100 ||
      (eventId && !mongoose.isObjectIdOrHexString(eventId))
    ) {
      return res.status(400).json({
        msg: "Invalid search filters",
      });
    }

    const filter = { status: "Approved" };

    function escapeSearch(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    if (keyword.trim()) {
      const search = {
        $regex: escapeSearch(keyword.trim()),
        $options: "i",
      };

      filter.$or = [
        { companyName: search },
        { category: search },
        { description: search },
        { products: search },
      ];
    }

    if (category.trim()) {
      filter.category = {
        $regex: escapeSearch(category.trim()),
        $options: "i",
      };
    }

    if (eventId) {
      filter.event = eventId;
    }

    const exhibitors = await Exhibitor.find(filter)
      .select(publicFields)
      .populate("event", "title")
      .sort({ companyName: 1 })
      .limit(100);

    return res.status(200).json({ exhibitors });
  } catch {
    return res.status(500).json({
      msg: "Unable to search company profiles",
    });
  }
}

export { updateProfile, searchProfiles };