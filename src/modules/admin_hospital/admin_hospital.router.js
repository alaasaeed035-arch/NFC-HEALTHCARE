import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { isValid } from "../../middleware/vaildation.js";
import { deleteDoctorSchema, deleteReceptionistSchema, receptionistHospitalSchema, updateReceptionistSchema, verifyReceptionistOtpSchema, resendReceptionistOtpSchema } from "./admin_hospital.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { createReceptionist, deleteDoctor, deleteReceptionist, getAdminHospitalProfile, getAllReceptionists, updateReceptionist, getHospitalDoctors, getHospitalPatients, verifyReceptionistOtp, resendReceptionistOtp, setDoctorWorkingHours } from "./admin_hospital.controller.js";


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

// get profile admin hospital route
adminHospitalRouter.get('/profile',
    isAuthenticated(),
    isAuthorized([roles.ADMIN_HOSPITAL]),
    asyncHandler(getAdminHospitalProfile)
)

export default adminHospitalRouter;