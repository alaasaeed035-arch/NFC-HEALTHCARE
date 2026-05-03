import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';


// patient signup validation (staff-initiated — cardId required)
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

// patient self-registration (public route — stricter emergency contact)
export const selfSignupPatientSchema = joi.object({
    firstName : generalFields.name.required(),
    lastName : generalFields.name.required(),
    nationalId : generalFields.nationalId.required(),
    email : generalFields.email.required(),
    password : joi.string().min(8).required().messages({
        'string.min': 'Password must be at least 8 characters',
    }),
    gender: generalFields.gender.required(),
    dateOfBirth: generalFields.dateOfBirth.required(),
    bloodType: generalFields.bloodType.optional(),
    phoneNumber : generalFields.phoneNumber.required(),
    address : generalFields.address.required(),
    emergencyContact : joi.object({
        name: joi.string().trim().required(),
        phone: joi.string().pattern(/^01[0-2,5]{1}[0-9]{8}$/).required().messages({
            'string.pattern.base': 'Emergency contact phone must be a valid Egyptian mobile number',
        }),
        relation: joi.string().trim().required(),
    }).required(),
    cardId : generalFields.cardId.optional(),
    surgerys : generalFields.surgerys.optional(),
    ChronicDiseases : generalFields.ChronicDiseases.optional(),
})

// patient OTP verification
export const verifyPatientOtpSchema = joi.object({
    email : generalFields.email.required(),
    otp : generalFields.otp.required(),
})

// patient resend OTP
export const resendPatientOtpSchema = joi.object({
    email : generalFields.email.required(),
})

// patient login validation (email + password)
export const loginPatientSchema = joi.object({
    email : generalFields.email.required(),
    password : joi.string().required(),
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

// staff/admin/doctor login validation (accepts email or fullName as identifier)
export const loginSchema = joi.object({
    email : joi.string().trim().required(),
    password : joi.string().required(),
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