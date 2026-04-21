import { Doctor, Hospital, MedicalRecord, Patient } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { roles } from "../../utils/constant/enum.js";
import { messages } from "../../utils/constant/messages.js";

// Add Medical Record (DOCTOR or ADMIN_HOSPITAL)
export const addMedicalRecord = async (req, res, next) => {
  const { patientId, diagnosis, treatment, medications } = req.body;

  //  Extract from token
    const doctorId = req.authUser._id;
    const hospitalId = req.authUser.hospitalId;
    const role = req.authUser.role;

  //  Check patient exists
  const patientExists = await Patient.findById(patientId);
  if (!patientExists) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  //  Check hospital exists
  const hospitalExists = await Hospital.findById(hospitalId);
  if (!hospitalExists) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  //  If user is DOCTOR → validate doctor & hospital
  if (role === roles.DOCTOR) {
    const doctorExists = await Doctor.findById(doctorId);
    if (!doctorExists) {
      return next(new AppError(messages.doctor.notExist, 404));
    }

    if (doctorExists.hospitalId.toString() !== hospitalId.toString()) {
      return next(new AppError(messages.doctor.notInHospital, 403));
    }
  }

  //  Create medical record (visitDate auto = now)
  const record = new MedicalRecord({
    patientId,
    doctorId,
    hospitalId,
    diagnosis,
    treatment,
    medications,
    visitDate,
  });

  const createdRecord = await record.save();
  if (!createdRecord) {
    return next(new AppError(messages.medicalRecord.failToCreate, 500));
  }

  return res.status(201).json({
    success: true,
    message: messages.medicalRecord.created,
    data: createdRecord,
  });
};



// Update Medical Record (DOCTOR or ADMIN_HOSPITAL)
export const updateMedicalRecord = async (req, res, next) => {
  const { recordId } = req.params;
  const { patientId, diagnosis, treatment, medications } = req.body;

  // Extract from token
  const doctorId = req.authUser._id;
  const hospitalId = req.authUser.hospitalId;
  const role = req.authUser.role;

  // Find the medical record
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    return next(new AppError(messages.medicalRecord.notExist, 404));
  }

  // Validate patient if patientId is provided
  if (patientId) {
    const patientExists = await Patient.findById(patientId);
    if (!patientExists) {
      return next(new AppError(messages.patient.notExist, 404));
    }
    record.patientId = patientId;
  }

  // Validate hospital
  const hospitalExists = await Hospital.findById(hospitalId);
  if (!hospitalExists) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  // Validate doctor if role is DOCTOR
  if (role === roles.DOCTOR) {
    const doctorExists = await Doctor.findById(doctorId);
    if (!doctorExists) {
      return next(new AppError(messages.doctor.notExist, 404));
    }

    if (doctorExists.hospitalId.toString() !== hospitalId.toString()) {
      return next(new AppError(messages.doctor.notInHospital, 403));
    }

    // Make sure only the doctor who created the record can update
    if (record.doctorId.toString() !== doctorId.toString()) {
      return next(new AppError(messages.medicalRecord.cannotUpdate, 403));
    }
  }

  // Update fields if provided
  if (diagnosis) record.diagnosis = diagnosis;
  if (treatment) record.treatment = treatment;
  if (medications) record.medications = medications;

  // Save updated record
  const updatedRecord = await record.save();
  if (!updatedRecord) {
    return next(new AppError(messages.medicalRecord.failToUpdate, 500));
  }

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.updated,
    data: updatedRecord,
  });
};


// Get all medical records
export const getAllMedicalRecords = async (req, res, next) => {
  // Fetch all medical records and optionally populate patient, doctor, hospital
  const records = await MedicalRecord.find()
    .populate("patientId", "firstName lastName") // select only needed fields
    .populate("doctorId", "firstName lastName specialization")
    .populate("hospitalId", "name address");

  // Check if any records exist
  if (!records || records.length === 0) {
    return next(new AppError(messages.medicalRecord.failToFetch, 404));
  }

  // Send response
  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.fetchedSuccessfully,
    count: records.length,
    data: records,
  });
};


// Get Medical Record by ID (with populated fields)
export const getMedicalRecordById = async (req, res, next) => {
  const { recordId } = req.params;

  // Find record by ID
  const record = await MedicalRecord.findById(recordId)
    .populate("patientId", "firstName lastName nationalId dateOfBirth bloodType phoneNumber") // only selected patient fields
    .populate("doctorId", "firstName lastName specialization email phoneNumber") // only selected doctor fields
    .populate("hospitalId", "name address phoneNumber email"); // only selected hospital fields

  // Check if record exists
  if (!record) {
    return next(new AppError(messages.medicalRecord.notExist, 404));
  }

  // Send response
  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.fetchedSuccessfully,
    data: record,
  });
};


// Delete Medical Record (DOCTOR or ADMIN_HOSPITAL only)
export const deleteMedicalRecord = async (req, res, next) => {
  const { recordId } = req.params;

  // Find the medical record
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    return next(new AppError(messages.medicalRecord.notExist, 404));
  }

  const user = req.authUser;

  // Check permissions: only doctor who created it or ADMIN_HOSPITAL
  if (
    user.role === roles.DOCTOR &&
    record.doctorId.toString() !== user._id.toString()
  ) {
    return next(
      new AppError(messages.medicalRecord.cannotDeleteOthers, 403)
    );
  }

  if (
    user.role === roles.ADMIN_HOSPITAL &&
    record.hospitalId.toString() !== user.hospitalId.toString()
  ) {
    return next(
      new AppError(messages.medicalRecord.cannotDeleteOthers, 403)
    );
  }

  // Delete the record
  await record.deleteOne();

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.deleted,
  });
};