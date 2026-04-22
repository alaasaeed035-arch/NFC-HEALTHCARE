import { Router } from 'express';
import { checkDrugConflict, getDrugInformation } from './aiConflictChecker.service.js';
import { checkAIServiceHealth } from '../../utils/ai-service-config.js';
import { Patient } from '../../../db/index.js';
import { AppError } from '../../utils/appError.js';
import { messages } from '../../utils/constant/messages.js';
import { isAuthenticated } from '../../middleware/authentication.js';
import { isAuthorized } from '../../middleware/autheraization.js';
import { roles } from '../../utils/constant/enum.js';

const router = Router();

/**
 * POST /api/ai-conflict/check-conflict
 * Check drug conflicts for a patient
 */
router.post('/check-conflict',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL]),
    async (req, res, next) => {
    try {
        const { patientId, currentMedications, newMedication } = req.body;

        // Validate input
        if (!patientId || !newMedication || !newMedication.name) {
            return next(new AppError('Patient ID and new medication are required', 400));
        }

        // Get patient
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return next(new AppError(messages.patient.notExist, 404));
        }

        // Check conflict
        const result = await checkDrugConflict(
            patient,
            currentMedications || [],
            newMedication
        );

        return res.status(200).json({
            success: true,
            message: 'Conflict analysis completed',
            data: {
                patient: {
                    id: patient._id,
                    name: `${patient.firstName} ${patient.lastName}`,
                },
                newMedication: newMedication.name,
                analysis: result.analysis,
                aiServiceAvailable: result.success,
                fallbackMode: result.fallback || false,
            },
        });
    } catch (error) {
        console.error('Error in check-conflict endpoint:', error);
        return next(new AppError('Error checking drug conflicts', 500));
    }
});

/**
 * GET /api/ai-conflict/drug-info/:drugName
 * Get detailed drug information from FDA
 */
router.get('/drug-info/:drugName',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN_HOSPITAL, roles.PATIENT]),
    async (req, res, next) => {
    try {
        const { drugName } = req.params;

        if (!drugName) {
            return next(new AppError('Drug name is required', 400));
        }

        const result = await getDrugInformation(drugName);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: `No information found for drug: ${drugName}`,
                error: result.error,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Drug information retrieved',
            data: result.data,
        });
    } catch (error) {
        console.error('Error in drug-info endpoint:', error);
        return next(new AppError('Error fetching drug information', 500));
    }
});

/**
 * GET /api/ai-conflict/health
 * Check AI service health
 */
router.get('/health', async (req, res) => {
    try {
        const health = await checkAIServiceHealth();

        return res.status(health.available ? 200 : 503).json({
            success: health.available,
            message: health.available ? 'AI service is available' : 'AI service is unavailable',
            data: health,
        });
    } catch (error) {
        console.error('Error in health check:', error);
        return res.status(503).json({
            success: false,
            message: 'Error checking AI service health',
            error: error.message,
        });
    }
});

export default router;
