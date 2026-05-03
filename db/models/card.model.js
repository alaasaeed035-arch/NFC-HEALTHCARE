import { model, Schema } from "mongoose";

const cardSchema = new Schema(
  {
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nfcUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    isLinked: {
      type: Boolean,
      default: false,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },
  },
  { timestamps: true }
);

export const Card = model("Card", cardSchema);
