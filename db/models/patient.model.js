import { model, Schema } from "mongoose";
import { bloodTypes, genderTypes, roles } from "../../src/utils/constant/enum.js";

// schema
const patientSchema = new Schema(
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
    nationalId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    gender: {
      type: String,
      enum: Object.values(genderTypes),
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    bloodType: {
      type: String,
      enum: Object.values(bloodTypes),
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    cardId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
    },
    surgerys: {
      type: [String],
      default: [],
    },

    ChronicDiseases: {
      type: [String],
      default: [],
    },
    role: {
      type: String,
      enum: Object.values(roles),
      default: roles.PATIENT,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// model
export const Patient = model("Patient", patientSchema);
