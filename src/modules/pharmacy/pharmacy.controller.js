import { Patient, Hospital, MedicalRecord, PharmacyInventory, Prescription } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";
import { checkDrugConflict } from "../medicalRecord/aiConflictChecker.service.js";

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const findPatientByIdentifier = async (identifier) => {
    if (isValidObjectId(identifier)) {
        const byId = await Patient.findById(identifier);
        if (byId) return byId;
    }
    const byNationalId = await Patient.findOne({ nationalId: identifier });
    if (byNationalId) return byNationalId;
    return Patient.findOne({ cardId: identifier });
};

// ────────────────────────────────────────────────────────────
// INVENTORY
// ────────────────────────────────────────────────────────────

export const getInventory = async (req, res, next) => {
    const hospitalId = req.authUser.hospitalId;
    const { search } = req.query;

    const query = { hospitalId, isActive: true };
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    const items = await PharmacyInventory.find(query).sort({ name: 1 });

    return res.status(200).json({
        success: true,
        message: messages.inventory.fetchedSuccessfully,
        count: items.length,
        data: items,
    });
};

export const addInventoryItem = async (req, res, next) => {
    const hospitalId = req.authUser.hospitalId;
    const { name, genericName, dosageForms, quantityInStock, unit, manufacturer, expiryDate, lowStockThreshold, pricePerUnit } = req.body;

    // No duplicate drug name within the same hospital
    const duplicate = await PharmacyInventory.findOne({
        hospitalId,
        name: { $regex: `^${name.trim()}$`, $options: "i" },
        isActive: true,
    });
    if (duplicate) {
        return next(new AppError(messages.inventory.alreadyExist, 409));
    }

    const item = new PharmacyInventory({
        hospitalId,
        name,
        genericName,
        dosageForms,
        quantityInStock,
        unit,
        manufacturer,
        expiryDate,
        pricePerUnit: pricePerUnit ?? 0,
        lowStockThreshold,
        createdBy: req.authUser._id,
    });

    const saved = await item.save();

    return res.status(201).json({
        success: true,
        message: messages.inventory.created,
        data: saved,
    });
};

export const updateInventoryItem = async (req, res, next) => {
    const { id } = req.params;
    const hospitalId = req.authUser.hospitalId;

    const item = await PharmacyInventory.findById(id);
    if (!item) {
        return next(new AppError(messages.inventory.notExist, 404));
    }

    if (item.hospitalId.toString() !== hospitalId.toString()) {
        return next(new AppError(messages.user.unauthorized, 403));
    }

    const updatable = [
        "name", "genericName", "dosageForms", "quantityInStock",
        "unit", "manufacturer", "expiryDate", "pricePerUnit", "lowStockThreshold", "isActive",
    ];
    updatable.forEach((field) => {
        if (req.body[field] !== undefined) item[field] = req.body[field];
    });

    const updated = await item.save();

    return res.status(200).json({
        success: true,
        message: messages.inventory.updated,
        data: updated,
    });
};

export const getLowStockItems = async (req, res, next) => {
    const hospitalId = req.authUser.hospitalId;

    // Return items where current stock is below their own threshold
    const items = await PharmacyInventory.find({
        hospitalId,
        isActive: true,
        $expr: { $lt: ["$quantityInStock", "$lowStockThreshold"] },
    }).sort({ quantityInStock: 1 });

    return res.status(200).json({
        success: true,
        message: messages.inventory.lowStock,
        count: items.length,
        data: items,
    });
};

// ────────────────────────────────────────────────────────────
// PRESCRIPTIONS
// ────────────────────────────────────────────────────────────

export const createPrescription = async (req, res, next) => {
    const doctorId = req.authUser._id;
    const hospitalId = req.authUser.hospitalId;
    const { patientId, medications, notes } = req.body;

    // Validate patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
        return next(new AppError(messages.patient.notExist, 404));
    }

    // Validate hospital
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
        return next(new AppError(messages.hospital.notExist, 404));
    }

    // Auto-link medications to inventory by name when inventoryItemId is missing
    for (const med of medications) {
        if (!med.inventoryItemId && med.name?.trim()) {
            const match = await PharmacyInventory.findOne({
                hospitalId,
                isActive: true,
                $or: [
                    { name:        { $regex: `^${med.name.trim()}$`, $options: "i" } },
                    { genericName: { $regex: `^${med.name.trim()}$`, $options: "i" } },
                ],
            }).select("_id");
            if (match) med.inventoryItemId = match._id;
        }
    }

    // Validate every referenced inventory item exists and belongs to this hospital
    const inventoryIds = medications
        .filter((m) => m.inventoryItemId)
        .map((m) => m.inventoryItemId);

    if (inventoryIds.length > 0) {
        const found = await PharmacyInventory.find({
            _id: { $in: inventoryIds },
            hospitalId,
            isActive: true,
        }).select("_id");

        if (found.length !== inventoryIds.length) {
            const foundSet = new Set(found.map((i) => i._id.toString()));
            const missing = inventoryIds.filter((id) => !foundSet.has(id.toString()));
            return next(new AppError(`Drug(s) not found in hospital inventory: ${missing.join(", ")}`, 404));
        }
    }

    // ── DDI check ──────────────────────────────────────────
    let ddiResult = null;
    let ddiWarning = false;
    let ddiAlert = null;

    try {
        // Get patient's full medication history for context
        const existingRecords = await MedicalRecord.find({
            $or: [
                { patientId: patient._id },
                { patientId: patient._id.toString() },
            ],
        })
            .select("medications")
            .lean();

        const existingMeds = existingRecords.flatMap((r) => r.medications || []);
        const results = [];

        for (let i = 0; i < medications.length; i++) {
            const contextMeds = [...existingMeds, ...medications.slice(0, i)];
            const result = await checkDrugConflict(patient, contextMeds, medications[i]);
            results.push({
                medication: medications[i].name,
                severity: result.analysis?.severity ?? "unknown",
                hasConflict: result.analysis?.has_conflict ?? false,
                analysis: result.analysis?.analysis ?? "",
                recommendations: result.analysis?.recommendations ?? [],
                interactions: result.analysis?.interactions ?? [],
                serviceAvailable: result.success !== false,
            });

            const sev = result.analysis?.severity;
            if (sev === "critical" || sev === "high") {
                ddiAlert =
                    "One or more medications have a HIGH or CRITICAL drug interaction warning. Please review carefully before dispensing.";
            }
        }

        ddiResult = results;
    } catch (err) {
        console.error("DDI service unreachable during prescription creation:", err.message);
        ddiWarning = true;
    }

    // ── Save prescription ───────────────────────────────────
    const prescription = new Prescription({
        patientId,
        doctorId,
        hospitalId,
        medications,
        notes,
        status: "pending_pickup",
    });

    const saved = await prescription.save();
    if (!saved) {
        return next(new AppError(messages.prescription.failToCreate, 500));
    }

    return res.status(201).json({
        success: true,
        message: messages.prescription.created,
        data: saved,
        ddiResult,
        ddiWarning: ddiWarning || undefined,
        ddiAlert: ddiAlert || undefined,
    });
};

export const getPendingPrescriptionsByPatient = async (req, res, next) => {
    const { patientId } = req.params;
    const hospitalId = req.authUser.hospitalId;

    const patient = await findPatientByIdentifier(patientId);
    if (!patient) {
        return next(new AppError(messages.patient.notExist, 404));
    }

    const prescriptions = await Prescription.find({
        patientId: patient._id,
        hospitalId,
        status: "pending_pickup",
    })
        .populate("doctorId", "firstName lastName specialization")
        .populate("medications.inventoryItemId", "name genericName unit")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        message: messages.prescription.fetchedSuccessfully,
        count: prescriptions.length,
        data: prescriptions,
    });
};

export const dispensePrescription = async (req, res, next) => {
    const { id } = req.params;
    const pharmacistId = req.authUser._id;
    const hospitalId = req.authUser.hospitalId;

    // medicationQuantities: optional array of integers, one per prescription.medications entry.
    // Defaults to 1 for any item not provided.
    const medicationQuantities = Array.isArray(req.body.medicationQuantities)
        ? req.body.medicationQuantities
        : [];

    const prescription = await Prescription.findById(id);
    if (!prescription) {
        return next(new AppError(messages.prescription.notExist, 404));
    }

    // Hospital scope guard
    if (prescription.hospitalId.toString() !== hospitalId.toString()) {
        return next(new AppError(messages.user.unauthorized, 403));
    }

    if (prescription.status === "dispensed") {
        return next(new AppError(messages.prescription.alreadyDispensed, 400));
    }
    if (prescription.status === "cancelled") {
        return next(new AppError(messages.prescription.cancelled, 400));
    }

    // ── Build per-medication quantity map (index → qty) ──────
    const qtyForIndex = (i) => {
        const q = Number(medicationQuantities[i]);
        return Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
    };

    // ── Pre-check: ensure stock is sufficient for every item ─
    const medsWithInventory = prescription.medications
        .map((m, i) => ({ med: m, idx: i }))
        .filter(({ med }) => med.inventoryItemId);

    for (const { med, idx } of medsWithInventory) {
        const qty = qtyForIndex(idx);
        const item = await PharmacyInventory.findById(med.inventoryItemId).select("name quantityInStock unit");
        if (!item) {
            return next(new AppError(`Drug not found in inventory: ${med.name || med.inventoryItemId}`, 404));
        }
        if (item.quantityInStock < qty) {
            return next(
                new AppError(
                    `${messages.prescription.insufficientStock} "${item.name}": only ${item.quantityInStock} ${item.unit || "units"} available`,
                    400
                )
            );
        }
    }

    // ── Deduct stock atomically per item ────────────────────
    for (const { med, idx } of medsWithInventory) {
        const qty = qtyForIndex(idx);
        const result = await PharmacyInventory.findOneAndUpdate(
            { _id: med.inventoryItemId, quantityInStock: { $gte: qty } },
            { $inc: { quantityInStock: -qty } },
            { new: true }
        );
        // Concurrent race: another dispense reduced stock between our check and update
        if (!result) {
            return next(
                new AppError(
                    `${messages.prescription.insufficientStock} "${med.name}" (stock depleted by concurrent request)`,
                    400
                )
            );
        }
    }

    // ── Mark as dispensed ───────────────────────────────────
    prescription.status = "dispensed";
    prescription.dispensedBy = pharmacistId;
    prescription.dispensedAt = new Date();

    const updated = await prescription.save();

    return res.status(200).json({
        success: true,
        message: messages.prescription.dispensed,
        data: updated,
    });
};

export const getPrescriptionHistory = async (req, res, next) => {
    const { patientId } = req.params;
    const hospitalId = req.authUser.hospitalId;

    const patient = await findPatientByIdentifier(patientId);
    if (!patient) {
        return next(new AppError(messages.patient.notExist, 404));
    }

    const prescriptions = await Prescription.find({
        patientId: patient._id,
        hospitalId,
    })
        .populate("doctorId", "firstName lastName specialization")
        .populate("dispensedBy", "fullName email")
        .populate("medications.inventoryItemId", "name genericName unit")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        message: messages.prescription.fetchedSuccessfully,
        count: prescriptions.length,
        data: prescriptions,
    });
};
