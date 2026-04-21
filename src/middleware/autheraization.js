import { AppError } from "../utils/appError.js"
import { messages } from "../utils/constant/messages.js"

export const isAuthorized = (roles) => {
    return (req, res, next) => {
        // req >>> authUser
        if (!roles.includes(req.authUser.role)) {
            return next(new AppError(messages.user.unauthorized, 401))
        }
        next()
    }
}