import User from "../models/authmodel.js"
import bcrypt from "bcrypt"

// Login controller//

const Login= async (req,res)=>{
    
    try{
        const {email,password}=req.body
        if(!email || !password){
            return res.status(404).json({msg:"please fill all the fields"})
    }
    const existingUser= await User.findOne({email})
    if(existingUser){
        const checkPassword= await bcrypt.compare(password,existingUser.password)
        if(!checkPassword){
            return res.status(404).json({msg:"login unsuccesfull"})
        } 
        return res.status(200).json({msg:"login succesfully",existingUser})
    }else{
        return res.status(404).json({msg:"login unsuccesfull"})

    }
}catch(error){
    return res.status(400).json({error:error})
}
}

// Register controller//

const Register= async (req,res)=>{  
    try{    
        const {name,email,password}=req.body
       const oldUser= await User.findOne({email})
       if(oldUser){
        return res.status(400).json({msg:"user already exist"})
       }

       const hashedPassword= await bcrypt.hash(password,10) 

       const data= await User.create({name,email,password:hashedPassword})

        if (data){
            return res.status(201).json({msg:"register succesfully",data})
        }else{
            return res.status(400).json({msg:"register unsuccesfull"})
        }}
        catch(e){
            return res.status(400).json({error:e})
        }
    }

const allUsers = async (req, res) => {
  try {
    const allUsers = await User.find()
    if (allUsers) {
      return res.status(200).json
      ({ msg: "all users", allUsers })
    } else {
      return res.status(404).json
      ({ msg: "no user found" })
    }
  } catch (error) {
    return res.status(404).json
    ({ error: error })
  }
}


export {Login,Register,allUsers}