import { Router } from 'express';
import mongoose from 'mongoose';
import { isAuthenticated } from '../../middleware/authentication.js';
import { isAuthorized } from '../../middleware/autheraization.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError } from '../../utils/appError.js';
import { roles } from '../../utils/constant/enum.js';
import { ConflictAnalysis, Patient } from '../../../db/index.js';

const ddiRouter = Router();

/**
 * Resolve patient_id from a raw conflict_analyses document.
 * Handles both our Node.js format (top-level patient_id string)
 * and the Python service format (nested patient.id).
 */
const resolvePatientId = (r) =>
    (r.patient_id ?? r.patient?.id ?? '').toString();

/**
 * Resolve new_treatment from a raw document.
 * Handles: new_treatment (current), new_medication (legacy), patient.new_treatment (Python).
 */
const resolveNewTreatment = (r) =>
    r.new_treatment ?? r.new_medication ?? null;

/**
 * Enrich raw conflict_analyses documents:
 *  - Fills in patient_name via Patient collection lookup when missing
 *  - Normalises patient_id to a plain string
 *  - Normalises new_treatment field name across all document origins
 */
const enrichReports = async (reports) => {
    if (reports.length > 0) {
        console.log('[DDI] raw doc keys:', Object.keys(reports[0]));
        console.log('[DDI] raw doc sample:', JSON.stringify(reports[0], null, 2));
    }

    // Collect patient IDs missing a stored patient_name
    const missingIds = [
        ...new Set(
            reports
                .filter(r => !r.patient_name && !r.patient?.name)
                .map(resolvePatientId)
                .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        ),
    ];

    const nameMap = {};
    if (missingIds.length > 0) {
        try {
            const patients = await Patient.find(
                { _id: { $in: missingIds } },
                'firstName lastName'
            ).lean();
            patients.forEach(p => {
                nameMap[p._id.toString()] = `${p.firstName} ${p.lastName}`;
            });
            console.log('[DDI] patients resolved:', nameMap);
        } catch (err) {
            console.error('[DDI] patient lookup error:', err.message);
        }
    }

    return reports.map(r => {
        const pid = resolvePatientId(r);
        return {
            ...r,
            patient_id: pid,
            patient_name:
                r.patient_name           // saved by our Node.js code
                ?? r.patient?.name       // Python service nested format
                ?? nameMap[pid]          // looked up from Patient collection
                ?? pid,                  // last resort: raw ID
            patient_age: r.patient_age ?? r.patient?.age,
            new_treatment: resolveNewTreatment(r),
            current_medications:
                r.current_medications    // our format
                ?? r.patient?.current_treatments  // Python service format
                ?? [],
        };
    });
};

// GET /api/ddi-reports
ddiRouter.get(
    '/',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL, roles.ADMIN, roles.SUPER_ADMIN, roles.PATIENT]),
    asyncHandler(async (req, res) => {
        const { patientId, doctorId, severity, limit = 100, skip = 0 } = req.query;

        const filter = {};
        if (req.authUser.role === roles.PATIENT) {
            filter.patient_id = req.authUser._id.toString();
        } else {
            if (patientId) filter.patient_id = patientId;
            if (doctorId)  filter.doctor_id  = doctorId;
        }
        if (severity) filter['analysis.severity'] = severity;

        const [raw, total] = await Promise.all([
            ConflictAnalysis.find(filter)
                .sort({ created_at: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .lean(),
            ConflictAnalysis.countDocuments(filter),
        ]);

        const data = await enrichReports(raw);
        return res.status(200).json({ success: true, total, count: data.length, data });
    })
);

// GET /api/ddi-reports/:id
ddiRouter.get(
    '/:id',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL, roles.ADMIN, roles.SUPER_ADMIN, roles.PATIENT]),
    asyncHandler(async (req, res, next) => {
        const report = await ConflictAnalysis.findById(req.params.id).lean();
        if (!report) return next(new AppError('DDI report not found', 404));

        const pid = resolvePatientId(report);
        if (req.authUser.role === roles.PATIENT && pid !== req.authUser._id.toString()) {
            return next(new AppError('DDI report not found', 404));
        }

        const [enriched] = await enrichReports([report]);
        return res.status(200).json({ success: true, data: enriched });
    })
);

export default ddiRouter;
