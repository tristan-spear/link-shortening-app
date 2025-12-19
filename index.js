import express from "express";
import pg from "pg";
import dotenv from "dotenv";

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

async function getShortenedLink(originalURL) {
    
    const result = await db.query(
        "INSERT INTO links (url) VALUES ($1) RETURNING id;",
        [originalURL]
    );

    const linkID = result.rows[0].id;
    const shortenedURL = "localhost:3000/ly/" + linkID

    return shortenedURL;
}


// default landing page
app.get("/", (req, res) => {
    res.render("home.ejs");
});

// add link to db and return shortened version
app.post("/shorten-link", async(req, res) => {
    const newLink = req.body["link"];

    const shortenedURL = await getShortenedLink(newLink);

    res.render("home.ejs", { shortened : shortenedURL });
});

// shortened link in use
// navigate to stored link
app.get("/ly/:id", async (req, res) => {
    const linkID = req.params.id;
    
    const result = await db.query(
        "SELECT url FROM links WHERE id = $1",
        [linkID]
    );
    let url = result.rows[0].url;

    // make sure url starts with https://
    if(url.substring(0,8) != "https://")
        url = "https://" + url;

    //res.render("link.ejs", { external : url});
    res.redirect(url);
});

app.post("/api-shorten", async (req, res) => {
    const newLink = req.body.url;

    const shortenedURL = await getShortenedLink(newLink);

    res.send({ shortened : shortenedURL });
});

app.listen(port, () => {
    console.log(`Server is running of port ${port}`);
});