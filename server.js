// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { notifier } from "./vinted.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server);

const soldItemsHistory = [];

notifier.on("scan_start", (items) => {
  io.emit("scan_start", items);
});

notifier.on("item_sold", (item) => {
  soldItemsHistory.push(item);
  io.emit("item_sold", item);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("dashboard"));
app.get("/api/sold", (req, res) => res.json(soldItemsHistory));

server.listen(3000, () =>
  console.log("✅ Dashboard running at http://localhost:3000")
);
