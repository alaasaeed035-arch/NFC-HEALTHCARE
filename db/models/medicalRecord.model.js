import { model, Schema } from "mongoose";

const medicalRecordSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.Mixed, // Accept both ObjectId and String (legacy records)
      ref: "Patient",
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
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
  { timestamps: true, strict: false }
);

medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ doctorId: 1 });
medicalRecordSchema.index({ hospitalId: 1 });
medicalRecordSchema.index({ visitDate: -1 });

export const MedicalRecord = model("MedicalRecord", medicalRecordSchema);
