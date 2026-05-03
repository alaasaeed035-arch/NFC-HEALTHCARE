import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constant/messages.js";
import { roles } from "../../utils/constant/enum.js";
import { User, Card } from "../../../db/index.js";
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

  const token = generateToken({ payload: { _id: superAdmin._id, role: superAdmin.role, model: 'USER' } });

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
  const admin = await User.findOne({ email, role: roles.ADMIN });
  if (!admin) {
    return next(new AppError(messages.user.notExist, 404));
  }

  // Compare password
  const isPasswordValid = bcrypt.compareSync(password, admin.password);
  if (!isPasswordValid) {
    return next(new AppError(messages.user.passwordInvalid, 400));
  }

  // Generate token
  const token = generateToken({ payload: { _id: admin._id, role: admin.role, model: 'USER' } });

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

// Get all hospital admins
export const getAllHospitalAdmins = async (req, res, next) => {
  const admins = await User.find({ role: roles.ADMIN_HOSPITAL }).select('-password').populate('hospitalId', 'name');
  return res.status(200).json({
    message: 'Hospital admins fetched successfully',
    success: true,
    count: admins.length,
    data: admins,
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


// Delete Hospital Admin (ADMIN or SUPER_ADMIN only)
export const deleteHospitalAdmin = async (req, res, next) => {
  const { adminId } = req.params;

  const target = await User.findById(adminId);
  if (!target) {
    return next(new AppError(messages.admin.notExist, 404));
  }

  if (target.role !== roles.ADMIN_HOSPITAL) {
    return next(new AppError(messages.admin.canOnlyDeleteAdmins, 403));
  }

  await target.deleteOne();

  return res.status(200).json({
    message: messages.admin.deletedSuccessfully,
    success: true,
  });
};


// Generate NFC Cards (ADMIN / SUPER_ADMIN)
export const generateCards = async (req, res, next) => {
  const count = Math.min(parseInt(req.body.count) || 1, 100);

  const makeCardNumber = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rand = crypto.randomBytes(8).toString("hex").toUpperCase();
    let result = "NFC-";
    for (let i = 0; i < 8; i++) {
      result += chars[parseInt(rand[i], 16) % chars.length];
    }
    return result;
  };

  const cards = [];
  let attempts = 0;
  while (cards.length < count && attempts < count * 5) {
    attempts++;
    const cardNumber = makeCardNumber();
    const exists = await Card.findOne({ cardNumber });
    if (!exists) {
      cards.push({ cardNumber });
    }
  }

  const created = await Card.insertMany(cards);

  return res.status(201).json({
    success: true,
    message: `${created.length} card(s) generated successfully.`,
    count: created.length,
    data: created,
  });
};

// Assign physical NFC UID to a card (ADMIN / SUPER_ADMIN)
export const scanCard = async (req, res, next) => {
  const { id } = req.params;
  const { nfcUid } = req.body;

  if (!nfcUid) return next(new AppError('NFC UID is required', 400));

  // Check uniqueness — same chip must not be assigned to two card numbers
  const duplicate = await Card.findOne({ nfcUid });
  if (duplicate && duplicate._id.toString() !== id) {
    return next(new AppError('This NFC chip is already assigned to another card.', 409));
  }

  const card = await Card.findByIdAndUpdate(id, { nfcUid }, { new: true });
  if (!card) return next(new AppError('Card not found', 404));

  return res.status(200).json({
    success: true,
    message: 'NFC chip assigned successfully.',
    data: card,
  });
};

// Get All Cards (ADMIN / SUPER_ADMIN)
export const getCards = async (req, res, next) => {
  const { status } = req.query; // 'linked' | 'available'
  const filter = {};
  if (status === "linked") filter.isLinked = true;
  if (status === "available") filter.isLinked = false;

  const cards = await Card.find(filter)
    .populate("patientId", "firstName lastName nationalId")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: cards.length,
    data: cards,
  });
};

// Hospital Admin Login
export const loginHospitalAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  // Find the user with role ADMIN_HOSPITAL
  const adminHospital = await User.findOne({
    email,
    role: roles.ADMIN_HOSPITAL,
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
    payload: { _id: adminHospital._id, role: adminHospital.role, model: 'USER' },
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

