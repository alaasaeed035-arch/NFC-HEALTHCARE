import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { isValid } from "../../middleware/vaildation.js";
import { addMedicalRecordSchema, deleteMedicalRecordSchema, updateMedicalRecordSchema } from "./medicalRecord.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { addMedicalRecord, deleteMedicalRecord, getAllMedicalRecords, getMedicalRecordById, updateMedicalRecord } from "./medicalRecord.controller.js";


const medicalRecordRouter = Router();


// Add medical record route
medicalRecordRouter.post("/add",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR , roles.ADMIN_HOSPITAL ]),
    isValid(addMedicalRecordSchema),
    asyncHandler(addMedicalRecord)
)

// update medical record route
medicalRecordRouter.put("/:recordId",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR , roles.ADMIN_HOSPITAL ]),
    isValid(updateMedicalRecordSchema),
    asyncHandler(updateMedicalRecord)
)


// get all medical records route
medicalRecordRouter.get("/",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR , roles.ADMIN_HOSPITAL , roles.PATIENT ]),
    asyncHandler(getAllMedicalRecords)
)


// get specific medical record route
medicalRecordRouter.get("/:recordId",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR , roles.ADMIN_HOSPITAL , roles.PATIENT ]),
    asyncHandler(getMedicalRecordById)
)


// delete medical record route
medicalRecordRouter.delete("/:recordId",
    isAuthenticated(),
    isAuthorized([ roles.DOCTOR , roles.ADMIN_HOSPITAL ]),
    isValid(deleteMedicalRecordSchema),
    asyncHandler(deleteMedicalRecord)
)

export default medicalRecordRouter;

