import bcrypt from "bcrypt";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";
import { roles } from "../../utils/constant/enum.js";
import { User } from "../../../db/index.js";
import { generateToken } from "../../utils/token.js";

// // Signup Super Admin
// export const signupSuperAdmin = async (req, res, next) => {
//   const { fullName, email, password, phoneNumber } = req.body;

//   // Check if email or fullName exists
//   const existingUser = await User.findOne({ $or: [{ email }, { fullName }] });
//   if (existingUser) {
//     return next(new AppError(messages.user.alreadyExist, 400));
//   }

//   // Optional: check password manually
//   if (!password || password.length < 6) {
//     return next(new AppError(messages.user.passwordInvalid, 400));
//   }

//   const hashedPassword = bcrypt.hashSync(password, 8);

//   // Create SUPER_ADMIN
//   const superAdmin = new User({
//     fullName,
//     email,
//     password: hashedPassword,
//     phoneNumber,
//     role: roles.SUPER_ADMIN,
//     isVerified: true
//   });

//   const savedAdmin = await superAdmin.save();
//   if (!savedAdmin) {
//     return next(new AppError(messages.user.failToCreate, 500));
//   }

//   res.status(201).json({
//     message: messages.user.created,
//     success: true,
//     data: savedAdmin
//   });
// };



// Login Super Admin
export const loginSuperAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  const superAdmin = await User.findOne({ email, role: roles.SUPER_ADMIN });
  if (!superAdmin) {
    return next(new AppError(messages.user.notExist, 404));
  }

  const isPasswordValid = bcrypt.compareSync(password, superAdmin.password);
  if (!isPasswordValid) {
    return next(new AppError(messages.user.passwordInvalid, 400)); // Friendly message
  }

  const token = generateToken({ payload: { _id: superAdmin._id, role: superAdmin.role } });

  res.status(200).json({
    message: messages.user.loginSuccess,
    success: true,
    token,
  });
};


// create admin
export const createAdmin = async (req, res, next) => {
  const { fullName, email, password, phoneNumber } = req.body;

  // Check if admin already exists
  const existingUser = await User.findOne({ $or: [{ email }, { fullName }] });
  if (existingUser) {
    return next(new AppError(messages.user.alreadyExist, 400));
  }

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Create admin
  const admin = new User({
    fullName,
    email,
    password: hashedPassword,
    phoneNumber,
    role: roles.ADMIN,
    isVerified: true
  });

  // Save to DB
  const adminCreated = await admin.save();
  if (!adminCreated) {
    return next(new AppError(messages.user.failToCreate, 500));
  }

  // Return response without token
  return res.status(201).json({
    message: messages.user.created,
    success: true,
    data: adminCreated
  });
};

// admin login
export const loginAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  // Check if admin exists
  const admin = await User.findOne({ email, role: roles.ADMIN, isVerified: true });
  if (!admin) {
    return next(new AppError(messages.user.notExist, 404));
  }

  // Compare password
  const isPasswordValid = bcrypt.compareSync(password, admin.password);
  if (!isPasswordValid) {
    return next(new AppError(messages.user.passwordInvalid, 400));
  }

  // Generate token
  const token = generateToken({ payload: { _id: admin._id, role: admin.role } });

  // Send response
  res.status(200).json({
    message: messages.user.loginSuccess,
    success: true,
    token,
  });
};


// Get all admins
export const getAllAdmin = async (req, res, next) => {
  // Fetch all users with role ADMIN
  const allAdmin = await User.find({ role: roles.ADMIN });

  // Check if any admin exists
  if (!allAdmin.length) {
    return next(new AppError(messages.admin.notExist, 404));
  }

  // Send response with count
  return res.status(200).json({
    message: messages.admin.fetchedSuccessfully,
    success: true,
    count: allAdmin.length, // count of admins
    data: allAdmin
  });
};

// Delete Admin by ID
export const deleteAdminById = async (req, res, next) => {
  const { adminId } = req.params; //  adminId instead of id

  // Find admin by ID
  const admin = await User.findOne({ _id: adminId });
  if (!admin) {
    return next(new AppError(messages.admin.notExist, 404));
  }

  // Prevent deleting SUPER_ADMIN
  if (admin.role === roles.SUPER_ADMIN) {
    return next(new AppError(messages.admin.cannotDeleteSuperAdmin, 403));
  }

  // Only admins can be deleted
  if (admin.role !== roles.ADMIN) {
    return next(new AppError(messages.admin.canOnlyDeleteAdmins, 403));
  }

  await User.deleteOne({ _id: adminId });

  return res.status(200).json({
    message: messages.admin.deletedSuccessfully,
    success: true,
  });
};

// Create Hospital Admin (SUPER_ADMIN or ADMIN only)
export const createAdminHospital = async (req, res, next) => {
  const { fullName, email, phoneNumber, password, hospitalId } = req.body;

  // Creator from auth middleware
  const creator = req.authUser;

  // Only SUPER_ADMIN or ADMIN can create hospital admins
  if (![roles.SUPER_ADMIN, roles.ADMIN].includes(creator.role)) {
    return next(new AppError(messages.user.cannotCreateAdminHospital, 403));
  }

  // Check if admin already exists
  const existing = await User.findOne({ $or: [{ email }, { fullName }] });
  if (existing) {
    return next(new AppError(messages.user.alreadyExist, 409));
  }

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Create hospital admin
  const adminHospital = new User({
    fullName,
    email,
    phoneNumber,
    password: hashedPassword,
    role: roles.ADMIN_HOSPITAL,
    hospitalId,  // link to a hospital
    isVerified: true,
  });

  const created = await adminHospital.save();
  if (!created) {
    return next(new AppError(messages.user.failToCreate, 500));
  }

  // Hide password
  created.password = undefined;

  return res.status(201).json({
    message: messages.user.created, 
    success: true,
    data: created,
  });
};


// Hospital Admin Login
export const loginHospitalAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  // Find the user with role ADMIN_HOSPITAL and verified
  const adminHospital = await User.findOne({
    email,
    role: roles.ADMIN_HOSPITAL,
    isVerified: true,
  });

  if (!adminHospital) {
    return next(new AppError(messages.user.notExist, 404));
  }

  // Compare password
  const isPasswordValid = bcrypt.compareSync(password, adminHospital.password);
  if (!isPasswordValid) {
    return next(new AppError(messages.user.passwordInvalid, 400));
  }

  // Generate token
  const token = generateToken({
    payload: { _id: adminHospital._id, role: adminHospital.role },
  });

  // Hide password in response
  adminHospital.password = undefined;

  // Send response
  res.status(200).json({
    message: messages.user.loginSuccess,
    success: true,
    token,
  });
};

