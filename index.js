import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
//const port = 3000;

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended : true}));
dotenv.config();

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

app.set("trust proxy", 1);
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        },
    })
);

const db = new pg.Client({
    user: "postgres.kwscdybwvxnfdszryixa",
    database: "postgres",
    host: "aws-1-us-east-2.pooler.supabase.com",
    password: process.env.DB_PASSWORD,
    port: 6543,
    ssl: { rejectUnauthorized: false },
});

let dbConnected = false;

async function connectDB() {
    // If we think we're connected, try a simple query to verify
    if (dbConnected) {
        try {
            await db.query("SELECT 1");
            return; // Connection is still alive
        } catch (err) {
            // Connection is dead, reset flag and reconnect
            dbConnected = false;
        }
    }
    
    try {
        // Validate required environment variables
        if (!process.env.DB_PASSWORD) {
            throw new Error("DB_PASSWORD environment variable is not set. Please configure it in Vercel.");
        }
        
        console.log(`Attempting to connect to database at: aws-1-us-east-2.pooler.supabase.com`);
        
        await db.connect();
        dbConnected = true;
        console.log("Database connected successfully");
    }
    catch(err) {
        // If error is "already connected", treat as success
        if (err.message && err.message.includes("already been connected")) {
            dbConnected = true;
            return;
        }
        
        // Provide helpful error messages for common issues
        let errorMessage = err.message;
        if (err.message && err.message.includes("ENOTFOUND")) {
            errorMessage = `Cannot resolve database hostname. Please check:\n` +
                          `1. Is your Supabase database active? (Free tier databases pause after inactivity)\n` +
                          `2. Verify the connection string in your Supabase dashboard (Settings → Database)\n` +
                          `Current host: aws-1-us-east-2.pooler.supabase.com`;
        }
        
        console.error("Database connection error:", errorMessage);
        console.error("Full error:", err.stack);
        dbConnected = false;
        throw new Error(errorMessage); // Re-throw with helpful message
    }
}

async function getShortenedLink(originalURL) {
    const result = await db.query(
        "INSERT INTO links (url) VALUES ($1) RETURNING id;",
        [originalURL]
    );

    const linkID = result.rows[0].id;
    const baseURL = process.env.TINY_URL;
    const shortenedURL = (baseURL.startsWith("http") ? baseURL : `https://${baseURL}`) + "/l/" + linkID;

    return shortenedURL;
}

function requireAuth(req, res, next) {
    if (req.session?.userId) return next();
    return res.redirect("/log-in");
}

// landing page
app.get("/", (req, res) => {
    if (req.session?.userId) return res.redirect("/home");
    res.render("landing.ejs");
});

app.get("/home", requireAuth, (req, res) => {
    res.render("home.ejs", { user: { name: req.session.username } });
});

// navigate to sign-up page
app.get("/sign-up", (req, res) => {
    if (req.session?.userId) return res.redirect("/home");
    res.render("sign-up.ejs");
});

// add new user to db
app.post("/sign-up-submit", async (req, res) => {
    const username = (req.body?.username || "").trim();
    const password = req.body?.password || "";
    const reenterpass = req.body?.["reenter-password"] || "";

    if (!username || !password) {
        return res.status(400).render("sign-up.ejs", { errmessage: "Username and password are required" });
    }

    if (password !== reenterpass) {
        return res.status(400).render("sign-up.ejs", { errmessage: "Passwords do not match" });
    }

    try {
        await connectDB();

        const existing = await db.query("SELECT 1 FROM users WHERE name = $1", [username]);
        if (existing.rowCount !== 0) {
            return res.status(409).render("sign-up.ejs", { errmessage: "Username is taken" });
        }

        await db.query("INSERT INTO users (name, password) VALUES ($1, $2);", [username, password]);
        return res.redirect("/log-in");
    } catch (err) {
        console.error("Error in /sign-up-submit:", err);
        return res.status(500).render("sign-up.ejs", { errmessage: "Could not create account" });
    }
});

// navigate to log in page
app.get("/log-in", (req, res) => {
    if (req.session?.userId) return res.redirect("/home");
    res.render("log-in.ejs");
});

// attempt to log in to account
app.post("/log-in-submit", async (req, res) => {
    const username = (req.body?.username || "").trim();
    const password = req.body?.password || "";

    if (!username || !password) {
        return res.status(400).render("log-in.ejs", { errmessage: "Username and password are required" });
    }

    try {
        await connectDB();
        const result = await db.query("SELECT id, name, password FROM users WHERE name = $1", [username]);

        if (result.rowCount === 0) {
            return res.status(401).render("log-in.ejs", { errmessage: "Username not found" });
        }

        const user = result.rows[0];
        if (password !== user.password) {
            return res.status(401).render("log-in.ejs", { errmessage: "Incorrect password" });
        }

        req.session.userId = user.id;
        req.session.username = user.name;
        return res.redirect("/home");
    } catch (err) {
        console.error("Error in /log-in-submit:", err);
        return res.status(500).render("log-in.ejs", { errmessage: "Could not log in" });
    }
});

app.post("/log-out", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// add link to db and return shortened version
app.post("/shorten-link", requireAuth, async(req, res) => {
    try {
        await connectDB();
        const newLink = req.body["link"];

        const shortenedURL = await getShortenedLink(newLink);

        res.render("home.ejs", { shortened : shortenedURL, user: { name: req.session.username } });
    } catch (err) {
        console.error("Error in /shorten-link:", err);
        res.status(500).send("Error shortening link: " + err.message);
    }
});

// shortened link in use
// navigate to stored link
app.get("/l/:id", async (req, res) => {
    try {
        await connectDB();
        const linkID = req.params.id;
        
        const result = await db.query(
            "SELECT url FROM links WHERE id = $1",
            [linkID]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send("Link not found");
        }
        
        let url = result.rows[0].url;

        // make sure url starts with https://
        if(url.substring(0,8) != "https://")
            url = "https://" + url;

        //res.render("link.ejs", { external : url});
        res.redirect(url);
    } catch (err) {
        console.error("Error in /l/:id:", err);
        res.status(500).send("Error redirecting: " + err.message);
    }
});

app.post("/api-shorten", requireAuth, async (req, res) => {
    try {
        await connectDB();
        const original = req.body.url;
        const shortenedURL = await getShortenedLink(original);

        res.send({ shortened : shortenedURL });
    }
    catch (err) {
        console.error("Error in /api-shorten:", err);
        res.status(500).send({ error: "Error shortening link: " + err.message });
    }
});

// app.listen(port, () => {
//     console.log(`Server is running of port ${port}`);
// });
export default app;