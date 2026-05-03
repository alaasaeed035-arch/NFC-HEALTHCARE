import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    getLowStockItems,
    createPrescription,
    getPendingPrescriptionsByPatient,
    dispensePrescription,
    getPrescriptionHistory,
} from "./pharmacy.controller.js";

const pharmacyRouter = Router();

// ────────────────────────────────────────────────────────────
// INVENTORY
// ────────────────────────────────────────────────────────────

pharmacyRouter.get(
    "/inventory",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.ADMIN_HOSPITAL, roles.DOCTOR]),
    asyncHandler(getInventory)
);

pharmacyRouter.post(
    "/inventory",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.ADMIN_HOSPITAL]),
    asyncHandler(addInventoryItem)
);

// NOTE: /inventory/low-stock MUST be declared before /inventory/:id
// so Express does not treat the literal string "low-stock" as an :id param.
pharmacyRouter.get(
    "/inventory/low-stock",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.ADMIN_HOSPITAL]),
    asyncHandler(getLowStockItems)
);

pharmacyRouter.patch(
    "/inventory/:id",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.ADMIN_HOSPITAL]),
    asyncHandler(updateInventoryItem)
);

// ────────────────────────────────────────────────────────────
// PRESCRIPTIONS
// ────────────────────────────────────────────────────────────

// Specific named sub-paths before the generic /:id/dispense
pharmacyRouter.get(
    "/prescriptions/patient/:patientId",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.DOCTOR]),
    asyncHandler(getPendingPrescriptionsByPatient)
);

pharmacyRouter.get(
    "/prescriptions/history/:patientId",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST, roles.DOCTOR]),
    asyncHandler(getPrescriptionHistory)
);

pharmacyRouter.post(
    "/prescriptions",
    isAuthenticated(),
    isAuthorized([roles.DOCTOR]),
    asyncHandler(createPrescription)
);

pharmacyRouter.patch(
    "/prescriptions/:id/dispense",
    isAuthenticated(),
    isAuthorized([roles.PHARMACIST]),
    asyncHandler(dispensePrescription)
);

export default pharmacyRouter;
