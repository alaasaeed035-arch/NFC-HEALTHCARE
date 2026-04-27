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


// Get forwarded patients for the logged-in doctor (doctor's own queue)
export const getMyPatients = async (req, res, next) => {
  const doctorId = req.authUser._id;

  const doctor = await Doctor.findById(doctorId).populate("patients");
  if (!doctor) return next(new AppError(messages.doctor.notExist, 404));

  res.status(200).json({
    success: true,
    message: messages.doctor.patientsFetched,
    count: doctor.patients.length,
    data: doctor.patients,
  });
};


// Assign (or reassign) an NFC card to a patient
export const assignCardToPatient = async (req, res, next) => {
  const { patientId, cardId } = req.body;

  // Make sure the card isn't already linked to a different patient
  const taken = await Patient.findOne({ cardId });
  if (taken && taken._id.toString() !== patientId) {
    return next(new AppError('This card is already assigned to another patient', 409));
  }

  const patient = await Patient.findByIdAndUpdate(patientId, { cardId }, { new: true });
  if (!patient) return next(new AppError(messages.patient.notExist, 404));

  return res.status(200).json({
    success: true,
    message: 'Card assigned successfully',
    data: patient,
  });
};

// Dismiss patient from doctor's forwarded queue (after consultation)
export const dismissPatient = async (req, res, next) => {
  const doctorId = req.authUser._id;
  const { patientId } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return next(new AppError(messages.doctor.notExist, 404));

  // Check patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) return next(new AppError(messages.patient.notExist, 404));

  // Remove patient from doctor's patients array
  doctor.patients = doctor.patients.filter(
    (id) => id.toString() !== patientId.toString()
  );
  await doctor.save();

  res.status(200).json({
    success: true,
    message: "Patient dismissed from queue successfully",
  });
};