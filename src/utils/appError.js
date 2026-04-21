export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode || 500;
        this.success = false;
    }
}

// globalErrorHandling
export const globalErrorHandling = async (err, req, res, next) => {

    return res.status(err.statusCode || 500).json({
        message: err.message,
        success: false
    })

}