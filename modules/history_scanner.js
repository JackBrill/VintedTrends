// modules/history_scanner.js
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL } from "../config.js";

const CONCURRENT_CHECKS = 20; // Check 20 items from history
const TRACKED_HISTORY_FILE = path.join(process.cwd(), "tracked_history.json");

// --- Helper Functions (Copied from other scrapers) ---

function loadTrackedHistory() {
    if (!fs.existsSync(TRACKED_HISTORY_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(TRACKED_HISTORY_FILE, "utf8"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveTrackedHistory(historyArray) {
    fs.writeFileSync(TRACKED_HISTORY_FILE, JSON.stringify(historyArray, null, 2));
}

function loadSales(salesFile) {
    if (!fs.existsSync(salesFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(salesFile, "utf8"));
    } catch {
        return [];
    }
}

function saveSales(salesFile, data) {
    fs.writeFileSync(salesFile, JSON.stringify(data, null, 2));
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

// --- New Categorization Logic ---

/**
 * Determines the correct sales JSON file based on the scraped category.
 * @param {string} scrapedCategory The category text from the breadcrumbs.
 * @returns {string|null} The name of the JSON file or null if not matched.
 */
function getSalesFileByCategory(scrapedCategory) {
    if (!scrapedCategory) return null;
    const category = scrapedCategory.toLowerCase();
    
    // You can expand this list with more keywords for each category
    const mensKeywords = ['men', 'shorts', 't-shirt', 'jeans', 'trousers', 'coats'];
    const womensKeywords = ['women', 'dress', 'skirt', 'blouse', 'handbag', 'heels'];
    const designerKeywords = ['designer', 'luxury']; // Less common in breadcrumbs, might need other logic
    const shoesKeywords = ['shoes', 'trainers', 'boots', 'sandals'];
    const electronicsKeywords = ['electronics', 'console', 'phone', 'headphone'];

    if (mensKeywords.some(kw => category.includes(kw))) return 'mens.json';
    if (womensKeywords.some(kw => category.includes(kw))) return 'womens.json';
    if (shoesKeywords.some(kw => category.includes(kw))) return 'shoes.json';
    if (electronicsKeywords.some(kw => category.includes(kw))) return 'electronics.json';
    // Add more specific logic for designer if possible
    
    return null; // Default if no category is matched
}


// --- Main History Scanner Logic ---

async function checkHistoricItem(url, browser) {
    let itemPage;
    let contextCheck;
    try {
        const proxy = getRandomProxy();
        contextCheck = await browser.newContext({
            proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
        });
        itemPage = await contextCheck.newPage();

              const blocklist = ['stylesheet', 'font', 'media'];
        await itemPage.route('**/*', (route) => {
            return blocklist.includes(route.request().resourceType()) ? route.abort() : route.continue();
        });

        await itemPage.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

        const soldElement = await itemPage.$('[data-testid="item-status--content"]');
        if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
            // Item is sold, scrape all details
            const name = await itemPage.$eval('.details-list--info-container .details-list__item-value', el => el.innerText.trim()).catch(() => 'Unknown Item');
            const price = await itemPage.$eval('.details-list--info-container h3.details-list__item-value', el => el.innerText.trim()).catch(() => 'N/A');
            const categoryElement = await itemPage.$('ul.breadcrumbs li:nth-child(4) span[itemprop="title"]');
            const category = categoryElement ? await categoryElement.innerText() : null;
            
            const salesFile = getSalesFileByCategory(category);
            if (!salesFile) {
                console.log(`Item sold (${name}) but could not determine category. Skipping save.`);
                return { status: 'sold', url }; // Mark as sold to remove from history
            }

            const soldItem = { name, price, link: url, sold: true, soldAt: new Date(), category };
            const sales = loadSales(path.join(process.cwd(), salesFile));
            sales.push(soldItem);
            saveSales(path.join(process.cwd(), salesFile), sales);

            console.log(`✅ Historic Item SOLD & Categorized: ${name} -> ${salesFile}`);
            await sendDiscordNotification({
                title: "🛑 Historic Item SOLD",
                description: `An item from the tracking history has been found as sold.`,
                color: 0xff8c00, // Orange color for history sales
                fields: [
                    { name: "Name", value: name, inline: false },
                    { name: "Price", value: price, inline: true },
                    { name: "Category", value: category || "N/A", inline: true },
                    { name: "File", value: salesFile, inline: true },
                    { name: "Link", value: url, inline: false },
                ],
                timestamp: new Date().toISOString(),
            });

            return { status: 'sold', url };
        }
        return { status: 'available', url };
    } catch (err) {
        console.log(`Error checking historic item "${url}":`, err.message);
        return { status: 'error', url };
    } finally {
        if (itemPage) await itemPage.close().catch(() => {});
        if (contextCheck) await contextCheck.close().catch(() => {});
    }
}

(async () => {
    console.log("--- Starting History Scan ---");
    const historyArray = loadTrackedHistory();
    if (historyArray.length === 0) {
        console.log("History is empty. Nothing to scan.");
        return;
    }

    // Select the 20 most recently added items from history
    const itemsToCheck = historyArray.slice(-CONCURRENT_CHECKS);
    console.log(`Re-checking ${itemsToCheck.length} most recent items from history...`);

    const browser = await chromium.launch({ headless: true });
    const promises = itemsToCheck.map(url => checkHistoricItem(url, browser));
    const results = await Promise.all(promises);
    await browser.close();

    const soldUrls = new Set(results.filter(r => r.status === 'sold').map(r => r.url));
    if (soldUrls.size > 0) {
        console.log(`Found ${soldUrls.size} sold items. Removing them from history.`);
        const updatedHistory = historyArray.filter(url => !soldUrls.has(url));
        saveTrackedHistory(updatedHistory);
        console.log(`History updated. New size: ${updatedHistory.length}`);
    } else {
        console.log("No sold items found in this history scan.");
    }
    console.log("--- History Scan Finished ---");
})();
