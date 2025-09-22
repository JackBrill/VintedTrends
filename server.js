// server.js

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
// <<< NEW ADDITION: Imports for the orchestration logic
import { chromium } from "playwright";
import { PROXIES, MENS_URL } from "./config.js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());

// Serve static files like main.js from the 'public' directory
app.use(express.static("public"));

// <<< NEW ADDITION: Helper functions to check for new items
const TRACKED_HISTORY_FILE = path.join(process.cwd(), "tracked_history.json");

function loadTrackedHistory() {
    if (!fs.existsSync(TRACKED_HISTORY_FILE)) return new Set();
    try {
        const data = JSON.parse(fs.readFileSync(TRACKED_HISTORY_FILE, "utf8"));
        return new Set(data);
    } catch {
        return new Set();
    }
}

function getRandomProxy() {
  const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [host, port, user, pass] = proxyStr.split(":");
  return { host, port, user, pass };
}

async function checkNewItemCount(categoryUrl) {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const proxy = getRandomProxy();
        const context = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
        });
        const page = await context.newPage();
        await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        const trackedHistory = loadTrackedHistory();
        const items = await page.$$('div[data-testid="grid-item"]');
        let newItemsCount = 0;
        for (const item of items) {
            try {
                const link = await item.$eval('a[data-testid$="--overlay-link"]', (el) => el.href);
                if (!trackedHistory.has(link)) {
                    newItemsCount++;
                }
            } catch (e) { /* ignore */ }
        }
        await browser.close();
        return newItemsCount;
    } catch (error) {
        console.error("Error during pre-check for new items:", error.message);
        if (browser) await browser.close();
        return 0;
    }
}
// <<< END OF NEW ADDITION

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
    const allFiles = ['mens.json', 'womens.json', 'designer.json', 'shoes.json', 'electronics.json'];
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
const allRoutes = ['/', '/mens', '/womens', '/designer', '/shoes', '/electronics',];
allRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

// Start the Express server
// <<< NEW ADDITION: Changed to an async function to allow 'await'
app.listen(PORT, async () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  // <<< NEW ADDITION: Orchestration logic
  console.log("Orchestrator: Checking for new items in Men's category...");
  const newMensItems = await checkNewItemCount(MENS_URL);
  let scraperScript;

  if (newMensItems >= 20) {
      console.log(`Found ${newMensItems} new Men's items. Starting mens.js...`);
      scraperScript = 'mens.js';
  } else {
      console.log(`Found only ${newMensItems} new Men's items. Starting designer.js instead...`);
      scraperScript = 'designer.js';
  }

  const scraper = spawn('node', [scraperScript], {
    detached: true,
    stdio: 'inherit'
  });

  scraper.unref();
  console.log(`🚀 Vinted scraper (${scraperScript}) process has been started.`);
});
