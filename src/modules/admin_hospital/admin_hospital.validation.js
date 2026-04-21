import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';

// receptionist creation validation
export const receptionistHospitalSchema = joi.object({
    fullName : generalFields.name.required(),
    email : generalFields.email.required(),
    phoneNumber : generalFields.phoneNumber.required(),
    password : generalFields.password.required(),
    hospitalId : generalFields.objectId.optional(),
})


// update receptionist validation
export const updateReceptionistSchema = joi.object({
    receptionistId : generalFields.objectId.required(),
    fullName : generalFields.name.optional(),
    email : generalFields.email.optional(),
    phoneNumber : generalFields.phoneNumber.optional(),
    password : generalFields.password.optional(),
})


// delete receptionist validation
export const deleteReceptionistSchema = joi.object({
    receptionistId : generalFields.objectId.required(),
})