// server.js

import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { chromium } from "playwright";
import { PROXIES, MENS_URL, DESIGNER_URL, WOMENS_URL, SHOES_URL, ELECTRONICS_URL } from "./config.js";

const app = express();
const PORT = 3000;
const ORCHESTRATION_INTERVAL = 15 * 60 * 1000; // 15 minutes
const RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static("public"));

// ... (all your helper functions like loadTrackedHistory, checkNewItemCount, etc. remain unchanged) ...
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


// ... (all your app.get routes remain unchanged) ...
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


// <<< CHANGED: The orchestration logic is now self-scheduling
async function runOrchestration() {
    console.log("==================================================");
    console.log(`Starting new orchestration cycle at ${new Date().toLocaleTimeString()}`);
    
    const scraperSequence = [
        { name: "Men's", url: MENS_URL, script: 'modules/mens.js' },
        { name: "Designer", url: DESIGNER_URL, script: 'modules/designer.js' },
        { name: "Women's", url: WOMENS_URL, script: 'modules/womens.js' },
        { name: "Shoes", url: SHOES_URL, script: 'modules/shoes.js' },
        { name: "Electronics", url: ELECTRONICS_URL, script: 'modules/electronics.js' }
    ];

    let scraperLaunched = false;

    for (const scraper of scraperSequence) {
        console.log(`Orchestrator: Checking for new items in ${scraper.name} category...`);
        const newItemCount = await checkNewItemCount(scraper.url);
        
        if (newItemCount >= 10) {
            console.log(`Found ${newItemCount} new ${scraper.name} items. Starting ${scraper.script}...`);
            
            const scraperProcess = spawn('node', [scraper.script], {
              detached: true,
              stdio: 'inherit'
            });
            scraperProcess.unref();
            console.log(`🚀 Vinted scraper (${scraper.script}) process has been started.`);
            
            scraperLaunched = true;
            break; 
        } else {
            console.log(`Found only ${newItemCount} new ${scraper.name} items. Checking next category...`);
        }
    }
    
    // <<< CHANGED: Decide the delay for the next cycle
    if (scraperLaunched) {
        // A scraper was launched, so wait for the normal, longer interval
        console.log(`Next orchestration cycle will start in ${ORCHESTRATION_INTERVAL / 60000} minutes.`);
        setTimeout(runOrchestration, ORCHESTRATION_INTERVAL);
    } else {
        // No scraper was launched, so schedule a faster retry
        console.log(`No category had enough new items. Retrying the whole sequence in ${RETRY_DELAY / 60000} minutes...`);
        setTimeout(runOrchestration, RETRY_DELAY);
    }
}

app.listen(PORT, () => {
  console.log(`✅ Dashboard server running on port ${PORT}`);
  
  // <<< CHANGED: Run the orchestration once on startup, it will then schedule itself
  runOrchestration();
});
