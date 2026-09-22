
import express from "express";
import {resetPassword, verifyemail, verifyOtp} from "../controllers/forgetcontroller.js";

const forgetrouter = express.Router();

forgetrouter.post("/verifyemail",verifyemail)
forgetrouter.post("/verifyotp",verifyOtp)
forgetrouter.post("/resetPassword",resetPassword)

export default forgetrouter;