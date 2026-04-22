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
    aiAnalysis: {
      hasConflict: {
        type: Boolean,
        default: false,
      },
      severity: {
        type: String,
        enum: ['none', 'low', 'moderate', 'high', 'critical', 'unknown'],
        default: 'none',
      },
      analysis: {
        type: String,
        trim: true,
      },
      recommendations: [
        {
          type: String,
        },
      ],
      interactions: [
        {
          type: String,
        },
      ],
      checkedAt: {
        type: Date,
      },
      serviceAvailable: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ doctorId: 1 });
medicalRecordSchema.index({ hospitalId: 1 });
medicalRecordSchema.index({ visitDate: -1 });

export const MedicalRecord = model("MedicalRecord", medicalRecordSchema);
