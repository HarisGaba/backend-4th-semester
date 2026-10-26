import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    duty: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

const exhibitorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    products: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    contactPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    boothNumber: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    staff: {
      type: [staffSchema],
      default: [],
      select: false,
      validate: {
        validator: (members) => members.length <= 20,
        message: "You can add up to 20 staff members",
      },
    },
  },
  { timestamps: true }
);

exhibitorSchema.index(
  { contactPerson: 1, event: 1 },
  { unique: true }
);

export default mongoose.model("Exhibitor", exhibitorSchema);