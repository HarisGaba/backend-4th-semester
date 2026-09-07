import express from 'express';
import database from './src/configs/dbconfig.js';
import "dotenv/config"

const app=express();
const port=process.env.PORT


app.get('/',(req,res)=>{
    res.status(200).json({msg:"working"})
})

database()


app.listen(port,()=>{
    console.log(`http://localhost:${port}`);
})
