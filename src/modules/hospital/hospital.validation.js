import joi from 'joi';
import { generalFields } from '../../middleware/vaildation.js';

// Hospital validation schema
export const hospitalSchema = joi.object({
    name : generalFields.name.required(),
    address : generalFields.address.required(),
    phoneNumber : generalFields.phoneNumber.required(),
    email : generalFields.email.required(),
    hotline : generalFields.hotline.required(),
    departments : generalFields.departments.required(),
    licenseNumber : generalFields.licenseNumber.optional(),
})


// update hospital schema
export const updateHospitalSchema = joi.object({
    name : generalFields.name.optional(),
    address : generalFields.address.optional(),
    phoneNumber : generalFields.phoneNumber.optional(),
    email : generalFields.email.optional(),
    hotline : generalFields.hotline.optional(),
    departments : generalFields.departments.optional(),
    licenseNumber : generalFields.licenseNumber.optional(),
    hospitalId : generalFields.objectId.required(),
})


// get hospital by id schema
export const getHospitalByIdSchema = joi.object({
    hospitalId : generalFields.objectId.required(),
})

// delete hospital by id schema
export const deleteHospitalByIdSchema = joi.object({
    hospitalId : generalFields.objectId.required(),
})