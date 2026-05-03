import { model, Schema } from "mongoose";

const pharmacyInventorySchema = new Schema(
    {
        hospitalId: {
            type: Schema.Types.ObjectId,
            ref: "Hospital",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        genericName: {
            type: String,
            trim: true,
        },
        dosageForms: [{ type: String }],
        quantityInStock: {
            type: Number,
            required: true,
            min: 0,
        },
        unit: {
            type: String,
            trim: true,
        },
        manufacturer: {
            type: String,
            trim: true,
        },
        expiryDate: {
            type: Date,
        },
        pricePerUnit: {
            type: Number,
            min: 0,
            default: 0,
        },
        lowStockThreshold: {
            type: Number,
            default: 10,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

pharmacyInventorySchema.index({ hospitalId: 1, name: 1 });
pharmacyInventorySchema.index({ hospitalId: 1, isActive: 1 });

export const PharmacyInventory = model("PharmacyInventory", pharmacyInventorySchema);
