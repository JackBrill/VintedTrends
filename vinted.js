// vinted.js
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
const BATCH_DURATION = 5 * 60 * 1000;
const CONCURRENT_CHECKS = 3; 
const VERBOSE_LOGGING = true;

// (Helper functions like loadSales, saveSales, etc. remain the same)
function loadSales() {
  if (!fs.existsSync(SALES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SALES_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveSales(data) {
  fs.writeFileSync(SALES_FILE, JSON.stringify(data, null, 2));
}
function mapColorToHex(colorName) {
    if (!colorName) return null;
    const firstColor = colorName.split(',')[0].trim().toLowerCase();
    const colorMap = {
        'black': '#000000', 'white': '#FFFFFF', 'grey': '#808080', 'gray': '#808080', 'silver': '#C0C0C0', 'red': '#FF0000', 'maroon': '#800000', 'orange': '#FFA500', 'yellow': '#FFFF00', 'olive': '#808000', 'lime': '#00FF00', 'green': '#008000', 'aqua': '#00FFFF', 'cyan': '#00FFFF', 'teal': '#008080', 'blue': '#0000FF', 'navy': '#000080', 'fuchsia': '#FF00FF', 'magenta': '#FF00FF', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A', 'beige': '#F5F5DC', 'khaki': '#F0E68C', 'gold': '#FFD700', 'cream': '#FFFDD0', 'burgundy': '#800020', 'mustard': '#FFDB58', 'turquoise': '#40E0D0', 'indigo': '#4B0082', 'violet': '#EE82EE', 'plum': '#DDA0DD', 'orchid': '#DA70D6', 'salmon': '#FA8072', 'coral': '#FF7F50', 'chocolate': '#D2691E', 'tan': '#D2B48C', 'ivory': '#FFFFF0', 'honeydew': '#F0FFF0', 'azure': '#F0FFFF', 'lavender': '#E6E6FA', 'rose': '#FFE4E1', 'lilac': '#C8A2C8', 'mint': '#98FF98', 'peach': '#FFDAB9', 'sky blue': '#87CEEB', 'royal blue': '#4169E1', 'cobalt': '#0047AB', 'denim': '#1560BD', 'emerald': '#50C878', 'mint green': '#98FF98', 'lime green': '#32CD32', 'forest green': '#228B22', 'olive green': '#6B8E23', 'mustard yellow': '#FFDB58', 'lemon': '#FFFACD', 'coral pink': '#F88379', 'hot pink': '#FF69B4', 'baby pink': '#F4C2C2', 'ruby': '#E0115F', 'scarlet': '#FF2400', 'wine': '#722F37', 'terracotta': '#E2725B', 'bronze': '#CD7F32', 'light blue': '#ADD8E6', 'dark green': '#006400', 'light grey': '#D3D3D3', 'dark blue': '#00008B', 'light green': '#90EE90', 'dark grey': '#A9A9A9', 'multicolour': '#CCCCCC', 'check': '#A9A9A9', 'floral': '#A9A9A9', 'animal print': '#A9A9A9', 'striped': '#A9A9A9', 'camouflage': '#A9A9A9', 'geometric': '#A9A9A9', 'abstract': '#A9A9A9'
    };
    return colorMap[firstColor] || null;
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
function getRandomProxy() {
  const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [host, port, user, pass] = proxyStr.split(":");
  return { host, port, user, pass };
}


async function collectItems() {
    let attempt = 1;
    const collectedItemData = [];
    
    while (collectedItemData.length < BATCH_SIZE && attempt <= 5) {
        console.log(`\n=== Data Collection Attempt ${attempt} ===`);
        const proxy = getRandomProxy();
        console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

        // ** MODIFIED ** Added headful, slowMo, and args for stealth
        const browser = await chromium.launch({ 
            headless: false, 
            slowMo: 50, // Adds a 50ms delay to actions to seem more human
            args: ['--start-maximized'] 
        });

        // ** MODIFIED ** Added locale, timezone, and realistic viewport
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
                } catch (e) {
                    // This is fine, it just means the banner wasn't there
                }

                const pageTitle = await page.title();
                if (pageTitle.toLowerCase().includes("are you a human") || pageTitle.toLowerCase().includes("just a moment...")) {
                    console.log(`[!!!] CAPTCHA or block page detected. The proxy is blocked. Breaking to retry.`);
                    break;
                }
                
                await page.waitForSelector('div[data-testid="feed-grid"]', { timeout: 20000 });
                const pageItems = await page.$$('div[data-testid="grid-item"]');

                if (pageItems.length === 0) {
                    console.log(`Page ${pageNumber} loaded, but no items found. This may indicate a shadow-ban. Stopping pagination.`);
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
                        
                        collectedItemData.push({
                            name, subtitle, price, link, sold: false, startedAt: new Date(),
                            soldAt: null, image: null, color_name: null, color_hex: null,
                        });
                    } catch (err) { /* Skip item if selectors fail */ }
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

// The item checking logic remains the same.
async function checkSingleItem(page, item) {
    if (item.sold) return;
    try {
        console.log(`🔄 Checking "${item.name}"`);
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
                if (colorElement) {
                    item.color_name = (await colorElement.innerText()).trim();
                    item.color_hex = mapColorToHex(item.color_name);
                }
            } catch (e) { /* ignore */ }
            
            const sales = loadSales();
            sales.unshift(item);
            saveSales(sales);
            console.log(`✅ Item SOLD: ${item.name}`);

            await sendDiscordNotification({
                title: "🛑 Item SOLD", color: 0xff0000,
                fields: [ { name: "Name", value: item.name, inline: false }, { name: "Price", value: item.price, inline: true }, { name: "Color", value: item.color_name || "N/A", inline: true}, { name: "Link", value: item.link, inline: false }, ],
                image: item.image ? { url: item.image } : undefined,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (err) {
        console.log(`Error checking item "${item.name}":`, err.message);
    }
}

// The main loop and worker pool logic remain the same.
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
        
        await sendDiscordNotification({
            title: `📡 Scan Starting: Tracking ${trackedItems.length} items`,
            description: `Now monitoring the latest listings for sales activity.`,
            color: 0x3498db,
            timestamp: new Date().toISOString(),
        });

        const runChecksWithWorkerPool = async () => {
            const itemsToCheck = trackedItems.filter(p => !p.sold);
            if (itemsToCheck.length === 0) return;

            console.log(`\nStarting check cycle for ${itemsToCheck.length} remaining items...`);
            const itemQueue = [...itemsToCheck]; 
            
            const worker = async (page) => {
                while (itemQueue.length > 0) {
                    const item = itemQueue.shift();
                    if (item) {
                        await checkSingleItem(page, item);
                    }
                }
            };
            
            const browser = await chromium.launch({ headless: false }); // Run checkers in headful mode too
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
            if (Date.now() >= batchEndTime || isClosing) return;
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
