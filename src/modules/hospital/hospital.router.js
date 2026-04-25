import { Router } from "express";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { isValid } from "../../middleware/vaildation.js";
import { deleteHospitalByIdSchema, getHospitalByIdSchema, hospitalSchema, updateHospitalSchema } from "./hospital.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { createHospital, deleteHospitalById, getAllHospitals, getHospitalById, getPublicHospitals, updateHospital } from "./hospital.controller.js";




const hospitalRouter = Router();

// create hospital route
hospitalRouter.post("/create",
    isAuthenticated(),
    isAuthorized([roles.ADMIN , roles.SUPER_ADMIN]),
    isValid(hospitalSchema),
    asyncHandler(createHospital)
);


// update hospital route
hospitalRouter.put("/update/:hospitalId",
    isAuthenticated(),
    isAuthorized([roles.ADMIN , roles.SUPER_ADMIN]),
    isValid(updateHospitalSchema),
    asyncHandler(updateHospital)
);

// public hospital list — no auth required (used for doctor signup page)
hospitalRouter.get("/public", asyncHandler(getPublicHospitals))

// get all hospitals route
hospitalRouter.get("/",
    isAuthenticated(),
    asyncHandler(getAllHospitals)
)


// get hospital by id route
hospitalRouter.get("/:hospitalId",
    isAuthenticated(),
    asyncHandler(getHospitalById)
)

// delete hospital by id route
hospitalRouter.delete("/delete/:hospitalId",
    isAuthenticated(),
    isAuthorized([roles.ADMIN , roles.SUPER_ADMIN]),
    isValid(deleteHospitalByIdSchema),
    asyncHandler(deleteHospitalById)
)


export default hospitalRouter;