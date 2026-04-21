import { Router } from "express";
import { isValid } from "../../middleware/vaildation.js";
import { assignPatientToDoctorSchema, getPatientsOfDoctorSchema } from "./receptionist.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { assignPatientToDoctor, getDoctorPatients } from "./receptionist.controller.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { get } from "mongoose";


const receptionistRouter = Router();

// assign  patients to doctor route
receptionistRouter.post("/assign-patient",
    isAuthenticated(),
    isAuthorized([ roles.RECEPTIONIST , roles.ADMIN_HOSPITAL ]),
    isValid(assignPatientToDoctorSchema),
    asyncHandler(assignPatientToDoctor)
)

// get all patients of a doctor route
receptionistRouter.get("/doctor/:doctorId/patients",
    isAuthenticated(),
    isAuthorized([ roles.RECEPTIONIST , roles.ADMIN_HOSPITAL ]),
    isValid(getPatientsOfDoctorSchema),
    asyncHandler(getDoctorPatients)
)


export default receptionistRouter;