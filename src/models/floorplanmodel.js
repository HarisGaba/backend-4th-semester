import mongoose from "mongoose";

const placementSchema = new mongoose.Schema(
  {
    booth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booth",
      required: true,
    },
    row: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: Number.isInteger,
    },
    column: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: Number.isInteger,
    },
  },
  { _id: false }
);

const floorPlanSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
    },
    rows: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: Number.isInteger,
    },
    columns: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: Number.isInteger,
    },
    placements: {
      type: [placementSchema],
      default: [],
      validate: {
        validator: (items) => items.length <= 400,
        message: "A floor plan can contain up to 400 booths",
      },
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("FloorPlan", floorPlanSchema);