import { model, Schema } from "mongoose";

const patientChatLogSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    sessionId: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    response: {
      type: String,
      trim: true,
    },
    conversation_history: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
      },
    ],
    serviceAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, collection: "patient_chat_logs" }
);

patientChatLogSchema.index({ patientId: 1 });
patientChatLogSchema.index({ sessionId: 1 });
patientChatLogSchema.index({ createdAt: -1 });

export const PatientChatLog = model("PatientChatLog", patientChatLogSchema);
