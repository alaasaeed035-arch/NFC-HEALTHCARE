import { ConflictAnalysis, Doctor, Hospital, MedicalRecord, Patient } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { roles } from "../../utils/constant/enum.js";
import { messages } from "../../utils/constant/messages.js";
import { checkMultipleDrugConflicts } from "./aiConflictChecker.service.js";

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

  // AI Conflict Checking - Check medications for conflicts
  let aiAnalysisData = null;
  let rawConflictResults = null;
  if (medications && medications.length > 0) {
    try {
      console.log('Running AI conflict check for medications...');
      const conflictResults = await checkMultipleDrugConflicts(patientExists, medications);
      rawConflictResults = conflictResults;

      // Find the most severe conflict
      let mostSevereConflict = null;
      let maxSeverity = 'none';
      const severityLevels = { none: 0, low: 1, moderate: 2, high: 3, critical: 4, unknown: 0 };

      for (const result of conflictResults) {
        if (result.analysis && result.analysis.severity) {
          const currentLevel = severityLevels[result.analysis.severity] || 0;
          const maxLevel = severityLevels[maxSeverity] || 0;
          if (currentLevel > maxLevel) {
            maxSeverity = result.analysis.severity;
            mostSevereConflict = result.analysis;
          }
        }
      }

      // Store AI analysis if conflicts were found
      if (mostSevereConflict) {
        aiAnalysisData = {
          hasConflict: mostSevereConflict.has_conflict || false,
          severity: mostSevereConflict.severity || 'none',
          analysis: mostSevereConflict.analysis || '',
          recommendations: mostSevereConflict.recommendations || [],
          interactions: mostSevereConflict.interactions || [],
          checkedAt: new Date(),
          serviceAvailable: conflictResults[0]?.success !== false,
        };
      }
    } catch (error) {
      console.error('AI conflict check failed:', error);
      // Continue with record creation even if AI check fails
      aiAnalysisData = {
        hasConflict: false,
        severity: 'unknown',
        analysis: 'AI conflict check was unavailable during record creation.',
        recommendations: ['Manually verify drug interactions'],
        interactions: [],
        checkedAt: new Date(),
        serviceAvailable: false,
      };
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
    aiAnalysis: aiAnalysisData,
  });

  const createdRecord = await record.save();
  if (!createdRecord) {
    return next(new AppError(messages.medicalRecord.failToCreate, 500));
  }

  // Persist each per-medication DDI result to conflict_analyses
  if (rawConflictResults) {
    const patientAge = patientExists.dateOfBirth
      ? Math.floor((Date.now() - new Date(patientExists.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;
    const docs = rawConflictResults
      .filter(r => r.analysis && r.medication)
      .map(r => ({
        patient_id: patientId.toString(),
        patient_name: `${patientExists.firstName} ${patientExists.lastName}`,
        patient_age: patientAge,
        doctor_id: doctorId.toString(),
        record_id: createdRecord._id.toString(),
        new_treatment: r.medication,
        analysis: {
          has_conflict: r.analysis.has_conflict || false,
          severity: r.analysis.severity || 'none',
          analysis: r.analysis.analysis || '',
          recommendations: r.analysis.recommendations || [],
          interactions: r.analysis.interactions || [],
        },
        created_at: new Date(),
      }));
    if (docs.length > 0) {
      ConflictAnalysis.insertMany(docs, { ordered: false }).catch(err =>
        console.error('Failed to persist conflict analyses:', err.message)
      );
    }
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
  let rawUpdateConflictResults = null;
  if (medications) {
    record.medications = medications;

    // Re-run AI conflict check since medications changed
    try {
      const patientForAI = await Patient.findById(record.patientId);
      if (patientForAI && medications.length > 0) {
        const conflictResults = await checkMultipleDrugConflicts(patientForAI, medications);
        rawUpdateConflictResults = conflictResults;

        let mostSevereConflict = null;
        let maxSeverity = 'none';
        const severityLevels = { none: 0, low: 1, moderate: 2, high: 3, critical: 4, unknown: 0 };

        for (const result of conflictResults) {
          if (result.analysis && result.analysis.severity) {
            const currentLevel = severityLevels[result.analysis.severity] || 0;
            if (currentLevel > (severityLevels[maxSeverity] || 0)) {
              maxSeverity = result.analysis.severity;
              mostSevereConflict = result.analysis;
            }
          }
        }

        record.aiAnalysis = mostSevereConflict
          ? {
              hasConflict: mostSevereConflict.has_conflict || false,
              severity: mostSevereConflict.severity || 'none',
              analysis: mostSevereConflict.analysis || '',
              recommendations: mostSevereConflict.recommendations || [],
              interactions: mostSevereConflict.interactions || [],
              checkedAt: new Date(),
              serviceAvailable: conflictResults[0]?.success !== false,
            }
          : {
              hasConflict: false,
              severity: 'none',
              analysis: '',
              recommendations: [],
              interactions: [],
              checkedAt: new Date(),
              serviceAvailable: true,
            };
      }
    } catch (error) {
      console.error('AI conflict re-check failed on update:', error);
      record.aiAnalysis = {
        hasConflict: false,
        severity: 'unknown',
        analysis: 'AI conflict check was unavailable during record update.',
        recommendations: ['Manually verify drug interactions'],
        interactions: [],
        checkedAt: new Date(),
        serviceAvailable: false,
      };
    }
  }

  // Save updated record
  const updatedRecord = await record.save();
  if (!updatedRecord) {
    return next(new AppError(messages.medicalRecord.failToUpdate, 500));
  }

  // Persist each per-medication DDI result to conflict_analyses
  if (rawUpdateConflictResults) {
    const patientForAge = await Patient.findById(updatedRecord.patientId).select('firstName lastName dateOfBirth').lean().catch(() => null);
    const patientAge = patientForAge?.dateOfBirth
      ? Math.floor((Date.now() - new Date(patientForAge.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;
    const docs = rawUpdateConflictResults
      .filter(r => r.analysis && r.medication)
      .map(r => ({
        patient_id: updatedRecord.patientId.toString(),
        patient_name: patientForAge ? `${patientForAge.firstName} ${patientForAge.lastName}` : undefined,
        patient_age: patientAge,
        doctor_id: doctorId.toString(),
        record_id: updatedRecord._id.toString(),
        new_treatment: r.medication,
        analysis: {
          has_conflict: r.analysis.has_conflict || false,
          severity: r.analysis.severity || 'none',
          analysis: r.analysis.analysis || '',
          recommendations: r.analysis.recommendations || [],
          interactions: r.analysis.interactions || [],
        },
        created_at: new Date(),
      }));
    if (docs.length > 0) {
      ConflictAnalysis.insertMany(docs, { ordered: false }).catch(err =>
        console.error('Failed to persist conflict analyses on update:', err.message)
      );
    }
  }

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.updated,
    data: updatedRecord,
  });
};


// Get all medical records
export const getAllMedicalRecords = async (req, res, next) => {
  let query = {}

  if (req.authUser.role === roles.PATIENT) {
    // Match patientId stored as either ObjectId or String
    const id = req.authUser._id
    query = {
      $or: [
        { patientId: id },             // ObjectId match
        { patientId: id.toString() },   // String match
      ]
    }
  }

  const records = await MedicalRecord.find(query)
    .populate("patientId", "firstName lastName")
    .populate("doctorId", "firstName lastName specialization")
    .populate("hospitalId", "name address")
    .sort({ createdAt: -1 });

  // Normalize medication fields: map 'dose' → 'dosage' for legacy records
  const normalized = records.map(r => {
    const obj = r.toObject ? r.toObject() : r
    if (obj.medications) {
      obj.medications = obj.medications.map(med => ({
        ...med,
        dosage: med.dosage || med.dose || '',
        duration: med.duration || '',
      }))
    }
    return obj
  })

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.fetchedSuccessfully,
    count: normalized.length,
    data: normalized,
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

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.fetchedSuccessfully,
    data: record,
  });
};


// Get Medical Records by Patient ID
export const getMedicalRecordByPatient = async (req, res, next) => {
  const { patientId } = req.params;

  // Match patientId stored as either ObjectId or String
  const records = await MedicalRecord.find({
    $or: [
      { patientId: patientId },
      { patientId: patientId.toString() },
    ]
  })
    .populate("patientId", "firstName lastName")
    .populate("doctorId", "firstName lastName specialization")
    .populate("hospitalId", "name address")
    .sort({ createdAt: -1 });

  // Normalize medication fields: map 'dose' → 'dosage' for legacy records
  const normalized = records.map(r => {
    const obj = r.toObject ? r.toObject() : r
    if (obj.medications) {
      obj.medications = obj.medications.map(med => ({
        ...med,
        dosage: med.dosage || med.dose || '',
        duration: med.duration || '',
      }))
    }
    return obj
  })

  return res.status(200).json({
    success: true,
    message: messages.medicalRecord.fetchedSuccessfully,
    count: normalized.length,
    data: normalized,
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