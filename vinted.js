// vinted.js
import { chromium } from "playwright";
import fetch from "node-fetch";
import fs from "fs/promises";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATALOG_URL } from "./config.js";

// SETTINGS
const BATCH_SIZE = 30;
const CHECK_INTERVAL = 60 * 1000;
const BATCH_DURATION = 10 * 60 * 1000;

// HELPERS
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

async function saveSale(item) {
  let sales = [];
  try {
    const data = await fs.readFile("sales.json", "utf8");
    sales = JSON.parse(data);
  } catch {}
  sales.push(item);
  try {
    await fs.writeFile("sales.json", JSON.stringify(sales, null, 2));
  } catch (err) {
    console.log("❌ Failed to save sale:", err.message);
  }
}

// MAIN LOOP
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
        proxy: { server: `http://${proxy.host}:${proxy.port}`, username: proxy.user, password: proxy.pass },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      try {
        console.log("Navigating to Vinted catalog...");
        const response = await page.goto(VINTED_CATALOG_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.log(`Response status: ${response.status()}`);
        await page.waitForTimeout(2000);

        items = await page.$$('div[data-testid="grid-item"]');
        console.log(`Found ${items.length} items on the page.`);
        if (items.length < BATCH_SIZE) {
          attempt++;
          await browser.close();
          continue;
        }

        const trackedItems = [];
        for (const item of items.slice(0, BATCH_SIZE)) {
          try {
            const name = await item.$eval('[data-testid$="--description-title"]', el => el.innerText.trim());
            const subtitle = await item.$eval('[data-testid$="--description-subtitle"]', el => el.innerText.trim());
            const price = await item.$eval('[data-testid$="--price-text"]', el => el.innerText.trim());
            const link = await item.$eval('a[data-testid$="--overlay-link"]', el => el.href);

            trackedItems.push({ name, subtitle, price, link, sold: false, startedAt: new Date(), soldAt: null });
            console.log(`Tracking item: ${name} | ${link} | ${price}`);
          } catch {}
        }

        // Send "Scan Starting" embed
        await sendDiscordNotification({ title: "📡 Scan Starting", description: trackedItems.map(i => i.name).join(", "), color: 0x3498db });

        let keepChecking = true;

        const interval = setInterval(async () => {
          if (!keepChecking) return;

          for (const item of trackedItems) {
            if (item.sold) continue;

            const itemPage = await context.newPage().catch(() => null);
            if (!itemPage) return;

            try {
              await itemPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 15000 });
              await itemPage.waitForTimeout(1500);
              const soldElement = await itemPage.$('[data-testid="item-status--content"]');
              const isSold = soldElement ? (await soldElement.innerText()).toLowerCase().includes("sold") : false;

              if (isSold) {
                item.sold = true;
                item.soldAt = new Date();

                // Grab image only when sold
                const imgEl = await itemPage.$('img[data-testid$="--image--img"]');
                const img = imgEl ? await imgEl.getAttribute("src") : "";

                const saleData = { ...item, image: img };
                await saveSale(saleData);

                await sendDiscordNotification({
                  title: "🛑 Item SOLD",
                  color: 0xff0000,
                  fields: [
                    { name: "Name", value: item.name, inline: false },
                    { name: "Price", value: item.price, inline: true },
                    { name: "Started Tracking", value: item.startedAt.toISOString(), inline: true },
                    { name: "Sold At", value: item.soldAt.toISOString(), inline: true },
                    { name: "Link", value: item.link, inline: false },
                  ],
                  timestamp: new Date().toISOString(),
                });
              } else {
                console.log(`Item still available: ${item.name}`);
              }
            } catch (err) {
              console.log("Error checking item:", err.message);
            } finally {
              await itemPage.close().catch(() => {});
            }
          }
        }, CHECK_INTERVAL);

        await new Promise(resolve => setTimeout(resolve, BATCH_DURATION));
        console.log("Batch duration ended. Closing browser...");
        keepChecking = false;
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
      console.log("Failed to load enough items. Restarting main loop...");
    }
  }
})();
