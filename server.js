// server.js

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { chromium } from "playwright";
// <<< CHANGED: Import all necessary URLs for the new sequence
import { PROXIES, MENS_URL, DESIGNER_URL, WOMENS_URL, SHOES_URL, ELECTRONICS_URL } from "./config.js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static("public"));

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

app.get("/api/sales", (req, res) => {
  const { category } = req.query; 
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
    sales = readSalesFile(`${category}.json`);
  } else {
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

const allRoutes = ['/', '/mens', '/womens', '/designer', '/shoes', '/electronics',];
allRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

app.listen(PORT, async () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  // <<< NEW: Define the sequence of scrapers to check
  const scraperSequence = [
      { name: "Men's", url: MENS_URL, script: 'modules/mens.js' },
      { name: "Designer", url: DESIGNER_URL, script: 'modules/designer.js' },
      { name: "Women's", url: WOMENS_URL, script: 'modules/womens.js' },
      { name: "Shoes", url: SHOES_URL, script: 'modules/shoes.js' },
      { name: "Electronics", url: ELECTRONICS_URL, script: 'modules/electronics.js' }
  ];

  let chosenScraper = scraperSequence[0].script; // Default to the first scraper

  // <<< NEW: Loop through the sequence to find the first category with enough new items
  for (const scraper of scraperSequence) {
      console.log(`Orchestrator: Checking for new items in ${scraper.name} category...`);
      const newItemCount = await checkNewItemCount(scraper.url);
      
      if (newItemCount >= 10) {
          console.log(`Found ${newItemCount} new ${scraper.name} items. Starting ${scraper.script}...`);
          chosenScraper = scraper.script;
          break; // Exit the loop as we've found a suitable scraper
      } else {
          console.log(`Found only ${newItemCount} new ${scraper.name} items. Checking next category...`);
      }
  }

  // If the loop finishes without finding any category with >= 10 items, it will use the default
  if (chosenScraper === scraperSequence[0].script) {
      console.log(`No category had 10+ new items. Defaulting to launch ${chosenScraper}.`);
  }

  const scraperProcess = spawn('node', [chosenScraper], {
    detached: true,
    stdio: 'inherit'
  });

  scraperProcess.unref();
  console.log(`🚀 Vinted scraper (${chosenScraper}) process has been started.`);
});
