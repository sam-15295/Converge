// Turns an error thrown by apiRequest into something a form can show:
//   { fields: { email: 'Email is not valid' }, form: null }   validation errors, one message per input
//   { fields: {}, form: 'Invalid Credentials' }               any other error, one message for the form
export const parseApiError = (err)=>{
    if(err.errors && Object.keys(err.errors).length > 0){
        return { fields: err.errors, form: null };
    }
    return { fields: {}, form: err.message || "Something went wrong" };
}
