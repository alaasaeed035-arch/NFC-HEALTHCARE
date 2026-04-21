import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';


// add Medical Record validation schema
export const addMedicalRecordSchema = joi.object({
    patientId : generalFields.objectId.required(),
    doctorId : generalFields.objectId.optional(),
    hospitalId : generalFields.objectId.optional(),
    diagnosis : generalFields.diagnosis.required(),
    treatment : generalFields.treatment.optional(),
    medications : generalFields.medications.optional(),
})

// update Medical Record validation schema
export const updateMedicalRecordSchema = joi.object({
    recordId : generalFields.objectId.required(),
    patientId : generalFields.objectId.optional(),
    diagnosis : generalFields.diagnosis.optional(),
    treatment : generalFields.treatment.optional(),
    medications : generalFields.medications.optional(),
})

// get Medical Record by id schema
export const getMedicalRecordByIdSchema = joi.object({
    recordId : generalFields.objectId.required(),
})


// delete Medical Record by id schema
export const deleteMedicalRecordSchema = joi.object({
    recordId : generalFields.objectId.required(),
})