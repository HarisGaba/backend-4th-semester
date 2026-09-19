import User from "../models/authmodel.js";
import forgetmodel from "../models/forgetmodel.js";
import otpGenerator from "otp-generator";
import bcrypt from "bcrypt";

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

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: "please fill all fields" });
        }

        const check = await forgetmodel.findOne({ email, otp });

        if (check) {
            return res.status(200).json({ msg: "Otp Verified" });
        } else {
            return res.status(400).json({ error: "please add correct otp" });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message || "something went wrong" });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(404).json({ error: "please fill all fields" });
        }
        const exists = await User.findOne({ email });
        if (!exists) {
            return res.status(404).json({ error: "email doesnot exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const updateUser = await User.findByIdAndUpdate(exists._id, { $set: { password: hashedPassword } }, { new: true });
        if (updateUser) {
            return res.status(200).json({ msg: "password reset", updateUser });
        } else {
            return res.status(400).json({ error: "something went wrong" });
        }

    } catch (error) {
        return res.status(500).json({ error: "something went wrong" });
    }
};

export { verifyemail, verifyOtp, resetPassword };