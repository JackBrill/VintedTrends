import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// Helper for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static("public"));

// <<< CHANGED: Modified API endpoint to handle categories >>>
app.get("/api/sales", (req, res) => {
  const category = req.query.category || 'mens'; // Default to 'mens'
  const validCategories = ['mens', 'womens', 'designer', 'shoes', 'electronics'];

  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

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
    console.error(`Error parsing ${category}.json:`, err.message);
  }
  res.json(sales);
});

// <<< NEW: Add routes to serve the main HTML for each category page >>>
const categoryRoutes = ['/mens', '/womens', '/designer', '/shoes', '/electronics'];
categoryRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);

  // <<< CHANGED: Spawn a scraper process for each category >>>
  const scrapers = ['mens.js', 'womens.js', 'designer.js', 'shoes.js', 'electronics.js'];

  scrapers.forEach(scraperScript => {
    const scraper = spawn('node', [scraperScript], {
      detached: true,
      stdio: 'inherit'
    });
    scraper.unref();
    console.log(`🚀 Started ${scraperScript} scraper process.`);
  });
});
