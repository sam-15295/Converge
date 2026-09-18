import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        trim : true,
        maxlength : 50
    },

    // lowercase + trim : "Amit@X.com " and "amit@x.com" are the same account
    // unique : creates a unique index, so the database itself refuses duplicate emails
    email : {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true
    },

    // stores the bcrypt hash, never the real password
    // select false : queries do not return it unless we ask with .select("+password")
    password : {
        type : String,
        required : true,
        select : false
    }
}, {timestamps : true});

const User = mongoose.model("User", userSchema);

export default User;
