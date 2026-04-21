import bcrypt from "bcrypt";
import { User } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { roles } from "../../utils/constant/enum.js";
import { messages } from "../../utils/constant/messages.js";
import { generateToken } from "../../utils/token.js";

// Create Receptionist (by ADMIN_HOSPITAL only)
export const createReceptionist = async (req, res, next) => {
  const { fullName, email, phoneNumber, password } = req.body;

  // admin hospital from auth middleware
  const adminHospital = req.authUser;

  // ensure creator is ADMIN_HOSPITAL
  if (adminHospital.role !== roles.ADMIN_HOSPITAL) {
    return next(new AppError(messages.user.unauthorized, 403));
  }

  // check duplicate email or phone
  const exist = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (exist) {
    return next(new AppError(messages.user.alreadyExist, 409));
  }

  // hash password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // create receptionist
  const receptionist = new User({
    fullName,
    email,
    phoneNumber,
    password: hashedPassword,
    role: roles.RECEPTIONIST,
    hospitalId: adminHospital.hospitalId, // same hospital
    isVerified: true,
  });

  const created = await receptionist.save();
  if (!created) {
    return next(new AppError(messages.user.failToCreate, 500));
  }

  // hide password
  created.password = undefined;

  return res.status(201).json({
    message: messages.user.created,
    success: true,
    data: created,
  });
};


// Update ReceptionIST (ADMIN_HOSPITAL only)
export const updateReceptionist = async (req, res, next) => {
  const { receptionistId } = req.params;
  const { fullName, email, phoneNumber, password } = req.body;

  // logged-in user
  const adminHospital = req.authUser;

  // role check (extra safety)
  if (adminHospital.role !== roles.ADMIN_HOSPITAL) {
    return next(new AppError(messages.user.unauthorized, 403));
  }

  // find receptionist
  const receptionist = await User.findOne({
    _id: receptionistId,
    role: roles.RECEPTIONIST,
    hospitalId: adminHospital.hospitalId,
  });

  if (!receptionist) {
    return next(new AppError(messages.user.notExist, 404));
  }

  // check duplicate email
  if (email && email !== receptionist.email) {
    const emailExist = await User.findOne({ email });
    if (emailExist) {
      return next(new AppError(messages.user.emailTaken, 409));
    }
    receptionist.email = email;
  }

  // update fields
  if (fullName) receptionist.fullName = fullName;
  if (phoneNumber) receptionist.phoneNumber = phoneNumber;

  // update password (optional)
  if (password) {
    receptionist.password = bcrypt.hashSync(password, 8);
  }

  // save
  const updated = await receptionist.save();
  if (!updated) {
    return next(new AppError(messages.user.failToUpdate, 500));
  }

  // hide password
  updated.password = undefined;

  return res.status(200).json({
    message: messages.user.updated,
    success: true,
    data: updated,
  });
};


// Get all receptionists (ADMIN_HOSPITAL only)
export const getAllReceptionists = async (req, res, next) => {
  const adminHospital = req.authUser;

  // Ensure admin hospital has hospitalId
  if (!adminHospital.hospitalId) {
    return next(new AppError(messages.hospital.notExist, 404));
  }

  // Fetch receptionists for same hospital
  const receptionists = await User.find({
    role: roles.RECEPTIONIST,
    hospitalId: adminHospital.hospitalId,
  }).select("-password");

  if (!receptionists.length) {
    return next(new AppError(messages.user.notExist, 404));
  }

  return res.status(200).json({
    message: messages.user.fetchedSuccessfully,
    success: true,
    count: receptionists.length,
    data: receptionists,
  });
};


// Delete Receptionist (ADMIN_HOSPITAL only)
export const deleteReceptionist = async (req, res, next) => {
  const { receptionistId } = req.params;

  // Get the authenticated admin hospital
  const adminHospital = req.authUser;

  // Ensure only ADMIN_HOSPITAL can delete
  if (adminHospital.role !== roles.ADMIN_HOSPITAL) {
    return next(new AppError(messages.user.unauthorized, 403));
  }

  //  Find the receptionist by ID
  const receptionist = await User.findById(receptionistId);
  if (!receptionist) {
    return next(new AppError(messages.user.notExist, 404));
  }

  // Ensure target user is a Receptionist
  if (receptionist.role !== roles.RECEPTIONIST) {
    return next(new AppError(messages.user.canOnlyDeleteReceptionists, 403));
  }

  //  Ensure receptionist belongs to the same hospital
  if (receptionist.hospitalId.toString() !== adminHospital.hospitalId.toString()) {
    return next(new AppError(messages.user.cannotDeleteOtherHospitalAdmins, 403));
  }

  //  Delete receptionist
  await receptionist.deleteOne();

  //  Return success response
  return res.status(200).json({
    message: messages.user.deleted,
    success: true,
  });
};

// Get Admin Hospital Profile
export const getAdminHospitalProfile = async (req, res, next) => {
  const adminHospitalId = req.authUser._id;

  // Find admin hospital
  const adminHospital = await User.findById(adminHospitalId);
  if (!adminHospital) {
    return next(new AppError(messages.admin.notExist, 404));
  }

  // Ensure role is ADMIN_HOSPITAL
  if (adminHospital.role !== roles.ADMIN_HOSPITAL) {
    return next(new AppError(messages.user.unauthorized, 403));
  }

  // Hide password
  adminHospital.password = undefined;

  return res.status(200).json({
    message: messages.admin.fetchedSuccessfully,
    success: true,
    data: adminHospital,
  });
};
