import joi from "joi";
import { generalFields } from "../../middleware/vaildation.js";

// signup super admin validation
// export const signupSuperAdminSchema = joi.object({
//     fullName : generalFields.name.required(),
//     email : generalFields.email.required(),
//     password : generalFields.password.required(),
//     phoneNumber : generalFields.phoneNumber.optional(),
// });


// create admin validation
export const createAdminSchema = joi.object({
    fullName : generalFields.name.required(),
    email : generalFields.email.required(),
    password : generalFields.password.required(),
    phoneNumber : generalFields.phoneNumber.required(),
});

// delete admin validation
export const deleteAdminSchema = joi.object({
    adminId : generalFields.objectId.required(),
});

// create hospital admin validation
export const createHospitalAdminSchema = joi.object({
    fullName : generalFields.name.required(),
    email : generalFields.email.required(),
    password : generalFields.password.required(),
    phoneNumber : generalFields.phoneNumber.required(),
    hospitalId : generalFields.objectId.required(),
})
