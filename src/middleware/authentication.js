import { User, Patient, Doctor } from "../../db/index.js"
import { AppError } from "../utils/appError.js"
import { messages } from "../utils/constant/messages.js"
import { verifyToken } from "../utils/token.js"

export const isAuthenticated = () => {
    return async (req, res, next) => {
        // token from headers
        const { token } = req.headers
        if (!token) {
            return next(new AppError("token not provided", 401))
        }
        // decoded token 
        const payload = verifyToken( token )
        // if token is valid
        if (payload.message) {
            return next(new AppError(payload.message, 401))
        }
        // check user exist in User collection
        let authUser = await User.findOne({ _id: payload._id, isVerified: true })
        
        // if not found in User, check Doctor collection
        if (!authUser) {
            authUser = await Doctor.findOne({ _id: payload._id, isVerified: true })
        }
        
        // if not found in Doctor, check Patient collection
        if (!authUser) {
            authUser = await Patient.findById(payload._id)
        }
        
        if (!authUser) {
            return next(new AppError(messages.user.notExist, 404))
        }
        // set user to req
        req.authUser = authUser
        next()
    }
}