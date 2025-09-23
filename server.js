import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// Helper for __dirname in ES Modules, which is needed for res.sendFile
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static("public"));

// API endpoint that serves the correct data based on the category
app.get("/api/sales", (req, res) => {
  // Default to 'mens' if no category is specified
  const category = req.query.category || 'mens'; 
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

// Routes to serve the main HTML for each category page.
// This makes the links like /mens and /womens work.
const categoryRoutes = ['/mens', '/womens', '/designer', '/shoes', '/electronics'];
categoryRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);

  // Spawn the single, unified scraper process
  const scraper = spawn('node', ['scraper.js'], { // <-- CHANGED to scraper.js
    detached: true,
    stdio: 'inherit' // This shows the scraper's console logs in your main terminal
  });

  scraper.unref();

  console.log("🚀 Vinted multi-category scraper process has been started.");
});
