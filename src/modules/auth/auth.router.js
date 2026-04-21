import { Router } from "express";
import { isValid } from "../../middleware/vaildation.js";
import {  forgetDoctorPasswordSchema, loginPatientSchema,  loginSchema,  resetDoctorPasswordSchema,  signupDoctorSchema, signupPatientSchema, updateDoctorProfileSchema, updatePatientProfileSchema } from "./auth.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { forgetPasswordDoctor, getPatientProfile, getProfileDoctor, login, loginPatient, signupDoctor, signupPatient, updateDoctorProfile, updatePatientProfile, verifyDoctorAccount, verifyOtpAndResetPasswordDoctor } from "./auth.controller.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";



const authRouter = Router();

// patient signup route
authRouter.post('/signup/patient', isValid(signupPatientSchema) , asyncHandler(signupPatient));

// patient login route
authRouter.post('/login/patient', isValid(loginPatientSchema) , asyncHandler(loginPatient));


// doctor signup route
authRouter.post('/signup/doctor', isValid(signupDoctorSchema), asyncHandler(signupDoctor))

// verify doctor route
authRouter.get('/verify/:token', asyncHandler(verifyDoctorAccount))

// doctor login route
authRouter.post('/login', isValid(loginSchema) , asyncHandler(login));

// get patient profile route
authRouter.get('/patient/profile',
    isAuthenticated(),
    isAuthorized([roles.PATIENT, roles.ADMIN, roles.SUPER_ADMIN]),
    asyncHandler(getPatientProfile)
);

// get doctor profile route
authRouter.get("/doctor/profile", 
    isAuthenticated(),
    isAuthorized([roles.DOCTOR, roles.ADMIN, roles.SUPER_ADMIN]),
    asyncHandler(getProfileDoctor)
);

// forget doctor password route
authRouter.post('/doctor/forget-password',
    isValid(forgetDoctorPasswordSchema),
    asyncHandler(forgetPasswordDoctor)
);

// reset doctor password route
authRouter.post('/doctor/reset-password',
    isValid(resetDoctorPasswordSchema),
    asyncHandler(verifyOtpAndResetPasswordDoctor)
)

// update patient password route
authRouter.put('/patient/update',
    isAuthenticated(),
    isAuthorized([roles.ADMIN, roles.SUPER_ADMIN , roles.DOCTOR]),
    isValid(updatePatientProfileSchema),
    asyncHandler(updatePatientProfile)
)

// update doctor profile route
authRouter.put('/doctor/update',
    isAuthenticated(),
    isAuthorized([roles.DOCTOR , roles.ADMIN, roles.SUPER_ADMIN , roles.HOSPITAL_ADMIN]),
    isValid(updateDoctorProfileSchema),
    asyncHandler(updateDoctorProfile)
)

export default authRouter;