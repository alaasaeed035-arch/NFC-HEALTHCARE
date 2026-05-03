import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/appError.js';
import { messages } from '../../utils/constant/messages.js';
import { generateToken, verifyToken } from '../../utils/token.js';
import { Card, Doctor, Hospital, Patient, User } from '../../../db/index.js';
import { roles } from '../../utils/constant/enum.js';
import { sendEmail } from '../../utils/sendEmail.js';
import { generateOTP, sendOTP } from '../../utils/OTP.js';



// patient signup — staff-initiated (auth required, no email/OTP)
export const signupPatient = async (req, res, next) => {
  const { firstName, lastName, nationalId, gender, dateOfBirth, bloodType, phoneNumber, address, emergencyContact, cardId, surgerys, ChronicDiseases } = req.body;
  const hospitalId = req.authUser?.hospitalId ?? null;

  const orConditions = [{ nationalId }]
  if (cardId) orConditions.push({ cardId })
  const patientExist = await Patient.findOne({ $or: orConditions });
  if (patientExist) {
    return next(new AppError(messages.patient.alreadyExist, 409));
  }

  // Validate card against generated cards pool
  if (cardId) {
    const card = await Card.findOne({ cardNumber: cardId });
    if (!card) {
      return next(new AppError('This card is not available.', 400));
    }
    if (card.isLinked) {
      return next(new AppError('This card is already linked to another patient.', 409));
    }
  }

  const patient = new Patient({
    firstName, lastName, nationalId, gender, dateOfBirth, bloodType,
    phoneNumber, address, emergencyContact, cardId, surgerys, ChronicDiseases,
    role: roles.PATIENT,
    hospitalId,
    isVerified: true,
  });

  const createdPatient = await patient.save();
  if (!createdPatient) {
    return next(new AppError(messages.patient.failToCreate, 500));
  }

  // Link card to patient
  if (cardId) {
    await Card.findOneAndUpdate({ cardNumber: cardId }, { isLinked: true, patientId: createdPatient._id });
  }

  return res.status(201).json({
    message: messages.patient.accountCreated,
    success: true,
    data: createdPatient,
  });
};

// patient self-registration (public — email + password + OTP)
export const selfSignupPatient = async (req, res, next) => {
  const { firstName, lastName, nationalId, email, password, gender, dateOfBirth, bloodType, phoneNumber, address, emergencyContact, cardId, surgerys, ChronicDiseases } = req.body;

  const orConditions = [{ nationalId }, { email }];
  if (cardId) orConditions.push({ cardId });
  const patientExist = await Patient.findOne({ $or: orConditions });
  if (patientExist) {
    return next(new AppError(messages.patient.alreadyExist, 409));
  }

  // Validate card against generated cards pool
  if (cardId) {
    const card = await Card.findOne({ cardNumber: cardId });
    if (!card) {
      return next(new AppError('This card is not available.', 400));
    }
    if (card.isLinked) {
      return next(new AppError('This card is already linked to another patient.', 409));
    }
  }

  const hashedPassword = bcrypt.hashSync(password, 8);
  const otp = generateOTP();

  const patient = new Patient({
    firstName, lastName, nationalId, email, password: hashedPassword,
    gender, dateOfBirth, bloodType, phoneNumber, address, emergencyContact,
    cardId, surgerys, ChronicDiseases,
    role: roles.PATIENT,
    hospitalId: null,
    isVerified: false,
    otp,
    otpExpires: Date.now() + 10 * 60 * 1000,
  });

  const createdPatient = await patient.save();
  if (!createdPatient) {
    return next(new AppError(messages.patient.failToCreate, 500));
  }

  // Link card to patient (card will be fully confirmed after OTP verification)
  if (cardId) {
    await Card.findOneAndUpdate({ cardNumber: cardId }, { isLinked: true, patientId: createdPatient._id });
  }

  await sendOTP(email, otp);

  return res.status(201).json({
    message: 'Account created. A verification code was sent to your email.',
    success: true,
    data: { email: createdPatient.email },
  });
};

// verify patient OTP
export const verifyPatientOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  const patient = await Patient.findOne({ email });
  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  if (patient.isVerified) {
    return next(new AppError('Account is already verified.', 400));
  }

  if (String(patient.otp) !== String(otp) || Date.now() > new Date(patient.otpExpires).getTime()) {
    return next(new AppError('Invalid or expired OTP.', 400));
  }

  patient.isVerified = true;
  patient.otp = undefined;
  patient.otpExpires = undefined;
  await patient.save();

  const token = generateToken({
    payload: { _id: patient._id, nationalId: patient.nationalId, model: 'PATIENT' }
  });

  return res.status(200).json({
    message: 'Email verified successfully. You are now logged in.',
    success: true,
    token,
  });
};

// resend patient OTP
export const resendPatientOtp = async (req, res, next) => {
  const { email } = req.body;

  const patient = await Patient.findOne({ email });
  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  if (patient.isVerified) {
    return next(new AppError('Account is already verified.', 400));
  }

  const otp = generateOTP();
  patient.otp = otp;
  patient.otpExpires = Date.now() + 10 * 60 * 1000;
  await patient.save();

  await sendOTP(email, otp);

  return res.status(200).json({
    message: 'A new verification code has been sent to your email.',
    success: true,
  });
};

// patient login (email + password)
export const loginPatient = async (req, res, next) => {
  const { email, password } = req.body;

  const patient = await Patient.findOne({ email });
  if (!patient) {
    return next(new AppError(messages.user.invalidCredentials, 401));
  }

  if (!patient.password) {
    return next(new AppError(messages.user.invalidCredentials, 401));
  }

  const isPasswordValid = bcrypt.compareSync(password, patient.password);
  if (!isPasswordValid) {
    return next(new AppError(messages.user.invalidCredentials, 401));
  }

  if (!patient.isVerified) {
    return next(new AppError('Please verify your email before logging in.', 403));
  }

  const token = generateToken({
    payload: { _id: patient._id, nationalId: patient.nationalId, model: 'PATIENT' }
  });

  return res.status(200).json({
    message: messages.patient.loginSuccessfully,
    success: true,
    token
  });
};

// doctor signup
export const signupDoctor = async (req, res, next) => {
  // Get data from request
  const {
    firstName,
    lastName,
    specialization,
    phoneNumber,
    email,
    password,
    hospitalId
  } = req.body;

  // Validate hospitalId format then existence
  if (!hospitalId || !hospitalId.match(/^[a-fA-F0-9]{24}$/)) {
    return next(new AppError('Invalid hospitalId', 400));
  }
  const hospitalExists = await Hospital.findById(hospitalId);
  if (!hospitalExists) {
    return next(new AppError('Invalid hospitalId', 404));
  }

  // Check if doctor already exists (email or phone)
  const doctorExists = await Doctor.findOne({
    $or: [{ email }, { phoneNumber }]
  });
  if (doctorExists) {
    return next(new AppError(messages.doctor.alreadyExist, 409));
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Create new doctor
  const doctor = new Doctor({
    firstName,
    lastName,
    specialization,
    phoneNumber,
    email,
    password: hashedPassword,
    role: roles.DOCTOR,
    hospitalId
  });

  // Save to database
  const createdDoctor = await doctor.save();
  if (!createdDoctor) {
    return next(new AppError(messages.doctor.failToCreate, 500));
  }

  // Generate verification token
  const token = generateToken({
    payload: { email: createdDoctor.email, _id: createdDoctor._id }
  });

  // Send verification email
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  await sendEmail({
    to: email,
    subject: "Verify your Doctor Account",
    html: `<p>Click the link to verify your account: <a href="${frontendUrl}/verify-account?token=${token}">Verify Account</a></p>`
  });

  // Send response
  return res.status(201).json({
    message: messages.doctor.accountCreated,
    success: true,
    data: createdDoctor
  });
};

// verify doctor account
export const verifyDoctorAccount = async (req, res, next) => {
  const { token } = req.params;

  // Verify token
  const payload = verifyToken(token);

  if (!payload || !payload.email) {
    return next(new AppError(messages.user.invalidToken, 400));
  }

  // Find doctor by email (normalize email to lowercase)
  const updatedDoctor = await Doctor.findOneAndUpdate(
    { email: payload.email.toLowerCase() },
    { isVerified: true },
    { new: true }
  );

  if (!updatedDoctor) {
    return next(new AppError(messages.user.notExist, 404));
  }

  return res.status(200).send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; background-color: #f5f5f5; text-align: center; padding: 60px; color: #333; }
          h1 { color: #2e7d32; }
          p { font-size: 18px; }
        </style>
      </head>
      <body>
        <h1>✅ Doctor Account Verified Successfully</h1>
        <p>Your account is now active. You can log in anytime.</p>
      </body>
    </html>
  `);
};

// LOGIN 
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  let account = null;
  let accountType = null;

  //  Try User collection first (admin, super_admin, admin_hospital, receptionist)
  //  Search by email OR fullName since admin accounts use fullName as username
  account = await User.findOne({
    $or: [{ email: email }, { fullName: email }],
  });
  if (account) {
    accountType = "USER";
  }

  //  If not found → try Doctor collection
  if (!account) {
    account = await Doctor.findOne({ email });
    if (account) {
      accountType = "DOCTOR";
    }
  }

  //  If not found → try Patient collection (patients with email)
  if (!account) {
    account = await Patient.findOne({ email });
    if (account) {
      accountType = "PATIENT";
    }
  }

  //  If still not found
  if (!account) {
    return next(new AppError(messages.user.invalidCredentials, 401));
  }

  //  Check password (skip if account has no password, e.g. patient with nationalId-only login)
  if (account.password) {
    const isPasswordValid = bcrypt.compareSync(password, account.password);
    if (!isPasswordValid) {
      return next(new AppError(messages.user.invalidCredentials, 401));
    }
  } else {
    return next(new AppError(messages.user.invalidCredentials, 401));
  }

  //  Block unverified doctors
  if (accountType === 'DOCTOR' && !account.isVerified) {
    return next(new AppError('Your account is not verified. Please check your email and click the verification link.', 403));
  }

  //  Generate token
  const token = generateToken({
    payload: {
      _id: account._id,
      role: account.role,
      hospitalId: account.hospitalId || null,
      model: accountType, // VERY IMPORTANT
    },
  });

  //  Hide password
  account.password = undefined;

  //  Response
  return res.status(200).json({
    message: messages.user.loginSuccess,
    success: true,
    token,
  });
};


// get profile patient
export const getPatientProfile = async (req, res, next) => {
  // get data from req
  const patient = req.authUser._id;
  // check existence
  const patientExist = await Patient.findById(patient)
  if (!patientExist) {
    return next(new AppError(messages.patient.notExist, 404))
  }
  // send res 
  return res.status(200).json({
    message: messages.patient.fetchedSuccessfully,
    success: true,
    data: patientExist
  })
}

// get profile doctor
export const getProfileDoctor = async (req, res, next) => {
  // get data from req
  const doctor = req.authUser._id;
  // check existence
  const doctorExist = await Doctor.findById(doctor)
  if (!doctorExist) {
    return next(new AppError(messages.doctor.notExist, 404))
  }
  // send res 
  return res.status(200).json({
    message: messages.doctor.fetchedSuccessfully,
    success: true,
    data: doctorExist
  })
}

// Forget Password (any staff — Doctor or User model)
export const forgetPasswordDoctor = async (req, res, next) => {
  const { email } = req.body;

  let account = await Doctor.findOne({ email });
  if (!account) account = await User.findOne({ email });
  if (!account) {
    return next(new AppError('No staff account found with this email', 404));
  }

  const otp = generateOTP();
  await sendOTP(account.email, otp);
  account.otp = otp;
  account.otpExpires = Date.now() + 10 * 60 * 1000;
  await account.save();

  return res.status(200).json({
    message: 'OTP sent to your email',
    success: true,
  });
};

// Verify OTP & Reset Password (any staff — Doctor or User model)
export const verifyOtpAndResetPasswordDoctor = async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  let account = await Doctor.findOne({ email });
  if (!account) account = await User.findOne({ email });
  if (!account) {
    return next(new AppError('No staff account found with this email', 404));
  }

  const storedOtp = String(account.otp);
  const enteredOtp = String(otp);

  if (storedOtp !== enteredOtp || Date.now() > new Date(account.otpExpires).getTime()) {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  const isSame = await bcrypt.compare(newPassword, account.password);
  if (isSame) {
    return next(new AppError('New password must differ from your current password', 400));
  }

  account.password = await bcrypt.hash(newPassword, 10);
  account.otp = undefined;
  account.otpExpires = undefined;
  await account.save();

  return res.status(200).json({
    message: 'Password updated successfully',
    success: true
  });
};


// Forget Password — any staff role (Doctor or User model)
export const forgetPasswordStaff = async (req, res, next) => {
  const { email } = req.body;

  let account = await Doctor.findOne({ email });
  if (!account) account = await User.findOne({ email });
  if (!account) return next(new AppError('No staff account found with this email', 404));

  const otp = generateOTP();
  await sendOTP(account.email, otp);
  account.otp = otp;
  account.otpExpires = Date.now() + 10 * 60 * 1000;
  await account.save();

  return res.status(200).json({ success: true, message: 'OTP sent to your email' });
};

// Reset Password — any staff role (Doctor or User model)
export const resetPasswordStaff = async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  let account = await Doctor.findOne({ email }).select('+password');
  if (!account) account = await User.findOne({ email }).select('+password');
  if (!account) return next(new AppError('No staff account found with this email', 404));

  if (String(account.otp) !== String(otp) || Date.now() > account.otpExpires) {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  const isSame = await bcrypt.compare(newPassword, account.password);
  if (isSame) return next(new AppError('New password must differ from current password', 400));

  account.password = await bcrypt.hash(newPassword, 10);
  account.otp = undefined;
  account.otpExpires = undefined;
  await account.save();

  return res.status(200).json({ success: true, message: 'Password updated successfully' });
};

// Update Patient Profile
export const updatePatientProfile = async (req, res, next) => {
  const patientId = req.authUser._id; // patient from auth middleware
  const {
    firstName,
    lastName,
    nationalId,
    gender,
    dateOfBirth,
    bloodType,
    phoneNumber,
    address,
    emergencyContact,
    cardId,
    surgerys,
    ChronicDiseases
  } = req.body;

  // Find patient
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  // Check if nationalId is changed → must not duplicate
  if (nationalId && nationalId !== patient.nationalId) {
    const idExists = await Patient.findOne({ nationalId });
    if (idExists) {
      return next(new AppError(messages.patient.nationalIdTaken, 409));
    }
    patient.nationalId = nationalId;
  }

  // Check if cardId is changed → validate against Card pool and unlink old
  let newCardLinked = false;
  if (cardId && cardId !== patient.cardId) {
    const card = await Card.findOne({ cardNumber: cardId });
    if (!card) {
      return next(new AppError('This card is not available.', 400));
    }
    if (card.isLinked) {
      return next(new AppError('This card is already linked to another patient.', 409));
    }
    // Unlink old card if any
    if (patient.cardId) {
      await Card.findOneAndUpdate({ cardNumber: patient.cardId }, { isLinked: false, patientId: null });
    }
    patient.cardId = cardId;
    newCardLinked = true;
  }

  // UPDATE NORMAL FIELDS
  if (firstName) patient.firstName = firstName;
  if (lastName) patient.lastName = lastName;
  if (gender) patient.gender = gender;
  if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
  if (bloodType) patient.bloodType = bloodType;
  if (phoneNumber) patient.phoneNumber = phoneNumber;
  if (address) patient.address = address;

  // UPDATE emergencyContact (nested object) 
  if (emergencyContact) {
    patient.emergencyContact = {
      name: emergencyContact.name || patient.emergencyContact?.name,
      phone: emergencyContact.phone || patient.emergencyContact?.phone,
      relation: emergencyContact.relation || patient.emergencyContact?.relation,
    };
  }

  // UPDATE ARRAYS 
  if (surgerys) patient.surgerys = surgerys; // must be an array
  if (ChronicDiseases) patient.ChronicDiseases = ChronicDiseases; // must be an array

  // SAVE
  const updatedPatient = await patient.save();
  if (!updatedPatient) {
    return next(new AppError(messages.patient.failToUpdate, 500));
  }

  // Link new card after save
  if (newCardLinked) {
    await Card.findOneAndUpdate({ cardNumber: cardId }, { isLinked: true, patientId: updatedPatient._id });
  }

  // SEND RESPONSE
  return res.status(200).json({
    message: messages.patient.updated,
    success: true,
    data: updatedPatient,
  });
};


// Update Doctor Profile 
export const updateDoctorProfile = async (req, res, next) => {
  const doctorId = req.authUser._id; // doctor from auth middleware
  const { firstName, lastName, specialization, phoneNumber, hospitalId } = req.body;

  // Find doctor
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    return next(new AppError(messages.doctor.notExist, 404));
  }

  // Update allowed fields
  if (firstName) doctor.firstName = firstName;
  if (lastName) doctor.lastName = lastName;
  if (specialization) doctor.specialization = specialization;
  if (phoneNumber) doctor.phoneNumber = phoneNumber;
  if (hospitalId) doctor.hospitalId = hospitalId;

  // Save changes
  const updatedDoctor = await doctor.save();
  if (!updatedDoctor) {
    return next(new AppError(messages.doctor.failToUpdate, 500));
  }

  return res.status(200).json({
    message: messages.doctor.updated,
    success: true,
    data: updatedDoctor,
  });
};

// Get All Patients
export const getAllPatients = async (req, res, next) => {
  const patients = await Patient.find();
  return res.status(200).json({
    message: "Patients fetched successfully",
    success: true,
    data: patients
  });
};

// Get All Doctors
export const getAllDoctors = async (req, res, next) => {
  // Populate hospital info if needed
  const doctors = await Doctor.find().populate("hospitalId");
  return res.status(200).json({
    message: "Doctors fetched successfully",
    success: true,
    data: doctors
  });
};

// Get All Receptionists (ADMIN / SUPER_ADMIN)
export const getAllReceptionists = async (req, res, next) => {
  const receptionists = await User.find({ role: roles.RECEPTIONIST }).select('-password').populate('hospitalId', 'name');
  const data = receptionists.map(r => {
    const obj = r.toObject()
    const parts = (obj.fullName || '').trim().split(/\s+/)
    obj.firstName = parts[0] || ''
    obj.lastName = parts.slice(1).join(' ') || ''
    return obj
  })
  return res.status(200).json({
    message: "Receptionists fetched successfully",
    success: true,
    count: data.length,
    data,
  });
};

// Get current user profile (works for any role)
export const getMyProfile = async (req, res, next) => {
  let profile
  if (req.authUser.toObject) {
    profile = { ...req.authUser.toObject() }
  } else {
    profile = { ...req.authUser }
  }
  delete profile.password
  delete profile.otp
  delete profile.otpExpires
  return res.status(200).json({
    success: true,
    data: profile,
  });
};

// Get patient by National ID (used by NFC scan / receptionist lookup)
export const getPatientByNationalId = async (req, res, next) => {
  const { nationalId } = req.params;

  const patient = await Patient.findOne({ nationalId });
  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  return res.status(200).json({
    success: true,
    message: messages.patient.fetchedSuccessfully,
    data: patient,
  });
};

// Get patient by NFC card UID (cardId field) — legacy, kept for backward compat
export const getPatientByCardId = async (req, res, next) => {
  const { cardId } = req.params;

  const patient = await Patient.findOne({ cardId });
  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
  }

  return res.status(200).json({
    success: true,
    message: messages.patient.fetchedSuccessfully,
    data: patient,
  });
};

// Get patient by physical NFC chip UID (ACR122U scan)
// 1st: Card.nfcUid → Card.patientId → Patient  (new flow: admin scanned the chip)
// 2nd: Patient.cardId = uid directly            (fallback for existing patients)
export const getPatientByNfcUid = async (req, res, next) => {
  const { nfcUid } = req.params;

  // Try the card registry first
  const card = await Card.findOne({ nfcUid });
  if (card && card.patientId) {
    const patient = await Patient.findById(card.patientId);
    if (patient) {
      return res.status(200).json({
        success: true,
        message: messages.patient.fetchedSuccessfully,
        data: patient,
      });
    }
  }

  // Fallback: patient's cardId field holds the UID directly
  const patient = await Patient.findOne({ cardId: nfcUid });
  if (patient) {
    return res.status(200).json({
      success: true,
      message: messages.patient.fetchedSuccessfully,
      data: patient,
    });
  }

  return next(new AppError(messages.patient.notExist, 404));
};