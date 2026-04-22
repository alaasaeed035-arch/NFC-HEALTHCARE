import { callAIService } from '../../utils/ai-service-config.js';
import { Patient } from '../../../db/index.js';

/**
 * AI Conflict Checker Service
 * Handles drug conflict checking using the FastAPI AI service
 */

/**
 * Format patient data for AI service
 */
const formatPatientForAI = (patient, medications) => {
    return {
        id: patient._id.toString(),
        name: `${patient.firstName} ${patient.lastName}`,
        age: calculateAge(patient.dateOfBirth),
        current_treatments: formatMedicationsForAI(medications),
    };
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

/**
 * Format medications for AI service
 * Converts MongoDB format to AI service format
 */
const formatMedicationsForAI = (medications) => {
    if (!medications || medications.length === 0) {
        return [];
    }

    return medications.map(med => ({
        name: med.name || '',
        dosage: med.dosage || 'Not specified',
        frequency: med.duration || 'Not specified', // Map duration to frequency
        notes: med.notes || '',
    }));
};

/**
 * Format new treatment for AI service
 */
const formatNewTreatmentForAI = (medication) => {
    return {
        name: medication.name || '',
        dosage: medication.dosage || 'Not specified',
        frequency: medication.duration || 'Not specified',
        notes: medication.notes || '',
    };
};

/**
 * Check drug conflicts using AI service
 * @param {Object} patient - Patient object from MongoDB
 * @param {Array} currentMedications - Array of current medications
 * @param {Object} newMedication - New medication to check
 * @returns {Object} Conflict analysis result
 */
export const checkDrugConflict = async (patient, currentMedications, newMedication) => {
    try {
        // Format data for AI service
        const patientData = formatPatientForAI(patient, currentMedications);
        const newTreatment = formatNewTreatmentForAI(newMedication);

        // Prepare request payload
        const requestData = {
            patient: patientData,
            new_treatment: newTreatment,
        };

        console.log('Checking drug conflict for:', newMedication.name);

        // Call AI service
        const result = await callAIService('/check-conflict', 'POST', requestData);

        if (!result.success) {
            // Return fallback response if AI service is unavailable
            return {
                success: false,
                fallback: true,
                analysis: {
                    has_conflict: false,
                    severity: 'unknown',
                    analysis: 'AI service is currently unavailable. Please consult with a pharmacist for drug interaction checking.',
                    recommendations: [
                        'Verify drug interactions manually',
                        'Consult with a clinical pharmacist',
                        'Review patient medication history',
                    ],
                    interactions: [],
                },
                error: result.error,
            };
        }

        // Return successful analysis
        return {
            success: true,
            analysis: result.data,
        };
    } catch (error) {
        console.error('Error in checkDrugConflict:', error);
        return {
            success: false,
            fallback: true,
            analysis: {
                has_conflict: false,
                severity: 'unknown',
                analysis: 'An error occurred while checking drug conflicts. Please verify medications manually.',
                recommendations: ['Consult with a healthcare professional'],
                interactions: [],
            },
            error: error.message,
        };
    }
};

/**
 * Get detailed drug information from FDA
 * @param {string} drugName - Name of the drug
 * @returns {Object} Drug information
 */
export const getDrugInformation = async (drugName) => {
    try {
        console.log('Fetching drug information for:', drugName);

        const result = await callAIService(`/drug-info/${encodeURIComponent(drugName)}`, 'GET');

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                data: null,
            };
        }

        return {
            success: true,
            data: result.data,
        };
    } catch (error) {
        console.error('Error in getDrugInformation:', error);
        return {
            success: false,
            error: error.message,
            data: null,
        };
    }
};

/**
 * Check multiple medications for conflicts
 * @param {Object} patient - Patient object
 * @param {Array} medications - Array of medications to check
 * @returns {Array} Array of conflict analyses
 */
export const checkMultipleDrugConflicts = async (patient, medications) => {
    const results = [];

    for (let i = 0; i < medications.length; i++) {
        const currentMeds = medications.slice(0, i);
        const newMed = medications[i];

        const analysis = await checkDrugConflict(patient, currentMeds, newMed);
        results.push({
            medication: newMed,
            analysis: analysis.analysis,
            success: analysis.success,
        });
    }

    return results;
};

export default {
    checkDrugConflict,
    getDrugInformation,
    checkMultipleDrugConflicts,
};
