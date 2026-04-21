import { Doctor, Hospital } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";

// Create Hospital (Admin only)
export const createHospital = async (req, res, next) => {
  const {
    name,
    address,
    phoneNumber,
    email,
    hotline,
    departments,
    licenseNumber,
  } = req.body;

  // format name for consistency
  const formattedName = name?.trim().toLowerCase();

  // Check if hospital already exists (by name or email)
  const hospitalExist = await Hospital.findOne({
    $or: [{ name: formattedName }, { email }],
  });

  if (hospitalExist) {
    return next(new AppError(messages.hospital.alreadyExist, 409));
  }

  // Create hospital
  const hospital = new Hospital({
    name: formattedName,
    address,
    phoneNumber,
    email,
    hotline,
    departments, // array of { name, floor }
    licenseNumber,
  });

  // Save hospital
  const createdHospital = await hospital.save();
  if (!createdHospital) {
    return next(new AppError(messages.hospital.failToCreate, 500));
  }

  // Send response
  return res.status(201).json({
    success: true,
    message: messages.hospital.created,
    data: createdHospital,
  });
};


// Update Hospital (Admin only)
export const updateHospital = async (req, res, next) => {
  const { hospitalId } = req.params;
  const {
    name,
    address,
    phoneNumber,
    email,
    hotline,
    departments,
    licenseNumber,
  } = req.body;

  // Find hospital
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  // Format name if provided
  const formattedName = name ? name.trim().toLowerCase() : undefined;

  // Check duplicate name
  if (formattedName && formattedName !== hospital.name) {
    const nameExists = await Hospital.findOne({ name: formattedName });
    if (nameExists) {
      return next(new AppError(messages.hospital.nameTaken, 409));
    }
  }

  // Check duplicate email
  if (email && email !== hospital.email) {
    const emailExists = await Hospital.findOne({ email });
    if (emailExists) {
      return next(new AppError(messages.hospital.emailTaken, 409));
    }
  }

  // Update fields
  hospital.name = formattedName ?? hospital.name;
  hospital.address = address ?? hospital.address;
  hospital.phoneNumber = phoneNumber ?? hospital.phoneNumber;
  hospital.email = email ?? hospital.email;
  hospital.hotline = hotline ?? hospital.hotline;
  hospital.licenseNumber = licenseNumber ?? hospital.licenseNumber;

  // Update departments (array)
  if (departments) {
    hospital.departments = departments; // must be array
  }

  // Save updates
  const updatedHospital = await hospital.save();
  if (!updatedHospital) {
    return next(new AppError(messages.hospital.failToUpdate, 500));
  }

  // Send response
  return res.status(200).json({
    success: true,
    message: messages.hospital.updated,
    data: updatedHospital,
  });
};


// Get all hospitals
export const getAllHospitals = async (req, res, next) => {
  const hospitals = await Hospital.find();

  // Check if hospitals exist
  if (!hospitals || hospitals.length === 0) {
    return next(new AppError(messages.hospital.failToFetch, 404));
  }

  // Send response
  return res.status(200).json({
    success: true,
    message: messages.hospital.fetchedSuccessfully,
    count: hospitals.length,
    data: hospitals,
  });
};


// get hospital by id
export const getHospitalById = async (req, res, next) => {
  const { hospitalId } = req.params;

  // Find hospital
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  // Find doctors working in this hospital
  const doctors = await Doctor.find({ hospitalId })
    .select("-password -otp -otpExpires"); // hide sensitive data

  return res.status(200).json({
    message: messages.hospital.fetchedSuccessfully,
    success: true,
    data: {
      hospital,
      doctors,
      doctorsCount: doctors.length
    }
  });
};


// delete hospital by id
export const deleteHospitalById = async (req, res, next) => {
  const { hospitalId } = req.params;

  // Ensure hospitalId is provided
  if (!hospitalId) {
    return next(new AppError(messages.hospital.notExist, 400));
  }

  // Find hospital by ID
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  // Delete hospital from DB
  await hospital.deleteOne();

  // Send response
  return res.status(200).json({
    message: messages.hospital.deleted,
    success: true,
  });
};
