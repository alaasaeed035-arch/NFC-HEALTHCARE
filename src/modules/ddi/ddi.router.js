import { Router } from 'express';
import mongoose from 'mongoose';
import { isAuthenticated } from '../../middleware/authentication.js';
import { isAuthorized } from '../../middleware/autheraization.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError } from '../../utils/appError.js';
import { roles } from '../../utils/constant/enum.js';

const ddiRouter = Router();

// GET /api/ddi-reports — fetch conflict_analyses collection (written by Python DDI service)
ddiRouter.get(
    '/',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL, roles.ADMIN, roles.SUPER_ADMIN]),
    asyncHandler(async (req, res, next) => {
        if (!mongoose.connection.db) {
            return next(new AppError('Database not connected', 503));
        }

        const { patientId, severity, limit = 100, skip = 0 } = req.query;

        const filter = {};
        if (patientId) filter.patient_id = patientId;
        if (severity)  filter['analysis.severity'] = severity;

        const collection = mongoose.connection.db.collection('conflict_analyses');
        const [reports, total] = await Promise.all([
            collection
                .find(filter)
                .sort({ created_at: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .toArray(),
            collection.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            total,
            count: reports.length,
            data: reports,
        });
    })
);

// GET /api/ddi-reports/:id — single report
ddiRouter.get(
    '/:id',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL, roles.ADMIN, roles.SUPER_ADMIN]),
    asyncHandler(async (req, res, next) => {
        if (!mongoose.connection.db) {
            return next(new AppError('Database not connected', 503));
        }
        const { ObjectId } = mongoose.Types;
        if (!ObjectId.isValid(req.params.id)) {
            return next(new AppError('Invalid report ID', 400));
        }
        const collection = mongoose.connection.db.collection('conflict_analyses');
        const report = await collection.findOne({ _id: new ObjectId(req.params.id) });
        if (!report) {
            return next(new AppError('DDI report not found', 404));
        }
        return res.status(200).json({ success: true, data: report });
    })
);

export default ddiRouter;
