// vinted.js

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATEGORIES } from "./config.js";

// Settings
const BATCH_SIZE = 50;
const BATCH_DURATION = 5 * 60 * 1000;
const CONCURRENT_CHECKS = 10;
const WAIT_BETWEEN_CYCLES = 5 * 60 * 1000;

// UPDATED: These functions now take a filename as an argument
function loadSales(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function saveSales(data, fileName) {
  const filePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ... (mapColorToHex, sendDiscordNotification, getRandomProxy functions remain the same) ...
async function sendDiscordNotification(embed) { /* ... same as before ... */ }
function getRandomProxy() { /* ... same as before ... */ }

// === MAIN SCRAPING LOGIC ===
(async () => {
  while (true) {
    for (const category of VINTED_CATEGORIES) {
      console.log(`\n--- Starting scan for category: ${category.name.toUpperCase()} ---`);
      let attempt = 1;
      let items = [];
      let browser;

      while (items.length < BATCH_SIZE && attempt <= 5) {
        const proxy = getRandomProxy();
        console.log(`[${category.name}] Attempt ${attempt}`);
        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
          });

          const page = await context.newPage();
          await page.goto(category.url, { waitUntil: "domcontentloaded", timeout: 45000 });
          items = await page.$$('div[data-testid="grid-item"]');
          console.log(`[${category.name}] Found ${items.length} items.`);

          if (items.length < BATCH_SIZE) {
            console.log(`[${category.name}] Not enough items, retrying...`);
            attempt++;
            await browser.close();
            continue;
          }

          console.log(`[${category.name}] Tracking first ${BATCH_SIZE} items...`);
          const trackedItems = [];
          for (const item of items.slice(0, BATCH_SIZE)) {
            try {
              const name = await item.$eval('[data-testid$="--description-title"]', (el) => el.innerText.trim());
              const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', (el) => el.innerText.trim());
              const price = await item.$eval('[data-testid$="--price-text"]', (el) => el.innerText.trim());
              const link = await item.$eval('a[data-testid$="--overlay-link"]', (el) => el.href);
              
              trackedItems.push({
                name, subtitle, price, link,
                category: category.name,
                sold: false, startedAt: new Date(), soldAt: null, image: null,
              });
            } catch (err) { /* ignore item parsing errors */ }
          }
          
          let isClosing = false;
          
          const checkItemStatus = async (item) => {
            if (item.sold || isClosing) return;
            let itemPage, contextCheck;
            try {
              const checkProxy = getRandomProxy();
              contextCheck = await browser.newContext({ proxy: { server: `http://${checkProxy.host}:${checkProxy.port}`, username: checkProxy.user, password: checkProxy.pass } });
              itemPage = await contextCheck.newPage();
              await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 20000 });
              
              const soldElement = await itemPage.$('[data-testid="item-status--content"]');
              if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
                item.sold = true;
                item.soldAt = new Date();
                try { item.image = await itemPage.$eval('img[data-testid^="item-photo-"]', el => el.getAttribute("src")); } catch (e) {}

                // UPDATED: Save to the correct file (e.g., mens.json)
                const salesFile = `${item.category}.json`;
                const sales = loadSales(salesFile);
                sales.push(item);
                saveSales(sales, salesFile);

                console.log(`✅ [${category.name}] Item SOLD: ${item.name}`);
              }
            } catch (err) {
              if (!isClosing) console.log(`[${category.name}] Error checking item "${item.name}"`);
            } finally {
              if (itemPage) await itemPage.close().catch(() => {});
              if (contextCheck) await contextCheck.close().catch(() => {});
            }
          };

          const interval = setInterval(async () => {
            if (isClosing) return;
            const itemsToCheck = trackedItems.filter(p => !p.sold);
            for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
              await Promise.all(itemsToCheck.slice(i, i + CONCURRENT_CHECKS).map(checkItemStatus));
            }
          }, 60 * 1000);

          await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));
          isClosing = true;
          clearInterval(interval);
          await browser.close();
          break;
        } catch (err) {
          console.log(`[${category.name}] Critical error on attempt ${attempt}:`, err.message);
          attempt++;
          if (browser) await browser.close().catch(() => {});
        }
      }
    }
    console.log(`\n--- Completed full cycle. Waiting ${WAIT_BETWEEN_CYCLES / 60000} minutes. ---`);
    await new Promise(resolve => setTimeout(resolve, WAIT_BETWEEN_CYCLES));
  }
})();
