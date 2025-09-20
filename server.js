import express from "express";
import { startVintedBot } from "./vinted.js";
import salesData from "./salesData.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/sales", (req, res) => {
  res.json(salesData.getAll());
});

app.listen(3000, () => {
  console.log("✅ Dashboard running at http://localhost:3000");

  // Start the bot in background
  startVintedBot();
});
