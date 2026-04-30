import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import { isAuthenticated } from '../../middleware/authentication.js';
import { isAuthorized } from '../../middleware/autheraization.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { roles } from '../../utils/constant/enum.js';
import { AppError } from '../../utils/appError.js';
import { callChatbotService, checkChatbotHealth } from '../../utils/chatbot-service-config.js';
import { Patient, MedicalRecord, PatientChatLog } from '../../../db/index.js';

// ─── Voice upload middleware ───────────────────────────────────────────────────
// Stores the audio in memory (buffer) — no disk I/O needed for small recordings.
const _multerAudio = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
}).single('audio');

// Promise wrapper so multer errors flow through our asyncHandler / AppError system
const uploadAudio = (req, res) =>
    new Promise((resolve, reject) => _multerAudio(req, res, err => (err ? reject(err) : resolve())));

const chatbotRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcAge = (dob) => {
    if (!dob) return null;
    return Math.floor(
        (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
};

/** MedicalRecord.patientId is Mixed — query both string and ObjectId forms. */
const medRecordFilter = (pid) => {
    if (!mongoose.Types.ObjectId.isValid(pid)) return { patientId: pid };
    return { $or: [{ patientId: pid }, { patientId: new mongoose.Types.ObjectId(pid) }] };
};

/**
 * Builds a plain-text system prompt injected as the FIRST message in
 * conversation_history.  The LLM sees it on every request — it never has
 * to look up the patient itself.
 */
const buildSystemContext = (ctx, records) => {
    const lines = [
        '=== PATIENT MEDICAL CONTEXT (provided by the healthcare system) ===',
        `Name          : ${ctx.name}`,
        `Age           : ${ctx.age ?? 'Unknown'}`,
        `Date of Birth : ${ctx.dateOfBirth ?? 'Unknown'}`,
        `Gender        : ${ctx.gender ?? 'Unknown'}`,
        `Blood Type    : ${ctx.bloodType ?? 'Unknown'}`,
        `Phone         : ${ctx.phoneNumber ?? 'Not provided'}`,
        `Address       : ${ctx.address ?? 'Not provided'}`,
        `Chronic Diseases : ${ctx.chronicDiseases.length ? ctx.chronicDiseases.join(', ') : 'None'}`,
        `Surgeries        : ${ctx.surgeries.length ? ctx.surgeries.join(', ') : 'None'}`,
    ];

    if (ctx.emergencyContact) {
        const { name, relation, phone } = ctx.emergencyContact;
        lines.push(`Emergency Contact: ${name} (${relation ?? 'N/A'}) — ${phone ?? 'N/A'}`);
    }

    if (records.length > 0) {
        lines.push('', '--- MEDICAL RECORDS (newest first) ---');
        records.forEach((r, i) => {
            lines.push(`\n[${i + 1}] Date: ${r.date} | Diagnosis: ${r.diagnosis}`);
            if (r.treatment) lines.push(`    Treatment : ${r.treatment}`);
            if (r.doctor)    lines.push(`    Doctor    : ${r.doctor}`);
            if (r.hospital)  lines.push(`    Hospital  : ${r.hospital}`);
            if (r.medications.length) {
                const meds = r.medications
                    .map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.duration ? ` for ${m.duration}` : ''}`)
                    .join('; ');
                lines.push(`    Medications: ${meds}`);
            }
            if (r.drugInteractionAlert) {
                lines.push(
                    `    ⚠ Drug Interaction [${r.drugInteractionAlert.severity.toUpperCase()}]: ` +
                    r.drugInteractionAlert.summary
                );
                if (r.drugInteractionAlert.recommendations.length) {
                    lines.push(`       → ${r.drugInteractionAlert.recommendations.join('; ')}`);
                }
            }
        });
    } else {
        lines.push('', '--- MEDICAL RECORDS ---', 'No medical records on file.');
    }

    lines.push('', '=== END OF PATIENT CONTEXT ===');
    lines.push(
        'You are a helpful medical assistant. Use the patient context above to answer ' +
        "questions about this patient's health, medications, and medical history. " +
        'If asked "what do you know about me" or similar, summarise the context above clearly.'
    );

    return lines.join('\n');
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /chatbot/message
 *
 * - Fetches patient profile + medical records from MongoDB
 * - Injects them as a system context message at the top of conversation_history
 * - Falls back to patient_chat_logs for cross-session memory
 * - Saves every turn to patient_chat_logs
 */
chatbotRouter.post(
    '/message',
    isAuthenticated(),
    isAuthorized([roles.PATIENT, roles.DOCTOR, roles.ADMIN_HOSPITAL]),
    asyncHandler(async (req, res, next) => {
        const { message, conversation_history, patientId, session_id } = req.body;
        const authUser = req.authUser;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return next(new AppError('message is required', 400));
        }

        // Resolve patient ID
        let resolvedPatientId;
        if (authUser.role === roles.PATIENT) {
            resolvedPatientId = authUser._id.toString();
        } else {
            if (!patientId) {
                return next(new AppError('patientId is required for non-patient roles', 400));
            }
            resolvedPatientId = patientId;
        }

        // Fetch patient profile + recent medical records in parallel
        const [patient, recentRecords] = await Promise.all([
            Patient.findById(resolvedPatientId).lean(),
            MedicalRecord.find(medRecordFilter(resolvedPatientId))
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('doctorId', 'firstName lastName specialization')
                .populate('hospitalId', 'name')
                .lean(),
        ]);

        if (!patient) {
            return next(new AppError('Patient not found', 404));
        }

        // Build structured patient context
        const patientContext = {
            name: `${patient.firstName} ${patient.lastName}`,
            age: calcAge(patient.dateOfBirth),
            dateOfBirth: patient.dateOfBirth
                ? new Date(patient.dateOfBirth).toLocaleDateString('en-GB')
                : null,
            gender: patient.gender || null,
            bloodType: patient.bloodType || null,
            phoneNumber: patient.phoneNumber || null,
            address: patient.address || null,
            chronicDiseases: patient.ChronicDiseases?.length ? patient.ChronicDiseases : [],
            surgeries: patient.surgerys?.length ? patient.surgerys : [],
            emergencyContact: patient.emergencyContact?.name ? patient.emergencyContact : null,
        };

        // Format medical records
        const medicalRecords = recentRecords.map(r => ({
            date: r.visitDate
                ? new Date(r.visitDate).toLocaleDateString('en-GB')
                : new Date(r.createdAt).toLocaleDateString('en-GB'),
            diagnosis: r.diagnosis,
            treatment: r.treatment || null,
            medications: (r.medications || []).map(m => ({
                name: m.name,
                dosage: m.dosage || m.dose || '',
                duration: m.duration || '',
                notes: m.notes || '',
            })),
            doctor: r.doctorId
                ? `Dr. ${r.doctorId.firstName} ${r.doctorId.lastName}` +
                  (r.doctorId.specialization ? ` (${r.doctorId.specialization})` : '')
                : null,
            hospital: r.hospitalId?.name || null,
            drugInteractionAlert: r.aiAnalysis?.hasConflict
                ? {
                    severity: r.aiAnalysis.severity,
                    summary: r.aiAnalysis.analysis,
                    recommendations: r.aiAnalysis.recommendations || [],
                  }
                : null,
        }));

        // Resolve conversation history for the current session.
        // If the frontend sends none (new session / page refresh), restore from DB.
        let history = conversation_history;
        if (!history || history.length === 0) {
            const pastLogs = await PatientChatLog.find({ patientId: resolvedPatientId })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('message response')
                .lean();

            history = pastLogs.reverse().flatMap(log => [
                { role: 'user',      content: log.message },
                ...(log.response ? [{ role: 'assistant', content: log.response }] : []),
            ]);
        }

        // Build context string from patient data fetched directly from MongoDB.
        const systemContextContent = buildSystemContext(patientContext, medicalRecords);

        // Inject context as a user/assistant exchange at the START of history.
        // Using role:'system' is unreliable — many Python FastAPI services define
        // conversation_history as List[{"role": "user"|"assistant", ...}] and will
        // silently drop or reject a system-role entry.  A synthetic user/assistant
        // pair is accepted by every LLM API and guaranteed to reach the model.
        const historyWithContext = [
            { role: 'user',      content: systemContextContent },
            { role: 'assistant', content: `Understood. I have the full medical context for ${patientContext.name} and will use it throughout our conversation.` },
            ...history,
        ];

        const payload = {
            patient_id: resolvedPatientId,
            // Top-level fields — for Python services that have a system_prompt slot
            system_prompt: systemContextContent,
            patient_context: patientContext,
            medical_records: medicalRecords,
            message: message.trim(),
            // conversation_history always starts with the patient context exchange
            conversation_history: historyWithContext,
        };

        const result = await callChatbotService('/chat', 'POST', payload);

        if (!result.success) {
            PatientChatLog.create({
                patientId: resolvedPatientId,
                sessionId: session_id || null,
                message: message.trim(),
                response: null,
                conversation_history: history,
                serviceAvailable: false,
            }).catch(err => console.error('[Chatbot] log save error:', err.message));

            return next(new AppError(
                result.error || 'Chatbot service unavailable',
                result.statusCode || 502
            ));
        }

        // Extract the assistant reply text (handle different Python service response shapes)
        const assistantResponse =
            result.data?.response
            ?? result.data?.message
            ?? result.data?.answer
            ?? result.data?.reply
            ?? (typeof result.data === 'string' ? result.data : null);

        // Persist to patient_chat_logs — store only real turns, not the injected
        // context exchange (fire-and-forget, never blocks the response)
        PatientChatLog.create({
            patientId: resolvedPatientId,
            sessionId: session_id || null,
            message: message.trim(),
            response: assistantResponse,
            conversation_history: [
                ...history,   // previous real turns (no context injection)
                { role: 'user', content: message.trim() },
                ...(assistantResponse ? [{ role: 'assistant', content: assistantResponse }] : []),
            ],
            serviceAvailable: true,
        }).catch(err => console.error('[Chatbot] log save error:', err.message));

        return res.status(200).json({
            success: true,
            data: result.data,
        });
    })
);

/**
 * GET /chatbot/history
 * Past chat logs for a patient, oldest → newest.
 * Patients are scoped automatically; doctors/admins pass ?patientId=.
 */
chatbotRouter.get(
    '/history',
    isAuthenticated(),
    isAuthorized([roles.PATIENT, roles.DOCTOR, roles.ADMIN_HOSPITAL]),
    asyncHandler(async (req, res, next) => {
        const { patientId, limit = 50 } = req.query;
        const authUser = req.authUser;

        let resolvedPatientId;
        if (authUser.role === roles.PATIENT) {
            resolvedPatientId = authUser._id.toString();
        } else {
            if (!patientId) return next(new AppError('patientId is required', 400));
            resolvedPatientId = patientId;
        }

        const logs = await PatientChatLog.find({ patientId: resolvedPatientId })
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .select('message response sessionId serviceAvailable createdAt')
            .lean();

        return res.status(200).json({
            success: true,
            count: logs.length,
            data: logs.reverse(),
        });
    })
);

/**
 * POST /chatbot/voice
 *
 * Flow:
 *   1. Accept multipart/form-data with field "audio" (webm / ogg / wav)
 *   2. Forward raw bytes to FastAPI POST /speech-to-text (Whisper, Arabic)
 *   3. Return { success: true, text: "<transcription>" }
 *
 * The frontend puts the transcription in the chat input so the user can
 * review / edit it before sending — satisfying the "edit before send" UX
 * requirement.  The actual chatbot call then goes through POST /chatbot/message
 * as normal.
 */
chatbotRouter.post(
    '/voice',
    isAuthenticated(),
    isAuthorized([roles.PATIENT, roles.DOCTOR, roles.ADMIN_HOSPITAL]),
    asyncHandler(async (req, res, next) => {
        // Run multer — stores audio in req.file.buffer
        try {
            await uploadAudio(req, res);
        } catch (multerErr) {
            return next(new AppError(`Audio upload error: ${multerErr.message}`, 400));
        }

        if (!req.file) {
            return next(new AppError(
                'No audio file received. Send multipart/form-data with field name "audio".',
                400,
            ));
        }

        const CHATBOT_URL = process.env.CHATBOT_SERVICE_URL || 'http://localhost:8001';

        // Build a native FormData (available in Node 18+) to forward the audio
        // buffer to FastAPI as multipart/form-data.
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, req.file.originalname || 'recording.webm');

        let sttRes;
        try {
            sttRes = await axios.post(`${CHATBOT_URL}/speech-to-text`, formData, {
                timeout: 60_000, // Whisper can take ~10-30 s for "base" model on CPU
            });
        } catch (err) {
            if (err.code === 'ECONNREFUSED') {
                return next(new AppError(
                    'Speech-to-text service is not running on port 8001.',
                    503,
                ));
            }
            const detail = err.response?.data?.detail || err.message;
            return next(new AppError(`Transcription failed: ${detail}`, err.response?.status || 502));
        }

        const text = sttRes.data?.text;
        if (!text) {
            return next(new AppError('Transcription returned empty text.', 422));
        }

        return res.status(200).json({ success: true, text });
    })
);

/**
 * GET /chatbot/health
 */
chatbotRouter.get('/health', async (_req, res) => {
    const health = await checkChatbotHealth();
    return res.status(health.available ? 200 : 503).json({
        success: health.available,
        service: 'patient-chatbot',
        data: health.data || null,
    });
});

export default chatbotRouter;
