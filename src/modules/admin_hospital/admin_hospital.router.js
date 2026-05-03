import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { isValid } from "../../middleware/vaildation.js";
import { deleteDoctorSchema, deleteReceptionistSchema, receptionistHospitalSchema, updateReceptionistSchema, verifyReceptionistOtpSchema, resendReceptionistOtpSchema, pharmacistHospitalSchema, verifyPharmacistOtpSchema, resendPharmacistOtpSchema, deletePharmacistSchema } from "./admin_hospital.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { createReceptionist, deleteDoctor, deleteReceptionist, getAdminHospitalProfile, getAllReceptionists, updateReceptionist, getHospitalDoctors, getHospitalPatients, verifyReceptionistOtp, resendReceptionistOtp, setDoctorWorkingHours, createPharmacist, getAllPharmacists, verifyPharmacistOtp, resendPharmacistOtp, deletePharmacist, getDepartments, addDepartment, deleteDepartment } from "./admin_hospital.controller.js";


const adminHospitalRouter = Router();

// create receptionist route
adminHospitalRouter.post('/create-receptionist',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL , roles.ADMIN , roles.SUPER_ADMIN]),
    isValid(receptionistHospitalSchema),
    asyncHandler(createReceptionist)
 );


 // update receptionist route
 adminHospitalRouter.put('/update/:receptionistId',
     isAuthenticated(),
     isAuthorized([roles.ADMIN_HOSPITAL]),
     isValid(updateReceptionistSchema),
     asyncHandler(updateReceptionist) 
 );


 // get all receptionists of hospital route
 adminHospitalRouter.get('/receptionists',
     isAuthenticated(),
     isAuthorized([roles.ADMIN_HOSPITAL]),
     asyncHandler(getAllReceptionists)
);

// delete receptionist route
adminHospitalRouter.delete('/receptionist/:receptionistId',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(deleteReceptionistSchema),
    asyncHandler(deleteReceptionist)
)

// delete doctor route (ADMIN_HOSPITAL only)
adminHospitalRouter.delete('/doctor/:doctorId',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(deleteDoctorSchema),
    asyncHandler(deleteDoctor)
)

// get patients for this hospital
adminHospitalRouter.get('/patients',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL, roles.RECEPTIONIST]),
    asyncHandler(getHospitalPatients)
);

// get doctors for this hospital
adminHospitalRouter.get('/doctors',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL, roles.RECEPTIONIST]),
    asyncHandler(getHospitalDoctors)
);

// verify receptionist OTP route
adminHospitalRouter.post('/verify-receptionist-otp',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(verifyReceptionistOtpSchema),
    asyncHandler(verifyReceptionistOtp)
)

// resend OTP to receptionist route
adminHospitalRouter.post('/resend-receptionist-otp',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(resendReceptionistOtpSchema),
    asyncHandler(resendReceptionistOtp)
)

// set working hours for a doctor
adminHospitalRouter.put('/doctor/:doctorId/working-hours',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(setDoctorWorkingHours)
)

// ── Pharmacist management ─────────────────────────────────────────────────

adminHospitalRouter.post('/create-pharmacist',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(pharmacistHospitalSchema),
    asyncHandler(createPharmacist)
)

adminHospitalRouter.get('/pharmacists',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(getAllPharmacists)
)

adminHospitalRouter.post('/verify-pharmacist-otp',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(verifyPharmacistOtpSchema),
    asyncHandler(verifyPharmacistOtp)
)

adminHospitalRouter.post('/resend-pharmacist-otp',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(resendPharmacistOtpSchema),
    asyncHandler(resendPharmacistOtp)
)

adminHospitalRouter.delete('/pharmacist/:pharmacistId',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    isValid(deletePharmacistSchema),
    asyncHandler(deletePharmacist)
)

// ── Department routes ─────────────────────────────────────────────────────
adminHospitalRouter.get('/departments',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(getDepartments)
)

adminHospitalRouter.post('/departments',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(addDepartment)
)

adminHospitalRouter.delete('/departments/:name',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(deleteDepartment)
)

// get profile admin hospital route
adminHospitalRouter.get('/profile',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(getAdminHospitalProfile)
)

export default adminHospitalRouter;