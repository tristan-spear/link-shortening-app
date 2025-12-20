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
    user: process.env.DB_USER || "postgres",
    database: process.env.DB_NAME || "postgres",
    host: process.env.DB_HOST || "db.kwscdybwvxnfdszryixa.supabase.co",
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    ssl: { rejectUnauthorized: false },
});

let dbConnected = false;

async function connectDB() {
    if(dbConnected) return;
    else{
        try {
            if (!process.env.DB_PASSWORD) {
                throw new Error("DB_PASSWORD environment variable is not set");
            }
            await db.connect();
            dbConnected = true;
            console.log("Database connected successfully");
        }
        catch(err) {
            console.error("Database connection error:", err.message);
            console.error("Full error:", err.stack);
            dbConnected = false;
            throw err; // Re-throw to let callers handle it
        }
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