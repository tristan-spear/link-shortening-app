import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
//const port = 3000;

app.use(express.static("public"));
app.use(express.urlencoded({ extended : true}));
dotenv.config();

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

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
    const baseURL = process.env.VERCEL_URL || process.env.URL || "http://localhost:3000";
    const shortenedURL = (baseURL.startsWith("http") ? baseURL : `https://${baseURL}`) + "/ly/" + linkID;

    return shortenedURL;
}

// default landing page
app.get("/", (req, res) => {
    res.render("home.ejs");
});

// add link to db and return shortened version
app.post("/shorten-link", async(req, res) => {
    try {
        await connectDB();
        const newLink = req.body["link"];

        const shortenedURL = await getShortenedLink(newLink);

        res.render("home.ejs", { shortened : shortenedURL });
    } catch (err) {
        console.error("Error in /shorten-link:", err);
        res.status(500).send("Error shortening link: " + err.message);
    }
});

// shortened link in use
// navigate to stored link
app.get("/ly/:id", async (req, res) => {
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
        console.error("Error in /ly/:id:", err);
        res.status(500).send("Error redirecting: " + err.message);
    }
});

app.post("/api-shorten", async (req, res) => {
    try {
        await connectDB();
        const original = req.body.url;

        const shortenedURL = await getShortenedLink(original);

        res.send({ shortened : shortenedURL });
    } catch (err) {
        console.error("Error in /api-shorten:", err);
        res.status(500).send({ error: "Error shortening link: " + err.message });
    }
});

// app.listen(port, () => {
//     console.log(`Server is running of port ${port}`);
// });
export default app;