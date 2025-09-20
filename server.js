// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readSales } from "./salesData.js";
import "./vinted.js"; // start bot

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("/sales", (req, res) => {
  const sales = readSales();
  res.json(sales);
});

app.listen(3000, () => {
  console.log("✅ Dashboard running at http://localhost:3000");
});
