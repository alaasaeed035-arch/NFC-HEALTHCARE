import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';

// receptionist creation validation
export const receptionistHospitalSchema = joi.object({
    firstName : generalFields.name.required(),
    lastName : generalFields.name.required(),
    email : generalFields.email.required(),
    phoneNumber : generalFields.phoneNumber.allow('').optional(),
    password : joi.string().min(6).required(),
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

// delete doctor validation
export const deleteDoctorSchema = joi.object({
    doctorId : generalFields.objectId.required(),
})

// verify receptionist OTP validation
export const verifyReceptionistOtpSchema = joi.object({
    receptionistId : generalFields.objectId.required(),
    otp : joi.string().length(6).pattern(/^\d{6}$/).required().messages({
        'string.length' : 'OTP must be exactly 6 digits',
        'string.pattern.base' : 'OTP must contain only digits',
    }),
})

// resend receptionist OTP validation
export const resendReceptionistOtpSchema = joi.object({
    receptionistId : generalFields.objectId.required(),
})

// pharmacist creation validation
export const pharmacistHospitalSchema = joi.object({
    firstName : generalFields.name.required(),
    lastName : generalFields.name.required(),
    email : generalFields.email.required(),
    phoneNumber : generalFields.phoneNumber.allow('').optional(),
    password : joi.string().min(6).required(),
})

// verify pharmacist OTP validation
export const verifyPharmacistOtpSchema = joi.object({
    pharmacistId : generalFields.objectId.required(),
    otp : joi.string().length(6).pattern(/^\d{6}$/).required().messages({
        'string.length' : 'OTP must be exactly 6 digits',
        'string.pattern.base' : 'OTP must contain only digits',
    }),
})

// resend pharmacist OTP validation
export const resendPharmacistOtpSchema = joi.object({
    pharmacistId : generalFields.objectId.required(),
})

// delete pharmacist validation
export const deletePharmacistSchema = joi.object({
    pharmacistId : generalFields.objectId.required(),
})