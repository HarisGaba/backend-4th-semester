import nodemailer from "nodemailer";
import  "dotenv/config";

const transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS,
    }
})

const sendEmail = async (to,subject,html)=>{
    try{
        await transporter.sendMail({
            from:process.env.EMAIL_USER,
            to,
            subject,
            html,
        })
    }
    catch(e){
        console.log(e)
    }
}

export default sendEmail