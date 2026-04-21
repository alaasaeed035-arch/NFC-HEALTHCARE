import cors from "cors";
import { globalErrorHandling } from "./utils/appError.js";
import { adminHospitalRouter, adminRouter, authRouter, hospitalRouter, medicalRecordRouter, receptionistRouter } from "./modules/index.js";

export const bootStrap = (app, express) => {
  // parse req
  app.use(express.json());
  // cors edit
  const corsOptions = {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  };
  app.use(cors(corsOptions));
  // routes
  app.use("/auth", authRouter);
  app.use("/admin" , adminRouter);
  app.use("/hospital" , hospitalRouter);
  app.use("/admin-hospital" , adminHospitalRouter);
  app.use("/medical-record" , medicalRecordRouter);
  app.use("/receptionist" , receptionistRouter);
  // global error
  app.use(globalErrorHandling);
};
