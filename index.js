import express from "express";
import mongoose from "mongoose";
import Database from "./src/configs/dbconfig.js";
import "dotenv/config"
import authRouter from "./src/routes/authrouter.js";

const app=express();
const port=process.env.PORT
app.use(express.json())
app.use("/auth",authRouter)

Database()


app.listen(port,()=>{
    console.log(`http://localhost:${port}`);
})