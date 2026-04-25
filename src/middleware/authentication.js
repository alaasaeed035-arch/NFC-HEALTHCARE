import { User, Patient, Doctor } from "../../db/index.js"
import { AppError } from "../utils/appError.js"
import { messages } from "../utils/constant/messages.js"
import { verifyToken } from "../utils/token.js"

export const isAuthenticated = () => {
    return async (req, res, next) => {
        const { token } = req.headers
        if (!token) {
            return next(new AppError("token not provided", 401))
        }
        
        const payload = verifyToken( token )
        if (payload.message) {
            return next(new AppError(payload.message, 401))
        }

        let authUser = null
        const model = payload.model

        // Look up account in the correct collection — no isVerified gate
        // so ALL patients, doctors, and users can authenticate
        if (model === 'USER') {
            authUser = await User.findById(payload._id)
        } else if (model === 'DOCTOR') {
            authUser = await Doctor.findById(payload._id)
        } else if (model === 'PATIENT') {
            authUser = await Patient.findById(payload._id)
        } else {
            // Fallback: try all collections when model is not specified
            authUser = await User.findById(payload._id)
            if (!authUser) {
                authUser = await Doctor.findById(payload._id)
            }
            if (!authUser) {
                authUser = await Patient.findById(payload._id)
            }
        }
        
        if (!authUser) {
            return next(new AppError(messages.user.notExist, 404))
        }
        
        req.authUser = authUser
        next()
    }
}