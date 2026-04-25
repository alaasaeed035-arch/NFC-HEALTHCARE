import { Router } from 'express';
import { isAuthenticated } from '../../middleware/authentication.js';
import { isAuthorized } from '../../middleware/autheraization.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { roles } from '../../utils/constant/enum.js';
import { AppError } from '../../utils/appError.js';
import { callChatbotService, checkChatbotHealth } from '../../utils/chatbot-service-config.js';

const chatbotRouter = Router();

/**
 * POST /chatbot/message
 * Authenticated patients chat with their own records.
 * Doctors may query on behalf of a patient by providing patientId in body.
 */
chatbotRouter.post(
    '/message',
    isAuthenticated(),
    isAuthorized([roles.PATIENT, roles.DOCTOR, roles.ADMIN_HOSPITAL]),
    asyncHandler(async (req, res, next) => {
        const { message, conversation_history, patientId } = req.body;
        const authUser = req.authUser;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return next(new AppError('message is required', 400));
        }

        // Resolve which patient's records to load
        let resolvedPatientId;
        if (authUser.role === roles.PATIENT) {
            // Patient can only query their own records
            resolvedPatientId = authUser._id.toString();
        } else {
            // Doctor / admin_hospital must provide patientId
            if (!patientId) {
                return next(new AppError('patientId is required for non-patient roles', 400));
            }
            resolvedPatientId = patientId;
        }

        const payload = {
            patient_id: resolvedPatientId,
            message: message.trim(),
            conversation_history: conversation_history || [],
        };

        const result = await callChatbotService('/chat', 'POST', payload);

        if (!result.success) {
            const status = result.statusCode || 502;
            return next(new AppError(result.error || 'Chatbot service unavailable', status));
        }

        return res.status(200).json({
            success: true,
            data: result.data,
        });
    })
);

/**
 * GET /chatbot/health
 * Public health check for the chatbot microservice.
 */
chatbotRouter.get('/health', async (req, res) => {
    const health = await checkChatbotHealth();
    return res.status(health.available ? 200 : 503).json({
        success: health.available,
        service: 'patient-chatbot',
        data: health.data || null,
    });
});

export default chatbotRouter;
