import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "organizer", "exhibitor", "attendee"],
      default: "attendee",
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetRequestedAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, result) {
        delete result.password;
        delete result.tokenVersion;
        delete result.passwordResetToken;
        delete result.passwordResetExpires;
        delete result.passwordResetRequestedAt;
        delete result.__v;

        return result;
      },
    },
  }
);

export default mongoose.model("User", userSchema);