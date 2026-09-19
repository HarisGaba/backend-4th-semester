import mongoose from "mongoose";


const forgetSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true,
        match:[/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,"please enter a valid email address"]
    },
    otp:{
        type:Number,
        required:true,
        max:9999
    }
},{timestamps:true})

export default mongoose.model("forget",forgetSchema)