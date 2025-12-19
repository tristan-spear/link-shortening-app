import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import ejs from "ejs";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.urlencoded({ extended : true}));
dotenv.config();

const db = new pg.Client({
    user: "postgres",
    database: "postgres",
    host: "db.kwscdybwvxnfdszryixa.supabase.co",
    password: process.env.DB_PASSWORD,
    port: 5432,
});
db.connect();

let currentUserID;

// default landing page
app.get("/", (req, res) => {
    res.render("landing.ejs");
});

// navigate to sign-up page
app.get("/sign-up", (req, res) => {
    res.render("sign-up.ejs");
});

// add new user to db
app.post("/sign-up-submit", async (req, res) => {
    const username = req.body["username"];
    const password = req.body["password"];
    const reenterpass = req.body["reenter-password"];

    if(password !== reenterpass)
    {
        res.render("sign-up.ejs", { errmessage : "Passwords do not match" });
        return;
    }
    
    try {
        // check if username is already taken
        const result = await db.query (
            "SELECT * FROM users WHERE name = $1", 
            [username]
        );
        if(result.rowCount !== 0) {
            res.render("sign-up.ejs", { errmessage : "Username is taken" });
            return;
        }

        // add username and password to db
        db.query(
            "INSERT INTO users (name, password) VALUES ($1, $2);",
            [username, password]
        );
    
        res.redirect("/log-in");
    }
    catch(err) {
        console.error(err.stack);
    }
});

// navigate to log in page
app.get("/log-in", (req, res) => {
    res.render("log-in.ejs");
});

// attempt to log in to account
app.post("/log-in-submit", async(req, res) => {

    const username = req.body["username"];
    const password = req.body["password"];

    try {
        const result = await db.query(
            "SELECT * FROM users WHERE name = $1",
            [username]
        );

        if(result.rowCount === 0) {
            res.render("log-in.ejs", { errmessage : "Username not found" });
            return;
        }

        const userObject = result.rows;
            
        if(password == userObject[0].password)
            res.render("home.ejs");
    
        else
            res.render("log-in.ejs", { errmessage : "Incorrect password" });
    }
    catch(err) {
        console.error(err.stack);
    }
});

// add link to db and return shortened version
app.post("/shorten-link", (req, res) => {

    const newLink = req.body["link"];
});

// shortened link in use
// navigate to stored link
app.get("/link", (req, res) => {
    const linkID = req.params.id;
});

app.listen(port, () => {
    console.log(`Server is running of port ${port}`);
});