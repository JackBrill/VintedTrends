// server.js
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;
const SALES_FILE = "./sales.json";

// Serve static files from 'public' folder
app.use(express.static("public"));

// API endpoint to get all sold items
app.get("/api/sales", (req, res) => {
  let sales = [];
  if (fs.existsSync(SALES_FILE)) {
    try {
      sales = JSON.parse(fs.readFileSync(SALES_FILE, "utf-8"));
    } catch (err) {
      console.error("Failed to parse sales.json:", err.message);
    }
  }
  res.json(sales);
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});
