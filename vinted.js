// vinted.js
import { chromium } from "playwright";
import fetch from "node-fetch";
import { PROXIES, DISCORD_WEBHOOK_URL, VINTED_CATALOG_URL } from "./config.js";
import { addSale } from "./salesData.js";

// Settings
const BATCH_SIZE = 30;
const CHECK_INTERVAL = 60 * 1000;
const BATCH_DURATION = 10 * 60 * 1000;

// Helpers
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

// Main loop
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
        const response = await page.goto(VINTED_CATALOG_URL, {
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
            });
            console.log(`Tracking item: ${name} | ${link} | ${price}`);
          } catch {
            continue;
          }
        }

        // Send Discord embed for new scan
        const namesList = trackedItems.map((i) => i.name).join(", ");
        await sendDiscordNotification({
          title: "📡 Scan Starting",
          description: namesList || "No items",
          color: 0x3498db,
          timestamp: new Date().toISOString(),
        });

        let keepChecking = true;

        const interval = setInterval(async () => {
          if (!keepChecking) return;

          for (const item of trackedItems) {
            if (!keepChecking || item.sold) continue;

            const itemPage = await context.newPage().catch(() => null);
            if (!itemPage) return;

            try {
              await itemPage.goto(item.link, {
                waitUntil: "domcontentloaded",
                timeout: 15000,
              });
              await itemPage.waitForTimeout(1500);

              const soldElement = await itemPage.$(
                '[data-testid="item-status--content"]'
              );
              const isSold = soldElement
                ? (await soldElement.innerText())
                    .toLowerCase()
                    .includes("sold")
                : false;

              if (isSold) {
                item.sold = true;
                item.soldAt = new Date();

                // Get image
                const imgEl = await itemPage.$('img[data-testid$="--image--img"]');
                if (imgEl) item.image = await imgEl.getAttribute("src");

                console.log(
                  `✅ Item SOLD: ${item.name} | ${item.link} | ${item.price}`
                );

                // Add to JSON for website
                addSale(item);

                // Discord embed
                await sendDiscordNotification({
                  title: "🛑 Item SOLD",
                  color: 0xff0000,
                  fields: [
                    { name: "Name", value: item.name, inline: false },
                    { name: "Price", value: item.price, inline: true },
                    {
                      name: "Started Tracking",
                      value: item.startedAt.toISOString(),
                      inline: true,
                    },
                    { name: "Sold At", value: item.soldAt.toISOString(), inline: true },
                    { name: "Link", value: item.link, inline: false },
                  ],
                  timestamp: new Date().toISOString(),
                });
              }
            } catch {
              continue;
            } finally {
              await itemPage.close().catch(() => {});
            }
          }
        }, CHECK_INTERVAL);

        await new Promise((resolve) => setTimeout(resolve, BATCH_DURATION));

        console.log("Batch ended, closing browser...");
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
  }
})();
