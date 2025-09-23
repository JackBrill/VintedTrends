import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { 
    PROXIES, 
    DISCORD_WEBHOOK_URL, 
    MENS_URL, 
    WOMENS_URL, 
    DESIGNER_URL, 
    SHOES_URL, 
    ELECTRONICS_URL 
} from "./config.js";

// --- SETTINGS ---
const BATCH_SIZE = 30;
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes per category
const CONCURRENT_CHECKS = 10;
const VERBOSE_LOGGING = true;

// --- CATEGORY JOBS ---
// The scraper will loop through this array
const SCRAPE_JOBS = [
    { name: 'MENS', url: MENS_URL, file: 'mens.json' },
    { name: 'WOMENS', url: WOMENS_URL, file: 'womens.json' },
    { name: 'DESIGNER', url: DESIGNER_URL, file: 'designer.json' },
    { name: 'SHOES', url: SHOES_URL, file: 'shoes.json' },
    { name: 'ELECTRONICS', url: ELECTRONICS_URL, file: 'electronics.json' },
];

// --- HELPER FUNCTIONS ---
function loadSales(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return [];
    }
}

function saveSales(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function mapColorToHex(colorName) {
    if (!colorName) return null;
    const firstColor = colorName.split(',')[0].trim().toLowerCase();
    const colorMap = {'black':'#000000', 'white':'#FFFFFF', 'grey':'#808080','gray':'#808080', 'silver':'#C0C0C0', 'red':'#FF0000','maroon':'#800000', 'orange':'#FFA500', 'yellow':'#FFFF00','olive':'#808000', 'lime':'#00FF00', 'green':'#008000','aqua':'#00FFFF', 'cyan':'#00FFFF', 'teal':'#008080','blue':'#0000FF', 'navy':'#000080', 'fuchsia':'#FF00FF','magenta':'#FF00FF', 'purple':'#800080', 'pink':'#FFC0CB','brown':'#A52A2A', 'beige':'#F5F5DC', 'khaki':'#F0E68C','gold':'#FFD700', 'cream':'#FFFDD0', 'burgundy':'#800020','mustard':'#FFDB58', 'turquoise':'#40E0D0', 'indigo':'#4B0082','violet':'#EE82EE', 'plum':'#DDA0DD', 'orchid':'#DA70D6','salmon':'#FA8072', 'coral':'#FF7F50', 'chocolate':'#D2691E','tan':'#D2B48C', 'ivory':'#FFFFF0', 'honeydew':'#F0FFF0','azure':'#F0FFFF', 'lavender':'#E6E6FA', 'rose':'#FFE4E1','lilac':'#C8A2C8', 'mint':'#98FF98', 'peach':'#FFDAB9','sky blue':'#87CEEB', 'royal blue':'#4169E1', 'cobalt':'#0047AB','denim':'#1560BD', 'emerald':'#50C878', 'mint green':'#98FF98','lime green':'#32CD32', 'forest green':'#228B22', 'olive green':'#6B8E23','mustard yellow':'#FFDB58', 'lemon':'#FFFACD', 'coral pink':'#F88379','hot pink':'#FF69B4', 'baby pink':'#F4C2C2', 'ruby':'#E0115F','scarlet':'#FF2400', 'wine':'#722F37', 'terracotta':'#E2725B','bronze':'#CD7F32', 'light blue':'#ADD8E6', 'dark green':'#006400','light grey':'#D3D3D3', 'dark blue':'#00008B', 'light green':'#90EE90','dark grey':'#A9A9A9', 'multicolour':'#CCCCCC', 'check':'#A9A9A9','floral':'#A9A9A9', 'animal print':'#A9A9A9', 'striped':'#A9A9A9','camouflage':'#A9A9A9', 'geometric':'#A9A9A9', 'abstract':'#A9A9A9'};
    return colorMap[firstColor] || null;
}

async function sendDiscordNotification(embed) {
    try {
        await fetch(DISCORD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed] }) });
    } catch (err) {
        console.log("❌ Failed to send Discord webhook:", err.message);
    }
}

function getRandomProxy() {
    const proxyStr = PROXIES[Math.floor(Math.random() * PROXIES.length)];
    const [host, port, user, pass] = proxyStr.split(":");
    return { host, port, user, pass };
}

// --- Main Scraper Function for a Single Category ---
async function scrapeCategory(job) {
    const { name, url, file } = job;
    const logPrefix = `[${name}]`;
    const SALES_FILE = path.join(process.cwd(), file);

    let attempt = 1;
    let items = [];

    while (items.length < BATCH_SIZE && attempt <= 5) {
        const proxy = getRandomProxy();
        console.log(`\n${logPrefix} === Starting Batch Attempt ${attempt} ===`);
        console.log(`${logPrefix} Using proxy: ${proxy.host}:${proxy.port}`);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        });
        const page = await context.newPage();

        try {
            console.log(`${logPrefix} Navigating to Vinted catalog...`);
            const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            console.log(`${logPrefix} Response status: ${response.status()}`);

            await page.waitForTimeout(2000);
            items = await page.$$('div[data-testid="grid-item"]');
            console.log(`${logPrefix} Found ${items.length} items on the page.`);

            if (items.length < BATCH_SIZE) {
                console.log(`${logPrefix} Not enough items, retrying...`);
                attempt++;
                await browser.close();
                continue;
            }

            console.log(`${logPrefix} Tracking first ${BATCH_SIZE} items for ${BATCH_DURATION / 60000} minutes...`);
            const trackedItems = [];
            for (const item of items.slice(0, BATCH_SIZE)) {
                try {
                    const itemName = await item.$eval('[data-testid$="--description-title"]', (el) => el.innerText.trim());
                    const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', (el) => el.innerText.trim());
                    const price = await item.$eval('[data-testid$="--price-text"]', (el) => el.innerText.trim());
                    const link = await item.$eval('a[data-testid$="--overlay-link"]', (el) => el.href);
                    trackedItems.push({ name: itemName, subtitle, price, link, sold: false, startedAt: new Date(), soldAt: null, image: null, color_name: null, color_hex: null });
                } catch (err) {
                    console.log(`${logPrefix} Skipped an item due to error:`, err.message);
                }
            }
            
            await sendDiscordNotification({ title: `📡 ${logPrefix} Scan Starting`, description: trackedItems.map(i => i.name).join(", ") || "No items", color: 0x3498db, timestamp: new Date().toISOString() });

            let keepChecking = true;
            let isClosing = false;
            
            async function checkItemStatus(item) {
                if (item.sold) return;
                let itemPage, contextCheck;
                try {
                    const proxyCheck = getRandomProxy();
                    contextCheck = await browser.newContext({
                        proxy: { server: `http://${proxyCheck.host}:${proxyCheck.port}`, username: proxyCheck.user, password: proxyCheck.pass },
                        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
                    });
                    itemPage = await contextCheck.newPage();
                    await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 15000 });

                    const soldElement = await itemPage.$('[data-testid="item-status--content"]');
                    if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
                        item.sold = true;
                        item.soldAt = new Date();

                        try { item.image = await itemPage.$eval('img[data-testid^="item-photo-"]', el => el.src); } catch (e) {}
                        try { 
                            const colorName = await itemPage.$eval('div[data-testid="item-attributes-color"] div[itemprop="color"]', el => el.innerText.trim());
                            item.color_name = colorName;
                            item.color_hex = mapColorToHex(colorName);
                        } catch (e) {}
                        
                        const sales = loadSales(SALES_FILE);
                        sales.push(item);
                        saveSales(SALES_FILE, sales);
                        console.log(`✅ ${logPrefix} Item SOLD: ${item.name}`);

                        await sendDiscordNotification({
                            title: `🛑 ${logPrefix} Item SOLD`,
                            color: 0xff0000,
                            fields: [{ name: "Name", value: item.name }, { name: "Price", value: item.price, inline: true }, { name: "Color", value: item.color_name || "N/A", inline: true }, { name: "Link", value: item.link }],
                            image: { url: item.image },
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    if (!isClosing) console.log(`Error checking item "${item.name}":`, err.message);
                } finally {
                    if (itemPage) await itemPage.close().catch(() => {});
                    if (contextCheck) await contextCheck.close().catch(() => {});
                }
            }

            const interval = setInterval(() => {
                if (!keepChecking || isClosing) return;
                const itemsToCheck = trackedItems.filter(p => !p.sold);
                console.log(`${logPrefix} Checking ${itemsToCheck.length} unsold items...`);
                for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
                    const batch = itemsToCheck.slice(i, i + CONCURRENT_CHECKS);
                    Promise.all(batch.map(checkItemStatus));
                }
            }, CHECK_INTERVAL);

            await new Promise((resolve) => setTimeout(resolve, BATCH_DURATION));
            
            console.log(`${logPrefix} Batch duration ended. Moving to next category...`);
            keepChecking = false;
            isClosing = true;
            clearInterval(interval);
            await browser.close();
            return; // End the function for this category

        } catch (err) {
            console.log(`${logPrefix} Navigation or extraction error:`, err.message);
            attempt++;
            await browser.close();
        }
    }
     if (items.length < BATCH_SIZE) {
      console.log(`${logPrefix} Failed to load enough items after multiple attempts. Moving to next category...`);
    }
}

// --- Main Loop ---
(async () => {
    while (true) {
        console.log("====== STARTING NEW SCRAPE CYCLE ======");
        for (const job of SCRAPE_JOBS) {
            await scrapeCategory(job);
        }
        console.log("====== FINISHED FULL SCRAPE CYCLE. Pausing before restart. ======");
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // 5-minute pause between full cycles
    }
})();
