// Turns a Zod error into { email : "Email is not valid", password : "..." }
// so the frontend can show each message under its own input.
// Only the first message of every field is kept.
const formatZodErrors = (error)=>{
    const errors = {};

    for(const issue of error.issues){
        const field = issue.path.join(".");

        if(!errors[field]){
            errors[field] = issue.message;
        }
    }

    return errors;
}

export default formatZodErrors;
