import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { globalErrorHandling } from "./utils/appError.js";
import { adminHospitalRouter, adminRouter, authRouter, hospitalRouter, medicalRecordRouter, receptionistRouter, aiConflictRouter, chatbotRouter, ddiRouter } from "./modules/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, "..", "vite-frontend", "dist");

export const bootStrap = (app, express) => {
  // parse req
  app.use(express.json());
  // cors
  const corsOptions = {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  };
  app.use(cors(corsOptions));

  // serve built frontend
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  // API routes
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);
  app.use("/hospital", hospitalRouter);
  app.use("/admin-hospital", adminHospitalRouter);
  app.use("/medical-record", medicalRecordRouter);
  app.use("/receptionist", receptionistRouter);
  app.use("/api/ai-conflict", aiConflictRouter);
  app.use("/chatbot", chatbotRouter);
  app.use("/api/ddi-reports", ddiRouter);

  // SPA catch-all — must be after all API routes
  app.get("*", (req, res) => {
    const indexPath = join(distPath, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  });

  // global error
  app.use(globalErrorHandling);
};
