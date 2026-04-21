import { model, Schema } from "mongoose";
import { roles } from "../../src/utils/constant/enum.js";

// schema
const userSchema = new Schema(
  {
    fullName: {
      type: String, // used as username for login
      trim: true,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String, // auto-generated and hashed
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: Object.values(roles),
      required: true,
    },
    // if doctor
    specialization: {
      type: String,
      trim: true,
    },
    // licenseNumber: {
    //   type: String,
    //   trim: true,
    //   unique: true,
    //   sparse: true, // only for doctors
    // },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
    },
    // if hospital
    address: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// model
export const User = model("User", userSchema);
