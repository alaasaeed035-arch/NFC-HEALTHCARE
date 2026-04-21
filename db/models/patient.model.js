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
    cardId: {
      type: String,
      unique: true,
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
  },
  { timestamps: true }
);

// model
export const Patient = model("Patient", patientSchema);
