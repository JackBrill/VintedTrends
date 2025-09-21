// mens.js

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATALOG_URL } from "./config.js";

// Settings
const BATCH_SIZE = 50; // number of items to track
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes
const CONCURRENT_CHECKS = 10;

// Path to sales data - UPDATED
const SALES_FILE = path.join(process.cwd(), "mens.json");

// Load sales data
function loadSales() {
  if (!fs.existsSync(SALES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SALES_FILE, "utf8"));
  } catch {
    return [];
  }
}

// Save sales data
function saveSales(data) {
  fs.writeFileSync(SALES_FILE, JSON.stringify(data, null, 2));
}

// ... (mapColorToHex, sendDiscordNotification, getRandomProxy functions remain the same) ...

async function sendDiscordNotification(embed) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) { console.log("❌ Failed to send Discord webhook:", err.message); }
}
function getRandomProxy() {
  const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [host, port, user, pass] = proxyStr.split(":");
  return { host, port, user, pass };
}


// === MAIN SCRAPING LOGIC ===
(async () => {
  while (true) {
    let attempt = 1;
    let items = [];
    let browser;

    while (items.length < BATCH_SIZE && attempt <= 5) {
      const proxy = getRandomProxy();
      console.log(`[Mens] Attempt ${attempt} using proxy: ${proxy.host}:${proxy.port}`);

      try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();
        console.log(`[Mens] Navigating to catalog URL...`);
        await page.goto(VINTED_CATALOG_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
        
        items = await page.$$('div[data-testid="grid-item"]');
        console.log(`[Mens] Found ${items.length} items on the page.`);

        if (items.length < BATCH_SIZE) {
          console.log(`[Mens] Not enough items, retrying...`);
          attempt++;
          await browser.close();
          continue;
        }

        console.log(`[Mens] Tracking first ${BATCH_SIZE} items...`);
        const trackedItems = [];
        for (const item of items.slice(0, BATCH_SIZE)) {
          try {
            const name = await item.$eval('[data-testid$="--description-title"]', (el) => el.innerText.trim());
            console.log(`[Mens] Tracking item: ${name}`);
            const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', (el) => el.innerText.trim());
            const price = await item.$eval('[data-testid$="--price-text"]', (el) => el.innerText.trim());
            const link = await item.$eval('a[data-testid$="--overlay-link"]', (el) => el.href);

            trackedItems.push({
              name, subtitle, price, link,
              sold: false, startedAt: new Date(), soldAt: null, image: null, color_name: null,
            });
          } catch (err) {
            console.log(`[Mens] Skipped an item due to parsing error:`, err.message);
          }
        }

        await sendDiscordNotification({ title: `📡 Scan Starting: Mens`, description: `Tracking ${trackedItems.length} new items.`, color: 0x3498db, timestamp: new Date().toISOString() });
        
        let isClosing = false;
        
        const checkItemStatus = async (item) => {
          if (item.sold || isClosing) return;
          console.log(`[Mens] [Monitoring] Checking status for: "${item.name}"`);
          let itemPage, contextCheck;
          try {
            const checkProxy = getRandomProxy();
            contextCheck = await browser.newContext({
              proxy: { server: `http://${checkProxy.host}:${checkProxy.port}`, username: checkProxy.user, password: checkProxy.pass },
              userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
            });
            itemPage = await contextCheck.newPage();
            await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 20000 });
            
            const soldElement = await itemPage.$('[data-testid="item-status--content"]');
            if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
              item.sold = true;
              item.soldAt = new Date();
              try { item.image = await itemPage.$eval('img[data-testid^="item-photo-"]', el => el.getAttribute("src")); } catch (e) { /* ignore */ }
              const sales = loadSales();
              sales.push(item);
              saveSales(sales);
              console.log(`✅ [Mens] Item SOLD: ${item.name}`);
              await sendDiscordNotification({ title: `🛑 Item SOLD (Mens)`, color: 0xff0000, fields: [{ name: "Name", value: item.name }, { name: "Price", value: item.price }, { name: "Link", value: `[Click Here](${item.link})` }], image: { url: item.image }, timestamp: new Date().toISOString() });
            }
          } catch (err) {
            if (!isClosing) console.log(`[Mens] Error checking item "${item.name}":`, err.message);
          } finally {
            if (itemPage) await itemPage.close().catch(() => {});
            if (contextCheck) await contextCheck.close().catch(() => {});
          }
        };

        const interval = setInterval(() => {
          if (isClosing) return;
          const itemsToCheck = trackedItems.filter(p => !p.sold);
          for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
            const batch = itemsToCheck.slice(i, i + CONCURRENT_CHECKS);
            Promise.all(batch.map(item => checkItemStatus(item)));
          }
        }, 60 * 1000);

        await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));
        isClosing = true;
        clearInterval(interval);
        console.log(`[Mens] Batch duration ended.`);
        await browser.close();
        break;
      } catch (err) {
        console.log(`[Mens] A critical error occurred during attempt ${attempt}:`, err.message);
        attempt++;
        if (browser) await browser.close().catch(() => {});
      }
    }
    console.log(`\n--- Completed a full cycle. Waiting before next cycle. ---`);
    await new Promise(resolve => setTimeout(resolve, 1 * 60 * 1000)); // 1 min wait
  }
})();
