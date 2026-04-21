// import modules
import joi from 'joi';
import { AppError } from '../utils/appError.js';
import { bloodTypes, genderTypes, roles } from '../utils/constant/enum.js';

export const generalFields = {
    name: joi.string(),
    email: joi.string().email(),
    password: joi.string().pattern(new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/)),
    specialization: joi.string(),
    phoneNumber: joi.string().pattern(new RegExp(/^01[0-2,5]{1}[0-9]{8}$/)),
    address: joi.string(),
    hotline: joi.string().pattern(/^\d{3,5}$/),
    departments: joi.array().items(
        joi.object({
      name: joi.string().trim(),
      floor: joi.string().trim(),
    })),
    licenseNumber: joi.string().trim().pattern(/^[A-Za-z0-9]{3,20}$/),
    objectId: joi.string().hex().length(24),
    diagnosis: joi.string().trim(),
    treatment: joi.string().trim(),
    medications: joi.array().items(
      joi.object({
        name: joi.string().trim(),
        dosage: joi.string().trim(),
        duration: joi.string().trim(),
      })),
    visitDate: joi.date().default(Date.now),
    nationalId: joi.string().trim().pattern(/^[0-9]{14}$/),   // Egyptian National ID is always 14 digits
    gender: joi.string().valid(...Object.values(genderTypes)),
    dateOfBirth: joi.string()
        .regex(/^\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])$/)
        .message('Date of birth must be in format YYYY-M-D or YYYY-MM-DD'),
    bloodType: joi.string().valid(...Object.values(bloodTypes)),
    emergencyContact: joi.object({
      name: joi.string().trim(),
      phone: joi.string().pattern(/^01[0-2,5]{1}[0-9]{8}$/),
      relation: joi.string().trim(),
    }),
    cardId: joi.string().trim(),
    surgerys: joi.array().items(joi.string().trim()).default([]),
    ChronicDiseases: joi.array().items(joi.string().trim()).default([]),
    role : joi.string().trim().valid(...Object.values(roles)),  
    otp: joi.string().length(6),

};
export const isValid = (schema) => {
    return (req, res, next) => {
        let data = { ...req.body, ...req.params, ...req.query }
        const { error } = schema.validate(data, { abortEarly: false })
        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            return next(new AppError(errorMessage, 400));
        }
        next()
    }
}
