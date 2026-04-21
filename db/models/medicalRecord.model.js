import { model, Schema } from "mongoose";

const medicalRecordSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    diagnosis: {
      type: String,
      trim: true,
      required: true,
    },
    treatment: {
      type: String,
      trim: true,
    },
    medications: [
      {
        name: { type: String },
        dosage: { type: String },
        duration: { type: String },
      },
    ],
    visitDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const MedicalRecord = model("MedicalRecord", medicalRecordSchema);
