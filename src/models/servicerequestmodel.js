import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    exhibitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exhibitor",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    service: {
      type: String,
      enum: ["Electricity", "Internet", "Furniture", "Cleaning", "Other"],
      required: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Fulfilled"],
      default: "Pending",
    },
    reply: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ exhibitor: 1, createdAt: -1 });
serviceRequestSchema.index({ event: 1, status: 1 });

export default mongoose.model("ServiceRequest", serviceRequestSchema);