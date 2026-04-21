import { model, Schema } from "mongoose";
import { roles } from "../../src/utils/constant/enum.js";

const doctorSchema = new Schema(
  {
    firstName: {
      type: String,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
      required: true,
    },
    specialization: {
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
    password: {
      type: String, 
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: Object.values(roles),
     },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    // licenseNumber: {
    //   type: String,
    //   trim: true,
    //   unique: true,
    //   required: true,
    // },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: String,
    otpExpires: String,
    patients: [{ type: Schema.Types.ObjectId, ref: "Patient" }],

  },
  { timestamps: true }
);

export const Doctor = model("Doctor", doctorSchema);
