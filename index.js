import express from "express";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 300;

app.use(express.static("public"));
app.use(express.urlencoded({ extended : true}));

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
app.post("/sign-up-submit", (req, res) => {


    res.redirect("/log-in");
});

// navigate to log in page
app.get("/log-in", (req, res) => {
    res.render("log-in.ejs");
});

// attempt to log in to account
app.get("/log-in-submit", (req, res) => {

    res.render("/home.ejs", { userID : currentUserID });
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