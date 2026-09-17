
import express from "express";
import {verifyemail} from "../controllers/forgetcontroller.js";

const forgetrouter = express.Router();

forgetrouter.post("/verifyemail",verifyemail)

export default forgetrouter;