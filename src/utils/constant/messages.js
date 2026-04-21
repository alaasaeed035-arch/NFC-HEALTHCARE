const generateMessage = (entity) => ({
    alreadyExist: `${entity} already exist`,
    notExist: `${entity} not found`,
    created: `${entity} created successfully`,
    failToCreate: `Failed to create ${entity}`,
    updated: `${entity} updated successfully`,
    failToUpdate: `Failed to update ${entity}`,
    deleted: `${entity} deleted successfully`,
    failToDelete: `Failed to delete ${entity}`,
    fetchedSuccessfully: `${entity} fetched successfully`,
    failToFetch: `${entity} failed to fetch`
});


export const messages = {
    patient :{
        ...generateMessage('Patient'),
        loginSuccessfully: 'Patient logged in successfully',
        accountCreated: 'Patient account created successfully',
        passwordReset: 'Patient password reset successfully',
        cardIdTaken: 'Card ID is already taken',
        nationalIdTaken: 'National ID is already taken',
    },
    doctor: {
        ...generateMessage('Doctor'),
        accountCreated: 'Doctor account created successfully',
        loginSuccessfully: 'Doctor logged in successfully',
        otpSent: 'OTP has been sent to your email',
        invalidOTP: 'The provided OTP is invalid or has expired',
        samePassword: 'The new password cannot be the same as the old password',
        passwordUpdated: 'Doctor password updated successfully',
        emailTaken: 'Email is already taken',
        notInHospital: 'Doctor does not belong to the specified hospital',
        patientAssigned: 'Patient assigned to doctor successfully',
        patientsFetched: "Doctor's patients fetched successfully",

    },
    user :{
        ...generateMessage('User'),
        invalidToken: 'Invalid token provided',
        notVerified: 'User account is not verified',
        invalidCredentials: 'Invalid credentials provided',
        loginSuccess: 'User logged in successfully',
        passwordInvalid: 'Invalid password provided',
        unauthorized: 'You are not authorized to perform this action',
        cannotCreateAdminHospital: 'Only SUPER_ADMIN or ADMIN can create hospital admins',
        emailTaken: 'Email is already taken',
        cannotDeleteOtherHospitalAdmins: 'You can only delete hospital admins created by you',
        canOnlyDeleteReceptionists: 'You can only delete receptionists',
    },
    admin :{
        ...generateMessage('Admin'),
        deletedSuccessfully: 'Admin deleted successfully',
        cannotDeleteSuperAdmin: 'You cannot delete a SUPER_ADMIN',
        canOnlyDeleteAdmins: 'You can only delete admins',
    },
    hospital :{
        ...generateMessage('Hospital'),
        emailTaken: 'Email is already taken',
        nameTaken: 'Hospital name is already taken',
    },
    medicalRecord :{
        ...generateMessage('Medical record'),
        cannotUpdate: 'You are not authorized to update this medical record',
        cannotDeleteOthers : 'You are not authorized to delete this medical record',
    }

}