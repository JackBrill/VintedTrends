// == THE DEFINITIVE, STABLE VERSION - PLEASE USE THIS ==
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATALOG_URL } from "./config.js";

chromium.use(stealthPlugin());

// Settings
const BATCH_SIZE = 200;
const MAX_PAGES_TO_SCAN = 10;
const CHECK_INTERVAL = 60 * 1000;
const BATCH_DURATION = 10 * 60 * 1000;
const CONCURRENT_CHECKS = 3; // SAFE and STABLE value

const SALES_FILE = path.join(process.cwd(), "sales.json");

function loadSales() {
  if (!fs.existsSync(SALES_FILE)) return [];
  try {
    const data = fs.readFileSync(SALES_FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
function saveSales(data) {
  fs.writeFileSync(SALES_FILE, JSON.stringify(data, null, 2));
}
function getRandomProxy() {
  const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [host, port, user, pass] = proxyStr.split(":");
  return { host, port, user, pass };
}
async function sendDiscordNotification(embed) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.log("❌ Failed to send Discord webhook:", err.message);
  }
}

async function collectItems() {
    let attempt = 1;
    const collectedItemData = [];
    while (collectedItemData.length < BATCH_SIZE && attempt <= 5) {
        console.log(`\n=== Data Collection Attempt ${attempt} ===`);
        const proxy = getRandomProxy();
        console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
        const browser = await chromium.launch({ headless: false, slowMo: 50, args: ['--start-maximized'] });
        const context = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
            viewport: { width: 1920, height: 1080 },
            locale: 'en-GB',
            timezoneId: 'Europe/London',
        });
        const page = await context.newPage();
        try {
            let pageNumber = 1;
            while (collectedItemData.length < BATCH_SIZE && pageNumber <= MAX_PAGES_TO_SCAN) {
                const currentUrl = `${VINTED_CATALOG_URL}&page=${pageNumber}`;
                console.log(`Scanning Page ${pageNumber}... | Collected: ${collectedItemData.length}/${BATCH_SIZE}`);
                await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
                try {
                    const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
                    if (cookieButton) {
                        console.log("Cookie banner found. Accepting...");
                        await cookieButton.click();
                        await page.waitForTimeout(1000); 
                    }
                } catch (e) { /* Banner not found, continue */ }
                const pageTitle = await page.title();
                if (pageTitle.toLowerCase().includes("are you a human") || pageTitle.toLowerCase().includes("just a moment...")) {
                    console.log(`[!!!] CAPTCHA or block page detected. Breaking to retry.`);
                    break;
                }
                await page.waitForSelector('div[data-testid="feed-grid"]', { timeout: 20000 });
                const pageItems = await page.$$('div[data-testid="grid-item"]');
                if (pageItems.length === 0) {
                    console.log(`Page ${pageNumber} loaded, but no items found. Stopping pagination.`);
                    break;
                }
                console.log(`Found ${pageItems.length} items on page ${pageNumber}.`);
                for (const itemHandle of pageItems) {
                    if (collectedItemData.length >= BATCH_SIZE) break;
                    try {
                        const name = await itemHandle.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
                        const subtitle = await itemHandle.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
                        const price = await itemHandle.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
                        const link = await itemHandle.$eval('a[data-testid$="--overlay-link"]', el => el.href);
                        collectedItemData.push({ name, subtitle, price, link, sold: false, startedAt: new Date(), soldAt: null, image: null, color_name: null });
                    } catch (err) { /* Skip item */ }
                }
                pageNumber++;
            }
        } catch (err) {
            console.log(`Error during collection attempt ${attempt}:`, err.message);
        } finally {
            await browser.close();
        }
        if (collectedItemData.length < BATCH_SIZE) {
            attempt++;
            if(attempt <= 5) {
                console.log("Not enough items collected, retrying with a new proxy...");
                collectedItemData.length = 0;
            }
        } else {
             break;
        }
    }
    return collectedItemData;
}

async function checkSingleItem(page, item) {
    if (item.sold) return;
    for (let i = 0; i < 2; i++) { // Retry loop: try up to 2 times
        try {
            console.log(`🔄 Checking "${item.name}" (Attempt ${i + 1})`);
            // Correct 30-second timeout
            await page.goto(item.link, { waitUntil: "domcontentloaded", timeout: 30000 });

            const soldElement = await page.$('[data-testid="item-status--content"]');
            if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
                item.sold = true;
                item.soldAt = new Date();
                try {
                    const imgEl = await page.$('img[data-testid^="item-photo-"]');
                    if (imgEl) item.image = await imgEl.getAttribute("src");
                } catch (e) { /* ignore */ }
                try {
                    const colorElement = await page.$('div[data-testid="item-attributes-color"] div[itemprop="color"]');
                    if (colorElement) item.color_name = (await colorElement.innerText()).trim();
                } catch (e) { /* ignore */ }
                const sales = loadSales();
                sales.unshift(item);
                saveSales(sales);
                console.log(`✅ Item SOLD: ${item.name}`);
                await sendDiscordNotification({
                    title: "🛑 Item SOLD", color: 0xff0000,
                    fields: [ { name: "Name", value: item.name }, { name: "Price", value: item.price, inline: true }, { name: "Color", value: item.color_name || "N/A", inline: true}, { name: "Link", value: item.link }, ],
                    image: item.image ? { url: item.image } : undefined,
                    timestamp: new Date().toISOString(),
                });
            }
            return; // Success, exit the retry loop
        } catch (err) {
            console.log(`Attempt ${i + 1} failed for "${item.name}":`, err.message.split('\n')[0]);
            if (i === 1) {
                console.log(`❌ Final attempt failed for "${item.name}". Skipping this check cycle.`);
            } else {
                await page.waitForTimeout(2000); // Wait before retrying
            }
        }
    }
}

(async () => {
    while (true) {
        const collectedData = await collectItems();
        if (collectedData.length < BATCH_SIZE) {
            console.log("❌ Failed to collect enough items after multiple attempts. Restarting in 10 seconds.");
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
        }
        const trackedItems = collectedData.slice(0, BATCH_SIZE);
        console.log(`\n✅ Successfully collected ${trackedItems.length} items. Starting tracking for ${BATCH_DURATION / 60000} minutes.`);
        await sendDiscordNotification({ title: `📡 Scan Starting: Tracking ${trackedItems.length} items`, description: `Now monitoring the latest listings for sales activity.`, color: 0x3498db, timestamp: new Date().toISOString() });
        
        const runChecksWithWorkerPool = async () => {
            const itemsToCheck = trackedItems.filter(p => !p.sold);
            if (itemsToCheck.length === 0) return;
            console.log(`\nStarting check cycle for ${itemsToCheck.length} remaining items...`);
            const itemQueue = [...itemsToCheck]; 
            const worker = async (page) => {
                while (itemQueue.length > 0) {
                    const item = itemQueue.shift();
                    if (item) await checkSingleItem(page, item);
                }
            };
            const browser = await chromium.launch({ headless: false });
            const contexts = [];
            const workerPromises = [];
            for (let i = 0; i < CONCURRENT_CHECKS; i++) {
                const proxy = getRandomProxy();
                const context = await browser.newContext({
                    proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
                    locale: 'en-GB',
                    timezoneId: 'Europe/London',
                });
                const page = await context.newPage();
                contexts.push(context);
                workerPromises.push(worker(page));
            }
            await Promise.all(workerPromises);
            await browser.close();
        };

        let isClosing = false;
        const batchEndTime = Date.now() + BATCH_DURATION;
        const mainCheckLoop = async () => {
            if (Date.now() >= batchEndTime || isClosing) {
                clearInterval(interval);
                return;
            };
            await runChecksWithWorkerPool();
        };
        const interval = setInterval(mainCheckLoop, CHECK_INTERVAL);
        await mainCheckLoop(); 
        await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));
        console.log("\nBatch duration ended. Cleaning up...");
        isClosing = true;
        clearInterval(interval);
        console.log("--------------------------------------------------\n");
    }
})();
