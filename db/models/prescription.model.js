import { model, Schema } from "mongoose";

const prescriptionSchema = new Schema(
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
        medications: [
            {
                inventoryItemId: {
                    type: Schema.Types.ObjectId,
                    ref: "PharmacyInventory",
                },
                name: { type: String },
                dosage: { type: String },
                frequency: { type: String },
                duration: { type: String },
            },
        ],
        status: {
            type: String,
            enum: ["pending_pickup", "dispensed", "cancelled"],
            default: "pending_pickup",
        },
        dispensedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        dispensedAt: {
            type: Date,
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

prescriptionSchema.index({ patientId: 1, status: 1 });
prescriptionSchema.index({ hospitalId: 1, status: 1 });
prescriptionSchema.index({ doctorId: 1 });

export const Prescription = model("Prescription", prescriptionSchema);
