import { Router } from "express";
import { isValid } from "../../middleware/vaildation.js";
import { createAdminSchema, createHospitalAdminSchema, deleteAdminSchema } from "./admin.validation.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/autheraization.js";
import { roles } from "../../utils/constant/enum.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { createAdmin, createAdminHospital, deleteAdminById, getAllAdmin } from "./admin.controller.js";


const adminRouter = Router();


// signup super admin route
// adminRouter.post("/signup/super-admin",
//     isValid(signupSuperAdminSchema),
//     asyncHandler(signupSuperAdmin)
// );


// create admin route
adminRouter.post("/create-admin",
    isAuthenticated(),
    isAuthorized([roles.SUPER_ADMIN]),
    isValid(createAdminSchema),
    asyncHandler(createAdmin)
);


// get all admins route 
adminRouter.get("/admins",
    isAuthenticated(),
    isAuthorized([roles.SUPER_ADMIN]),
    asyncHandler(getAllAdmin)
)


// delete admin route
adminRouter.delete("/admin/:adminId",
    isAuthenticated(),
    isAuthorized([roles.SUPER_ADMIN]),
    isValid(deleteAdminSchema),
    asyncHandler(deleteAdminById)
)

// create hospital admin route
adminRouter.post("/create-hospital-admin",
    isAuthenticated(),
    isAuthorized([roles.SUPER_ADMIN , roles.ADMIN]),
    isValid(createHospitalAdminSchema),
    asyncHandler(createAdminHospital)
);



export default adminRouter;