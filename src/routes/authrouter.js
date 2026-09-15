import express from "express";
import { Login, Register } from "../controllers/authcontroller.js";

const authRouter=express.Router()

authRouter.post("/login",Login)
authRouter.post("/register",Register)

export default authRouter