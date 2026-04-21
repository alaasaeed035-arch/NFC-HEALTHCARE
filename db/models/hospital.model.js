import { model, Schema } from "mongoose";

const hospitalSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    address: {
      type: String,
      trim: true,
      required: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },
    hotline: {
      type: String,
      trim: true,
      required: true,
    },
    departments: [
      {
        name: { type: String, trim: true },
        floor: { type: String, trim: true },
      },
    ],
    licenseNumber: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Hospital = model("Hospital", hospitalSchema);
