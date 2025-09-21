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

app.use(cors());

// Serve static files like main.js from the 'public' directory
app.use(express.static("public"));

// API endpoint that now combines files or filters by category
app.get("/api/sales", (req, res) => {
  const { category } = req.query; // e.g., ?category=mens
  let sales = [];

  const readSalesFile = (fileName) => {
    const filePath = path.join(__dirname, fileName);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        return fileContent ? JSON.parse(fileContent) : [];
      } catch (e) {
        console.error(`Error reading or parsing ${fileName}:`, e);
        return [];
      }
    }
    return [];
  };

  if (category) {
    // If a specific category is requested, read only that file
    sales = readSalesFile(`${category}.json`);
  } else {
    // For the homepage, read all possible files and combine them
    const allFiles = ['mens.json', 'womens.json', 'shoes.json', 'designer.json'];
    let combinedSales = [];
    allFiles.forEach(file => {
      const data = readSalesFile(file);
      combinedSales = combinedSales.concat(data);
    });
    sales = combinedSales;
  }
  
  res.json(sales);
});

// All routes serve the same main dashboard file
const allRoutes = ['/', '/mens', '/womens', '/shoes', '/designer'];
allRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  const scraper = spawn('node', ['vinted.js'], { // Make sure this runs vinted.js
    detached: true,
    stdio: 'inherit'
  });

  scraper.unref();
  console.log("🚀 Vinted multi-category scraper process has been started.");
});
