import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';


// patient signup validation
export const signupPatientSchema = joi.object({
    firstName : generalFields.name.required(),
    lastName : generalFields.name.required(),
    nationalId : generalFields.nationalId.required(),
    gender: generalFields.gender.required(),
    dateOfBirth: generalFields.dateOfBirth.required(),
    bloodType: generalFields.bloodType.optional(),
    phoneNumber : generalFields.phoneNumber.required(),
    address : generalFields.address.required(),
    emergencyContact : generalFields.emergencyContact.required(),
    cardId : generalFields.cardId.optional(),
    surgerys : generalFields.surgerys.optional(),
    ChronicDiseases : generalFields.ChronicDiseases.optional(),
})

// patient login validation
export const loginPatientSchema = joi.object({
    nationalId : generalFields.nationalId.required(),
})

// doctor signup validation
export const signupDoctorSchema = joi.object({
    firstName : generalFields.name.required(),
    lastName : generalFields.name.required(),
    specialization : generalFields.specialization.required(),
    email : generalFields.email.required(),
    phoneNumber : generalFields.phoneNumber.required(),
    password : generalFields.password.required(),
    hospitalId : generalFields.objectId.required(),
    role : generalFields.role.optional(),
})

// doctor login validation
export const loginSchema = joi.object({
    email : generalFields.email.required(),
    password : generalFields.password.required(),
})

// forget doctor password validation
export const forgetDoctorPasswordSchema = joi.object({
email : generalFields.email.required(),
})

// reset doctor password validation
export const resetDoctorPasswordSchema = joi.object({
    email : generalFields.email.required(),
    otp : generalFields.otp.required(),
    newPassword : generalFields.password.required(),
})

// update patient profile validation
export const updatePatientProfileSchema = joi.object({
    firstName : generalFields.name.optional(),
    lastName : generalFields.name.optional(),
    nationalId : generalFields.nationalId.optional(),
    gender : generalFields.gender.optional(),
    dateOfBirth : generalFields.dateOfBirth.optional(),
    bloodType : generalFields.bloodType.optional(),
    phoneNumber : generalFields.phoneNumber.optional(),
    address : generalFields.address.optional(),
    emergencyContact : generalFields.emergencyContact.optional(),
    cardId : generalFields.cardId.optional(),
    surgerys : generalFields.surgerys.optional(),
    ChronicDiseases : generalFields.ChronicDiseases.optional(),
}) 


// update doctor profile validation
export const updateDoctorProfileSchema = joi.object({
    firstName : generalFields.name.optional(),
    lastName : generalFields.name.optional(),
    specialization : generalFields.specialization.optional(),
    phoneNumber : generalFields.phoneNumber.optional(),
    hospitalId : generalFields.objectId.optional(),
})