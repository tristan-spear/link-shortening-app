import express from "express";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 300;

app.use(express.static("public"));
app.use(express.urlencoded({ extended : true}));

