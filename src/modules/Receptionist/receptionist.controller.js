import { Doctor, Patient } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";

// Assign patient to doctor
export const assignPatientToDoctor = async (req, res, next) => {
  const { doctorId, patientId } = req.body;

  // Check Doctor exists
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return next(new AppError(messages.doctor.notExist, 404));

  // Check Patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) return next(new AppError(messages.patient.notExist, 404));

  // Add patientId to doctor's patients array if not already added
  if (!doctor.patients.includes(patientId)) {
    doctor.patients.push(patientId);
    await doctor.save();
  }

  res.status(200).json({
    success: true,
    message: messages.doctor.patientAssigned,
    data: { doctorId, patientId },
  });
};

// Get all patients assigned to a doctor
export const getDoctorPatients = async (req, res, next) => {
  const { doctorId } = req.params;

  // Find doctor and populate patients
  const doctor = await Doctor.findById(doctorId).populate("patients");
  if (!doctor) return next(new AppError(messages.doctor.notExist, 404));

  res.status(200).json({
    success: true,
    message: messages.doctor.patientsFetched,
    count: doctor.patients.length,
    data: doctor.patients,
  });
};