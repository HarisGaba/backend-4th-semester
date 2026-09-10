import express from "express";
import { login } from "../controllers/authcontroller.js";

const authrouter=express.Router()

authrouter.get("/login",login)

export default authrouter
