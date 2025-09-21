// vinted.js
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATALOG_URL } from "./config.js";

// Settings
const BATCH_SIZE = 200; // ** UPDATED ** You can now set this higher
const MAX_PAGES_TO_SCAN = 10; // ** NEW ** Safety limit for pagination
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes
const CONCURRENT_CHECKS = 30; // Number of items to check at once
const VERBOSE_LOGGING = true;

// Path to sales data
const SALES_FILE = path.join(process.cwd(), "sales.json");

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

/**
 * Converts a color name into a hex code.
 * @param {string} colorName - The color name from Vinted.
 * @returns {string|null} The corresponding hex code or null if not found.
 */
function mapColorToHex(colorName) {
    if (!colorName) return null;
    const firstColor = colorName.split(',')[0].trim().toLowerCase();
    const colorMap = {
        'black': '#000000', 'white': '#FFFFFF', 'grey': '#808080',
        'gray': '#808080', 'silver': '#C0C0C0', 'red': '#FF0000',
        'maroon': '#800000', 'orange': '#FFA500', 'yellow': '#FFFF00',
        'olive': '#808000', 'lime': '#00FF00', 'green': '#008000',
        'aqua': '#00FFFF', 'cyan': '#00FFFF', 'teal': '#008080',
        'blue': '#0000FF', 'navy': '#000080', 'fuchsia': '#FF00FF',
        'magenta': '#FF00FF', 'purple': '#800080', 'pink': '#FFC0CB',
        'brown': '#A52A2A', 'beige': '#F5F5DC', 'khaki': '#F0E68C',
        'gold': '#FFD700', 'cream': '#FFFDD0', 'burgundy': '#800020',
        'mustard': '#FFDB58', 'turquoise': '#40E0D0', 'indigo': '#4B0082',
        'violet': '#EE82EE', 'plum': '#DDA0DD', 'orchid': '#DA70D6',
        'salmon': '#FA8072', 'coral': '#FF7F50', 'chocolate': '#D2691E',
        'tan': '#D2B48C', 'ivory': '#FFFFF0', 'honeydew': '#F0FFF0',
        'azure': '#F0FFFF', 'lavender': '#E6E6FA', 'rose': '#FFE4E1',
        'lilac': '#C8A2C8', 'mint': '#98FF98', 'peach': '#FFDAB9',
        'sky blue': '#87CEEB', 'royal blue': '#4169E1', 'cobalt': '#0047AB',
        'denim': '#1560BD', 'emerald': '#50C878', 'mint green': '#98FF98',
        'lime green': '#32CD32', 'forest green': '#228B22', 'olive green': '#6B8E23',
        'mustard yellow': '#FFDB58', 'lemon': '#FFFACD', 'coral pink': '#F88379',
        'hot pink': '#FF69B4', 'baby pink': '#F4C2C2', 'ruby': '#E0115F',
        'scarlet': '#FF2400', 'wine': '#722F37', 'terracotta': '#E2725B',
        'bronze': '#CD7F32', 'light blue': '#ADD8E6', 'dark green': '#006400', 
        'light grey': '#D3D3D3', 'dark blue': '#00008B', 'light green': '#90EE90', 
        'dark grey': '#A9A9A9', 'multicolour': '#CCCCCC', 'check': '#A9A9A9',
        'floral': '#A9A9A9', 'animal print': '#A9A9A9', 'striped': '#A9A9A9',
        'camouflage': '#A9A9A9', 'geometric': '#A9A9A9', 'abstract': '#A9A9A9'
    };
    return colorMap[firstColor] || null;
}

// Send Discord webhook
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

// Get random proxy
function getRandomProxy() {
  const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [host, port, user, pass] = proxyStr.split(":");
  return { host, port, user, pass };
}

// ** NEW FUNCTION to collect items from multiple pages **
async function collectItems() {
    let attempt = 1;
    const collectedItemData = [];
    
    while (collectedItemData.length < BATCH_SIZE && attempt <= 5) {
        console.log(`\n=== Data Collection Attempt ${attempt} ===`);
        const proxy = getRandomProxy();
        console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();
        
        try {
            let pageNumber = 1;
            while (collectedItemData.length < BATCH_SIZE && pageNumber <= MAX_PAGES_TO_SCAN) {
                const currentUrl = `${VINTED_CATALOG_URL}&page=${pageNumber}`;
                console.log(`Scanning Page ${pageNumber}... | Collected: ${collectedItemData.length}/${BATCH_SIZE}`);
                
                await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForTimeout(2000);

                const pageItems = await page.$$('div[data-testid="grid-item"]');
                if (pageItems.length === 0) {
                    console.log(`Page ${pageNumber} is empty or blocked. Stopping pagination.`);
                    break;
                }
                
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
                    } catch (err) {
                        // Skip item if selectors fail for any reason (e.g., ad tile)
                    }
                }
                pageNumber++;
            }
            break; // Exit attempt loop on success
        } catch (err) {
            console.log(`Error during collection attempt ${attempt}:`, err.message);
            attempt++;
            collectedItemData.length = 0; // Reset for next attempt
        } finally {
            await browser.close();
        }
    }
    return collectedItemData;
}

async function checkItemStatus(item, browser) {
    if (item.sold) return;

    let itemPage;
    let contextCheck;
    try {
        const proxy = getRandomProxy();
        contextCheck = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        });

        itemPage = await contextCheck.newPage();
        console.log(`🔄 Checking "${item.name}"`);
        await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 15000 });

        if (VERBOSE_LOGGING) {
            const pageTitle = await itemPage.title();
            if (pageTitle.toLowerCase().includes("are you a human")) {
                console.log(`[!!!] CAPTCHA detected for item: ${item.name}.`);
            }
        }

        const soldElement = await itemPage.$('[data-testid="item-status--content"]');
        if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
            item.sold = true;
            item.soldAt = new Date();

            try {
                const imgEl = await itemPage.$('img[data-testid^="item-photo-"]');
                if (imgEl) item.image = await imgEl.getAttribute("src");
            } catch (err) { console.log("Failed to fetch image:", err.message); }

            try {
                const colorElement = await itemPage.$('div[data-testid="item-attributes-color"] div[itemprop="color"]');
                if (colorElement) {
                    item.color_name = (await colorElement.innerText()).trim();
                    item.color_hex = mapColorToHex(item.color_name);
                }
            } catch (err) { console.log("Could not fetch color for:", item.name); }
            
            const sales = loadSales();
            sales.unshift(item); // Add to the beginning of the array
            saveSales(sales);

            console.log(`✅ Item SOLD: ${item.name}`);

            await sendDiscordNotification({
                title: "🛑 Item SOLD", color: 0xff0000,
                fields: [
                    { name: "Name", value: item.name, inline: false },
                    { name: "Price", value: item.price, inline: true },
                    { name: "Color", value: item.color_name || "N/A", inline: true},
                    { name: "Link", value: item.link, inline: false },
                ],
                image: item.image ? { url: item.image } : undefined,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (err) {
        console.log(`Error checking item "${item.name}":`, err.message);
    } finally {
        if (itemPage) await itemPage.close().catch(() => {});
        if (contextCheck) await contextCheck.close().catch(() => {});
    }
}

// === MAIN LOOP ===
(async () => {
    while (true) {
        const collectedData = await collectItems();

        if (collectedData.length < BATCH_SIZE) {
            console.log("❌ Failed to collect enough items after multiple attempts. Restarting in 60 seconds.");
            await new Promise(resolve => setTimeout(resolve, 60000));
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

        const browserForChecks = await chromium.launch({ headless: true });
        const batchEndTime = Date.now() + BATCH_DURATION;
        let isClosing = false;
        
        const runChecks = async () => {
            if (Date.now() >= batchEndTime || isClosing) return;
            const itemsToCheck = trackedItems.filter(p => !p.sold);
            console.log(`\nStarting check cycle for ${itemsToCheck.length} remaining items...`);
            for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
                if (Date.now() >= batchEndTime) break;
                const batch = itemsToCheck.slice(i, i + CONCURRENT_CHECKS);
                await Promise.all(batch.map(item => checkItemStatus(item, browserForChecks)));
            }
        };

        const interval = setInterval(runChecks, CHECK_INTERVAL);
        await runChecks(); // Run checks immediately once

        await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));

        console.log("\nBatch duration ended. Cleaning up...");
        isClosing = true;
        clearInterval(interval);
        await browserForChecks.close();
        console.log("--------------------------------------------------\n");
    }
})();
