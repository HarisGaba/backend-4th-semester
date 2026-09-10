import express from 'express';
import database from './src/configs/dbconfig.js';
import "dotenv/config"
import authrouter from './src/routes/authrouter.js';

const app=express();
const port=process.env.PORT

app.use("/auth",authrouter)

database()


app.listen(port,()=>{
    console.log(`http://localhost:${port}`);
})
// http://localhost:3000/auth/login