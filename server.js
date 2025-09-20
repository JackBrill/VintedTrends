import express from "express";
import { exec } from "child_process";
import fs from "fs";

const app = express();
const PORT = 3000;

// Serve public files
app.use(express.static("public"));

// API to get sales
app.get("/api/sales", (req, res) => {
  let sales = [];
  if (fs.existsSync("./sales.json")) {
    sales = JSON.parse(fs.readFileSync("./sales.json", "utf-8"));
  }
  res.json(sales);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);

  // Start the scraper
  const scraper = exec("node vinted.js");

  scraper.stdout.on("data", (data) => console.log(data.toString()));
  scraper.stderr.on("data", (data) => console.error(data.toString()));
});
