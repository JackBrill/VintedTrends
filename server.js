import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000; // Your host will likely use a different port

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SALES_FILE = path.join(__dirname, "sales.json");

app.use(cors());

// Route to handle the /mens path
app.get('/mens', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files like main.js from the 'public' directory
app.use(express.static("public"));

// API endpoint to get sales data
app.get("/api/sales", (req, res) => {
  let sales = [];
  try {
    if (fs.existsSync(SALES_FILE)) {
      const fileContent = fs.readFileSync(SALES_FILE, "utf-8");
      if (fileContent) {
        sales = JSON.parse(fileContent);
      }
    }
  } catch (err) {
    console.error("Error parsing sales.json:", err.message);
  }
  res.json(sales);
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  const scraper = spawn('node', ['vinted.js'], {
    detached: true,
    stdio: 'inherit'
  });

  scraper.unref();

  console.log("🚀 Vinted scraper process has been started.");
});
