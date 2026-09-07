import mongoose from "mongoose";
import "dotenv/config"


const database=()=>mongoose.connect(process.env.MONGODB_URL)
.then(() => console.log('Database Connected!'));


export default database