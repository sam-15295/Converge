import mongoose from "mongoose";

// The people a text (a chat message, a comment) mentions, chosen from the workspace's members : [{userId, displayName}].
// The displayName is a copy of the person's name AT THAT TIME (it is what the text says : "@Rahul"), so an old text keeps
// reading correctly even if the person renames themselves. Checked by services/mentionService.js before saving.
// Shared, so a chat message and a comment describe their mentions in exactly the same way.
const mentionsField = {
    type : [{
        _id : false,
        userId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User",
            required : true
        },
        displayName : {
            type : String,
            required : true
        }
    }],
    default : []
};

export default mentionsField;
