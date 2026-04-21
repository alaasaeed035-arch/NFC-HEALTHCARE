import { customAlphabet } from "nanoid";
import { sendEmail } from "./sendEmail.js";


// Generate a random 6-digit OTP
export const generateOTP = customAlphabet("0123456789", 6);


// send otp via mail 
export const sendOTP = async (email, otp) => {
    const mailOptions = await sendEmail({
        to: email,
        subject: "🪪 NFC healthcare card - Your OTP Code",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f6fff0; text-align: center;">
            <h2 style="color: #1800f5ff;">🪪 NFC healthcare card</h2>
            <p style="font-size: 16px; color: #333;">
                Your One-Time Password (OTP) is:
            </p>
            <div style="font-size: 24px; font-weight: bold; color: #fff; background: #1800f5ff; padding: 12px; display: inline-block; border-radius: 8px; letter-spacing: 2px;">
                ${otp}
            </div>
            <p style="color: #555; font-size: 14px; margin-top: 10px;">
                This OTP is valid for <strong>10 minutes</strong>. Please do not share it with anyone.
            </p>
            <p style="color: #777; font-size: 14px;">
                If you did not request this code, you can ignore this email.
            </p>
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
                © 2024 NFC healthcare card. All rights reserved.
            </p>
        </div>
        `,
    });
};