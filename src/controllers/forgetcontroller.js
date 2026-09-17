import User from "../models/authmodel.js";
import forgetmodel from "../models/forgetmodel.js";
import otpGenerator from "otp-generator"; // Added missing import

const verifyemail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Please fill all the fields" });
        } 

        const exist = await User.findOne({ email });
        
        if (!exist) {
            return res.status(404).json({ error: "Email doesn't exist" });
        }

        // Generate a 4-digit OTP
        const otp = otpGenerator.generate(4, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });
        const existingOtp = await forgetmodel.findOne({ email });
        if (existingOtp) {
            const updateOtp = await forgetmodel.findByIdAndUpdate(
                existingOtp._id, { otp }, { new: true }
            );
            return res.status(200).json({ msg: "Email exists, OTP updated", updateOtp });
        } else {
            const data = await forgetmodel.create({ email, otp });
            return res.status(200).json({ msg: "OTP sent", data });
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

export {verifyemail}