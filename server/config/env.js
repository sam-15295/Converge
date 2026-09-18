import dotenv from "dotenv";
import {z} from "zod";

dotenv.config({quiet : true});

// Every environment variable the server reads is declared and checked here.
// If one is missing or wrong, the server stops immediately with a clear message.
const envSchema = z.object({
    NODE_ENV : z.enum(["development", "test", "production"]).default("development"),
    PORT : z.coerce.number().int().positive().default(5000),
    MONGODB_URI : z.string().min(1, "MONGODB_URI is required"),
    CLIENT_URL : z.string().url().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if(!parsed.success){
    const problems = parsed.error.issues
    .map((issue)=> `  - ${issue.path.join(".")} : ${issue.message}`)
    .join("\n");

    console.error(`Invalid environment configuration:\n${problems}`);
    process.exit(1);
}

const env = parsed.data;

export default env;
