// vinted.js
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, MENS_URL } from "./config.js";

// Settings
const BATCH_SIZE = 60; // number of items to track
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const BATCH_DURATION = 5 * 60 * 1000; // 5 minutes
const CONCURRENT_CHECKS = 20; // Number of items to check at once
const VERBOSE_LOGGING = false; 

// Path to sales data -- UPDATED THIS LINE
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
    const hexValue = colorMap[firstColor] || null;
    return hexValue;
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

// === MAIN LOOP ===
(async () => {
  while (true) {
    let attempt = 1;
    let items = [];

    while (items.length < BATCH_SIZE && attempt <= 5) {
      const proxy = getRandomProxy();
      console.log(`=== Attempt ${attempt} ===`);
      console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        proxy: {
          server: `http://${proxy.host}:${proxy.port}`,
          username: proxy.user,
          password: proxy.pass,
        },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      try {
        console.log("Navigating to Vinted catalog...");
        const response = await page.goto(MENS_URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        console.log(`Response status: ${response.status()}`);
        await page.waitForTimeout(2000);

        items = await page.$$('div[data-testid="grid-item"]');
        console.log(`Found ${items.length} items on the page.`);

        if (items.length < BATCH_SIZE) {
          console.log("Not enough items, retrying...");
          attempt++;
          await browser.close();
          continue;
        }

        console.log(`Tracking first ${BATCH_SIZE} items...`);

        const trackedItems = [];
        for (const item of items.slice(0, BATCH_SIZE)) {
          try {
            const name = await item.$eval(
              '[data-testid$="--description-title"]',
              (el) => el.innerText.trim()
            );
            const subtitle = await item.$eval(
              '[data-testid$="--description-subtitle"]',
              (el) => el.innerText.trim()
            );
            const price = await item.$eval(
              '[data-testid$="--price-text"]',
              (el) => el.innerText.trim()
            );
            const link = await item.$eval(
              'a[data-testid$="--overlay-link"]',
              (el) => el.href
            );

            trackedItems.push({
              name,
              subtitle,
              price,
              link,
              sold: false,
              startedAt: new Date(),
              soldAt: null,
              image: null,
              color_name: null,
              color_hex: null,
            });

            console.log(`Tracking item: ${name} | ${link} | ${price}`);
          } catch (err) {
            console.log("Skipped an item due to error:", err.message);
          }
        }

        const namesList = trackedItems.map((i) => i.name).join(", ");
        await sendDiscordNotification({
          title: "📡 Scan Starting",
          description: namesList || "No items",
          color: 0x3498db,
          timestamp: new Date().toISOString(),
        });

        let keepChecking = true;
        let isClosing = false;

        async function checkItemStatus(item) {
          if (item.sold) return;

          let itemPage;
          let contextCheck;
          try {
              const proxy = getRandomProxy();
              console.log(`🔄 Checking "${item.name}" with proxy: ${proxy.host}:${proxy.port}`);

              contextCheck = await browser.newContext({
                  proxy: {
                      server: `http://${proxy.host}:${proxy.port}`,
                      username: proxy.user,
                      password: proxy.pass,
                  },
                  userAgent:
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
                  viewport: { width: 1280, height: 800 },
              });

              itemPage = await contextCheck.newPage();
              await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 15000 });
              await itemPage.waitForTimeout(1500);

              if (VERBOSE_LOGGING) {
                  const pageTitle = await itemPage.title();
                  console.log(`[VERBOSE] Page title for "${item.name}": ${pageTitle}`);
                  if (pageTitle.toLowerCase().includes("are you a human")) {
                      console.log(`[!!!] CAPTCHA detected for item: ${item.name}. Proxy may be blocked.`);
                  }
              }

              const soldElement = await itemPage.$('[data-testid="item-status--content"]');
              const isSold = soldElement ? (await soldElement.innerText()).toLowerCase().includes("sold") : false;

              if (isSold) {
                  item.sold = true;
                  item.soldAt = new Date();

                  try {
                      const imgEl = await itemPage.$('img[data-testid^="item-photo-"]');
                      if (imgEl) item.image = await imgEl.getAttribute("src");
                  } catch (err) { console.log("Failed to fetch image:", err.message); }

                  try {
                      const colorElement = await itemPage.$('div[data-testid="item-attributes-color"] div[itemprop="color"]');
                      if (colorElement) {
                          const colorName = await colorElement.innerText();
                          item.color_name = colorName.trim();
                          item.color_hex = mapColorToHex(item.color_name);
                      }
                  } catch (err) { console.log("Could not fetch color for:", item.name); }
                  
                  const sales = loadSales();
                  sales.push(item);
                  saveSales(sales);

                  console.log(`✅ Item SOLD: ${item.name} | ${item.link} | ${item.price}`);

                  await sendDiscordNotification({
                      title: "🛑 Item SOLD",
                      color: 0xff0000,
                      fields: [
                          { name: "Name", value: item.name, inline: false },
                          { name: "Price", value: item.price, inline: true },
                          { name: "Color", value: item.color_name || "N/A", inline: true},
                          { name: "Link", value: item.link, inline: false },
                      ],
                      image: item.image ? { url: item.image } : undefined,
                      timestamp: new Date().toISOString(),
                  });
              } else {
                  console.log(`Item still available: ${item.name}`);
              }
          } catch (err) {
              if (!isClosing) console.log(`Error checking item "${item.name}":`, err.message);
          } finally {
              if (itemPage) await itemPage.close().catch(() => {});
              if (contextCheck) await contextCheck.close().catch(() => {});
          }
        }


        const interval = setInterval(async () => {
            if (!keepChecking || isClosing) return;

            const itemsToCheck = trackedItems.filter(p => !p.sold);
            if (itemsToCheck.length === 0) {
                console.log("All tracked items have been sold. Nothing to check.");
                return;
            }
            console.log(`Starting check for ${itemsToCheck.length} items with concurrency of ${CONCURRENT_CHECKS}...`);

            for (let i = 0; i < itemsToCheck.length; i += CONCURRENT_CHECKS) {
                const batch = itemsToCheck.slice(i, i + CONCURRENT_CHECKS);
                const promises = batch.map(item => checkItemStatus(item));
                await Promise.all(promises);
                console.log(`Completed a batch of ${batch.length} checks.`);
            }

            console.log("Finished full check cycle.");
        }, CHECK_INTERVAL);


        await new Promise((resolve) => setTimeout(resolve, BATCH_DURATION));

        console.log("Batch duration ended. Closing browser...");
        keepChecking = false;
        isClosing = true;
        clearInterval(interval);
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        break; 
      } catch (err) {
        console.log("Navigation or extraction error:", err.message);
        attempt++;
        await browser.close().catch(() => {});
      }
    }

    if (items.length < BATCH_SIZE) {
      console.log(
        "Failed to load enough items after multiple attempts. Restarting main loop..."
      );
    }
  }
})();
