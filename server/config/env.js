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

    // no default for the secret, a guessable default would let anyone forge a login
    JWT_SECRET : z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN_DAYS : z.coerce.number().int().positive().default(7),
    BCRYPT_ROUNDS : z.coerce.number().int().min(4).max(15).default(12),

    // failed login/signup attempts allowed per IP in 15 minutes
    AUTH_RATE_LIMIT_MAX : z.coerce.number().int().positive().default(10),

    // chat messages one person may send in 10 seconds
    CHAT_RATE_LIMIT_MAX : z.coerce.number().int().positive().default(30),

    // notification requests (list, count, mark as read) one person may make in a minute
    NOTIFICATION_RATE_LIMIT_MAX : z.coerce.number().int().positive().default(120),

    // Redis, used when the app runs as several servers at once (see config/redis.js).
    // Left out : one server, everything in memory, exactly as before.
    // An empty value means "not set" (the tests use that to be sure they never pick up a developer's own Redis);
    // a value that is there but wrong still fails loudly.
    REDIS_URL : z.preprocess((value)=> (value === "" ? undefined : value), z.string().url().optional()),

    // how often a server confirms that its people are still connected (the shared presence in Redis).
    // Anything not confirmed for three heartbeats is treated as gone, which is how a crashed server's people fade out.
    PRESENCE_HEARTBEAT_SECONDS : z.coerce.number().positive().default(15),

    // version history : how long a document must be quiet before the editing session counts as finished,
    // and the shortest time between two versions of the same document (see service/versionScheduler.js)
    VERSION_QUIET_SECONDS : z.coerce.number().positive().default(120),
    VERSION_MIN_GAP_SECONDS : z.coerce.number().positive().default(300)
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
