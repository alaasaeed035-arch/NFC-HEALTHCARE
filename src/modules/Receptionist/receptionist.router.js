import { Router } from "express";
import { isValid } from "../../middleware/vaildation.js";
import { assignPatientToDoctorSchema, getPatientsOfDoctorSchema } from "./receptionist.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { assignPatientToDoctor, getDoctorPatients, getMyPatients, dismissPatient } from "./receptionist.controller.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";


const receptionistRouter = Router();

// assign  patients to doctor route
receptionistRouter.post("/assign-patient",
    isAuthenticated(),
    isAuthorized([ roles.RECEPTIONIST , roles.ADMIN_HOSPITAL ]),
    isValid(assignPatientToDoctorSchema),
    asyncHandler(assignPatientToDoctor)
)

// get all patients of a doctor route (for receptionist/admin)
receptionistRouter.get("/doctor/:doctorId/patients",
    isAuthenticated(),
    isAuthorized([ roles.RECEPTIONIST , roles.ADMIN_HOSPITAL , roles.DOCTOR ]),
    isValid(getPatientsOfDoctorSchema),
    asyncHandler(getDoctorPatients)
)

// get forwarded patients for the logged-in doctor (doctor's own queue)
receptionistRouter.get("/my-patients",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR ]),
    asyncHandler(getMyPatients)
)

// dismiss patient from doctor's queue after consultation
receptionistRouter.delete("/dismiss-patient",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR ]),
    asyncHandler(dismissPatient)
)


export default receptionistRouter;