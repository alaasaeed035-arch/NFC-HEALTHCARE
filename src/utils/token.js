import jwt from 'jsonwebtoken';

// fn to generate token 
export const generateToken = ({ payload, secretKey = process.env.JWT_SECRET }) => {
    return jwt.sign(payload, secretKey);
}

// fn to verify token
export const verifyToken = (token, secretkey = process.env.JWT_SECRET) => {
    try {
        return jwt.verify(token, secretkey); // Returns the decoded payload if valid
    } catch (error) {
        // console.error('Token verification failed:', error.message);
        return { message: error.message }
    }
}