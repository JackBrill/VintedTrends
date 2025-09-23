import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;
const publicPath = path.join(process.cwd(), "public");

app.use(cors());
app.use(express.static(publicPath));

// API endpoint to get sales data based on category
app.get("/api/sales", (req, res) => {
  const category = req.query.category; // Get category from query
  const validCategories = ['mens', 'womens', 'designer', 'shoes', 'electronics'];

  // If a specific, valid category is requested, serve that file.
  if (category && validCategories.includes(category)) {
    const salesFile = path.join(process.cwd(), `${category}.json`);
    let sales = [];
    try {
      if (fs.existsSync(salesFile)) {
        const fileContent = fs.readFileSync(salesFile, "utf-8");
        if (fileContent) {
          sales = JSON.parse(fileContent);
        }
      }
    } catch (err) {
      console.error(`Error parsing ${salesFile}:`, err.message);
    }
    return res.json(sales);
  }

  // If NO category is specified, combine all files for the homepage.
  if (!category) {
    let allSales = [];
    validCategories.forEach(cat => {
      const salesFile = path.join(process.cwd(), `${cat}.json`);
      try {
        if (fs.existsSync(salesFile)) {
          const fileContent = fs.readFileSync(salesFile, "utf-8");
          if (fileContent) {
            const salesData = JSON.parse(fileContent);
            allSales = allSales.concat(salesData);
          }
        }
      } catch (err) {
        console.error(`Error processing ${salesFile}:`, err.message);
      }
    });
    return res.json(allSales);
  }
  
  // If an invalid category is specified, return an error.
  return res.status(400).json({ error: "Invalid category" });
});


// This is a catch-all route that serves the index.html file for any non-API route.
// This is crucial for a single-page application (SPA) to handle client-side routing.
app.get(/^\/.*/, (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
  
  const scraper = spawn('node', ['vinted.js'], {
    detached: true,
    stdio: 'inherit'
  });

  scraper.unref();

  console.log("🚀 Vinted scraper process has been started.");
});

