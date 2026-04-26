import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/appError.js';
import { messages } from '../../utils/constant/messages.js';
import { generateToken, verifyToken } from '../../utils/token.js';
import { Doctor, Hospital, Patient, User } from '../../../db/index.js';
import { roles } from '../../utils/constant/enum.js';
import { sendEmail } from '../../utils/sendEmail.js';
import { generateOTP, sendOTP } from '../../utils/OTP.js';



// patient signup
export const signupPatient = async (req, res, next) => {
  const { firstName, lastName, nationalId, gender, dateOfBirth, bloodType, phoneNumber, address, emergencyContact, cardId, surgerys, ChronicDiseases } = req.body;
  const hospitalId = req.authUser?.hospitalId ?? null;

  // check if patient already exists
  const orConditions = [{ nationalId }]
  if (cardId) orConditions.push({ cardId })
  const patientExist = await Patient.findOne({ $or: orConditions });

  if (patientExist) {
    return next(new AppError(messages.patient.alreadyExist, 409));
  }

  // create new patient
  const patient = new Patient({
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
    ChronicDiseases,
    role: roles.PATIENT,
    hospitalId,
  });

  // save patient
  const createdPatient = await patient.save();
  if (!createdPatient) {
    return next(new AppError(messages.patient.failToCreate, 500));
  }

  // generate token ONLY with nationalId
  const token = generateToken({
    payload: {
      nationalId: createdPatient.nationalId,
    },
  });

  // send response
  return res.status(201).json({
    message: messages.patient.accountCreated,
    success: true,
    data: createdPatient,
  });
};

// patient login
export const loginPatient = async (req, res, next) => {
  const { nationalId } = req.body;

  const patient = await Patient.findOne({ nationalId });

  if (!patient) {
    return next(new AppError(messages.patient.notExist, 404));
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
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.headers.host}`;
  await sendEmail({
    to: email,
    subject: "Verify your Doctor Account",
    html: `<p>Click the link to verify your account: <a href="${baseUrl}/auth/verify/${token}">Verify Account</a></p>`
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

// Forget Password (Doctor)
export const forgetPasswordDoctor = async (req, res, next) => {
  const { email } = req.body;

  // check existence
  const doctorExist = await Doctor.findOne({ email });
  if (!doctorExist) {
    return next(new AppError(messages.doctor.notExist, 401));
  }

  // generate OTP
  const otp = generateOTP();

  //  SEND EMAIL WITH OTP
  await sendOTP(doctorExist.email, otp);

  // save OTP + expiry
  doctorExist.otp = otp;
  doctorExist.otpExpires = Date.now() + 10 * 60 * 1000;

  const saved = await doctorExist.save();
  if (!saved) {
    return next(new AppError(messages.doctor.failToUpdate, 500));
  }

  return res.status(200).json({
    message: messages.doctor.otpSent,
    success: true,
  });
};

// Verify OTP & Reset Password (Doctor)
export const verifyOtpAndResetPasswordDoctor = async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  // find doctor (include password)
  const doctor = await Doctor.findOne({ email }).select("+password");
  if (!doctor) {
    return next(new AppError(messages.doctor.notExist, 404));
  }

  // convert otp to string to avoid mismatch (fixes most errors)
  const storedOtp = String(doctor.otp);
  const enteredOtp = String(otp);

  // check otp validity
  if (storedOtp !== enteredOtp || Date.now() > doctor.otpExpires) {
    return next(new AppError(messages.doctor.invalidOTP, 400));
  }

  // check new password is not same as old
  const isSame = await bcrypt.compare(newPassword, doctor.password);
  if (isSame) {
    return next(new AppError(messages.doctor.samePassword, 400));
  }

  // hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // update doctor password + clear otp
  doctor.password = hashedPassword;
  doctor.otp = undefined;
  doctor.otpExpires = undefined;

  const updated = await doctor.save();
  if (!updated) {
    return next(new AppError(messages.doctor.failToUpdate, 400));
  }

  return res.status(200).json({
    message: messages.doctor.passwordUpdated,
    success: true
  });
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

  // Check if cardId is changed → must not duplicate
  if (cardId && cardId !== patient.cardId) {
    const cardExists = await Patient.findOne({ cardId });
    if (cardExists) {
      return next(new AppError(messages.patient.cardIdTaken, 409));
    }
    patient.cardId = cardId;
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