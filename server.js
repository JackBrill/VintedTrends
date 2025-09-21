// server.js

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UPDATED: Point to mens.json
const SALES_FILE = path.join(__dirname, "mens.json");

app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static("public"));

// API endpoint to get sales data from mens.json
app.get("/api/sales", (req, res) => {
  let sales = [];
  try {
    if (fs.existsSync(SALES_FILE)) {
      const fileContent = fs.readFileSync(SALES_FILE, "utf-8");
      sales = fileContent ? JSON.parse(fileContent) : [];
    }
  } catch (err) {
    console.error("Error reading or parsing mens.json:", err.message);
  }
  res.json(sales);
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  // UPDATED: Run mens.js instead of vinted.js
  const scraper = spawn('node', ['mens.js'], {
    detached: true,
    stdio: 'inherit'
  });

  scraper.unref();

  console.log("🚀 Mens scraper process has been started.");
});
