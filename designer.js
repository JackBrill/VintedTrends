// smart-scraper.js
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, DESIGNER_URL } from "./config.js";

// === SETTINGS ===
const BATCH_SIZE = 75;
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const BATCH_DURATION = 15 * 60 * 1000; // 15 minutes
const CONCURRENT_CHECKS = 25;
const VERBOSE_LOGGING = true;
const MAX_INITIAL_ATTEMPTS = 5;

// === SELECTORS (Centralized for easy updates) ===
const SELECTORS = {
    cookieAccept: '#onetrust-accept-btn-handler',
    gridItem: 'div[data-testid="grid-item"]',
    itemTitle: '[data-testid$="--description-title"]',
    itemSubtitle: '[data-testid$="--description-subtitle"]',
    itemPrice: '[data-testid$="--price-text"]',
    itemLink: 'a[data-testid$="--overlay-link"]',
    itemStatus: '[data-testid="item-status--content"]',
    itemPhoto: 'img[data-testid^="item-photo-"]',
    itemColor: 'div[data-testid="item-attributes-color"] div[itemprop="color"]',
    itemDetails: '[data-testid="item-details"]' // A reliable element to confirm the product page has loaded
};

const SALES_FILE = path.join(process.cwd(), "designer.json");

/**
 * A more robust and intelligent Vinted scraper.
 */
class VintedScraper {
    constructor() {
        this.browser = null;
        this.trackedItems = [];
        this.isClosing = false;
        this.checkTimeout = null;
    }

    // --- Logging Utility ---
    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const prefixes = {
            INFO: 'INFO',
            SUCCESS: '✅',
            ERROR: '❌',
            WARN: '⚠️'
        };
        console.log(`[${timestamp}] [${prefixes[level] || 'LOG'}] ${message}`, ...args);
    }

    // --- Data Handling ---
    loadSales() {
        if (!fs.existsSync(SALES_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(SALES_FILE, "utf8"));
        } catch {
            return [];
        }
    }

    saveSales(data) {
        fs.writeFileSync(SALES_FILE, JSON.stringify(data, null, 2));
    }

    // --- Proxy Management ---
    getRandomProxy(useTop50 = false) {
        const proxyList = useTop50 ? PROXIES.slice(0, 50) : PROXIES;
        const proxyStr = proxyList[Math.floor(Math.random() * proxyList.length)];
        const [host, port, user, pass] = proxyStr.split(":");
        return { server: `http://${host}:${port}`, username: user, password: pass };
    }

    // --- Discord Notifications ---
    async sendDiscordNotification(embed) {
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed] }),
            });
        } catch (err) {
            this.log("ERROR", "Failed to send Discord webhook:", err.message);
        }
    }

    /**
     * Initializes the browser instance.
     */
    async init() {
        this.log("INFO", "Launching browser...");
        this.browser = await chromium.launch({ headless: true });
    }

    /**
     * Fetches the initial batch of items to track from the Vinted catalog.
     */
    async fetchInitialItems() {
        for (let attempt = 1; attempt <= MAX_INITIAL_ATTEMPTS; attempt++) {
            this.log("INFO", `Fetching initial items, attempt ${attempt}/${MAX_INITIAL_ATTEMPTS}...`);
            const context = await this.browser.newContext({
                proxy: this.getRandomProxy(true),
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            });
            const page = await context.newPage();

            try {
                await page.goto(DESIGNER_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
                
                // Smartly handle cookie banner
                await page.click(SELECTORS.cookieAccept).catch(() => this.log("INFO", "Cookie banner not found or already accepted."));

                // Wait for the grid to be visible, not a fixed time
                await page.waitForSelector(SELECTORS.gridItem, { timeout: 15000 });

                const items = await page.$$(SELECTORS.gridItem);
                this.log("INFO", `Found ${items.length} items on the page.`);

                if (items.length >= BATCH_SIZE) {
                    this.trackedItems = await this.parseItems(items.slice(0, BATCH_SIZE));
                    return true;
                }
            } catch (err) {
                this.log("ERROR", `Attempt ${attempt} failed:`, err.message);
            } finally {
                await page.close();
                await context.close();
            }
        }
        return false;
    }
    
    /**
     * Parses the raw item elements from the page into structured data.
     */
    async parseItems(itemElements) {
        const parsedItems = [];
        for (const item of itemElements) {
            try {
                const name = await item.$eval(SELECTORS.itemTitle, (el) => el.innerText.trim());
                const subtitle = await item.$eval(SELECTORS.itemSubtitle, (el) => el.innerText.trim());
                const price = await item.$eval(SELECTORS.itemPrice, (el) => el.innerText.trim());
                const link = await item.$eval(SELECTORS.itemLink, (el) => el.href);
                parsedItems.push({ name, subtitle, price, link, sold: false, startedAt: new Date(), soldAt: null, image: null, color_name: null });
            } catch (err) {
                this.log("WARN", "Skipped parsing an item due to error:", err.message);
            }
        }
        return parsedItems;
    }


    /**
     * Checks the status of a single item. This is the core logic for each concurrent check.
     */
    async checkItemStatus(item) {
        if (item.sold) return;

        const context = await this.browser.newContext({ proxy: this.getRandomProxy() });
        const page = await context.newPage();

        try {
            await page.goto(item.link, { waitUntil: "domcontentloaded", timeout: 20000 });

            const pageTitle = await page.title();
            if (pageTitle.toLowerCase().includes("just a moment") || pageTitle.toLowerCase().includes("are you a human")) {
                this.log("WARN", `Security check detected for "${item.name}". Proxy is likely flagged.`);
                return;
            }

            // Wait for a reliable element to ensure the page is actually loaded
            await page.waitForSelector(SELECTORS.itemDetails, { timeout: 10000 });

            const soldElement = await page.$(SELECTORS.itemStatus);
            if (soldElement && (await soldElement.innerText()).toLowerCase().includes("sold")) {
                await this.processSoldItem(item, page);
            } else if (VERBOSE_LOGGING) {
                this.log("INFO", `Item still available: ${item.name}`);
            }
        } catch (err) {
            if (!this.isClosing) this.log("ERROR", `Error checking "${item.name}":`, err.message);
        } finally {
            await page.close();
            await context.close();
        }
    }

    /**
     * Processes a sold item: extracts extra data, saves it, and sends a notification.
     */
    async processSoldItem(item, page) {
        item.sold = true;
        item.soldAt = new Date();

        try {
            const imgEl = await page.$(SELECTORS.itemPhoto);
            if (imgEl) item.image = await imgEl.getAttribute("src");

            const colorEl = await page.$(SELECTORS.itemColor);
            if (colorEl) item.color_name = (await colorEl.innerText()).trim();
        } catch (err) {
            this.log("WARN", "Could not fetch extra details (image/color) for sold item:", err.message);
        }

        const sales = this.loadSales();
        sales.push(item);
        this.saveSales(sales);
        this.log("SUCCESS", `Item SOLD: ${item.name} | ${item.price}`);

        this.sendDiscordNotification({
            title: "🛑 Item SOLD",
            color: 0xff0000,
            fields: [
                { name: "Name", value: item.name, inline: false },
                { name: "Price", value: item.price, inline: true },
                { name: "Color", value: item.color_name || "N/A", inline: true },
                { name: "Link", value: item.link, inline: false },
            ],
            image: item.image ? { url: item.image } : undefined,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * The main loop that continuously checks items for their status.
     */
    async scheduleChecks() {
        if (this.isClosing) return;

        const itemsToCheck = this.trackedItems.filter(p => !p.sold);
        if (itemsToCheck.length === 0) {
            this.log("INFO", "All tracked items sold. Ending batch.");
            this.stop();
            return;
        }

        this.log("INFO", `Starting check for ${itemsToCheck.length} items with concurrency of ${CONCURRENT_CHECKS}...`);

        for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
            const batch = itemsToCheck.slice(i, i + CONCURRENT_CHECKS);
            await Promise.all(batch.map(item => this.checkItemStatus(item)));
            this.log("INFO", `Completed a sub-batch of ${batch.length} checks.`);
        }

        this.log("INFO", "Full check cycle finished. Scheduling next check...");
        this.checkTimeout = setTimeout(() => this.scheduleChecks(), CHECK_INTERVAL);
    }
    
    /**
     * Starts the monitoring process for a batch of items.
     */
    startMonitoring() {
        this.isClosing = false;
        const namesList = this.trackedItems.map((i) => i.name).join(", ");
        this.sendDiscordNotification({
            title: "📡 New Scan Batch Starting",
            description: namesList || "No items found to track.",
            color: 0x3498db,
            timestamp: new Date().toISOString(),
        });

        this.scheduleChecks();
        setTimeout(() => this.stop(), BATCH_DURATION);
        this.log("INFO", `Monitoring started. This batch will run for ${BATCH_DURATION / 60000} minutes.`);
    }

    /**
     * Stops the current batch, ready for the next one.
     */
    stop() {
        if (this.isClosing) return;
        this.log("INFO", "Batch duration ended. Stopping current monitoring cycle...");
        this.isClosing = true;
        clearTimeout(this.checkTimeout);
    }

    /**
     * The main execution loop for the entire scraper.
     */
    async run() {
        await this.init();
        while (true) {
            const success = await this.fetchInitialItems();
            if (success) {
                this.startMonitoring();
                // Wait for the batch to finish
                await new Promise(resolve => setTimeout(resolve, BATCH_DURATION + 2000));
            } else {
                this.log("ERROR", "Failed to fetch enough items after multiple attempts. Retrying in 5 minutes...");
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
            }
        }
    }
}

// === Main Execution ===
const scraper = new VintedScraper();
scraper.run().catch(err => {
    console.error("A critical error occurred in the main scraper process:", err);
    process.exit(1);
});
