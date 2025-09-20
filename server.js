// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import notifier from "./notifier.js";
import "./vinted.js"; // start the bot

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("dashboard");
});

io.on("connection", (socket) => {
  console.log("🔌 Client connected");

  notifier.on("scan_start", (items) => {
    socket.emit("scan_start", items);
  });

  notifier.on("item_sold", (item) => {
    socket.emit("item_sold", item);
  });
});

httpServer.listen(3000, () => {
  console.log("🌐 Dashboard running at http://localhost:3000");
});

