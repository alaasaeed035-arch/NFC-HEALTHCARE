import { model, Schema } from "mongoose";

const conflictAnalysisSchema = new Schema(
  {
    patient_id: {
      type: String,
      required: true,
    },
    patient_name: {
      type: String,
    },
    patient_age: {
      type: Number,
    },
    doctor_id: {
      type: String,
    },
    record_id: {
      type: String,
    },
    new_treatment: {
      name: String,
      dosage: String,
      frequency: String,
      notes: String,
    },
    current_medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        notes: String,
      },
    ],
    analysis: {
      has_conflict: {
        type: Boolean,
        default: false,
      },
      severity: {
        type: String,
        enum: ["none", "low", "moderate", "high", "critical", "unknown"],
        default: "none",
      },
      analysis: {
        type: String,
        trim: true,
      },
      recommendations: [{ type: String }],
      interactions: [{ type: String }],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { strict: false, collection: "conflict_analyses" }
);

conflictAnalysisSchema.index({ patient_id: 1 });
conflictAnalysisSchema.index({ doctor_id: 1 });
conflictAnalysisSchema.index({ record_id: 1 });
conflictAnalysisSchema.index({ created_at: -1 });
conflictAnalysisSchema.index({ "analysis.severity": 1 });

export const ConflictAnalysis = model("ConflictAnalysis", conflictAnalysisSchema);
