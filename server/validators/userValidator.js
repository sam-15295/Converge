import * as z from "zod";

export const emailSchema = z.preprocess(
    (val)=>{
        return typeof val == "string" ? val.trim().toLowerCase() : ""
    },
    z.email("Email is not valid")
);

const nameSchema = z.string()
.trim()
.min(1, "Name is required")
.max(50, "Length cannot be greater than 50 chars");

// bcrypt only reads the first 72 BYTES of a password and ignores the rest,
// so longer passwords are rejected (bytes, not characters : an emoji is 4 bytes)
const passwordSchema = z.string()
.min(8, "Length should be atleast 8")
.refine((val)=>Buffer.byteLength(val, "utf8") <= 72, "Password must be at most 72 bytes");

export const signupSchema = z.object({
    name : nameSchema,
    email : emailSchema,
    password : passwordSchema
});

// login only needs "something was typed", the password rules apply when creating a password
export const loginSchema = z.object({
    email : emailSchema,
    password : z.string().min(1, "Password is required")
});

export const updateProfileSchema = z.object({
    name : nameSchema
});
