import { chromium } from "playwright";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { PROXIES, DISCORD_WEBHOOK_URL } from "./config.js";

// === SETTINGS ===
const BATCH_SIZE = 30; // items to track per batch
const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const BATCH_DURATION = 10 * 60 * 1000; // 10 minutes
const DATA_FILE = path.join(process.cwd(), "salesData.json");

// === HELPERS ===
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

function saveSoldItem(item) {
  let data = [];
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  }

  const soldTime = ((new Date(item.soldAt)) - (new Date(item.startedAt))) / 1000;

  const newItem = {
    name: item.name,
    price: item.price,
    link: item.link,
    image: item.image || "",
    soldTime: soldTime.toFixed(0), // seconds
    startedAt: item.startedAt,
    soldAt: item.soldAt,
  };

  data.unshift(newItem); // latest sold on top
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
        const response = await page.goto(
          "https://www.vinted.co.uk/catalog?search_id=26084673753&catalog[]=2050&order=newest_first",
          { waitUntil: "domcontentloaded", timeout: 30000 }
        );

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
            });
            console.log(`Tracking item: ${name} | ${link} | ${price}`);
          } catch (err) {
            console.log("Skipped an item due to error:", err.message);
          }
        }

        // Send "Scan Starting" embed
        const namesList = trackedItems.map((i) => i.name).join(", ");
        await sendDiscordNotification({
          title: "📡 Scan Starting",
          description: namesList || "No items",
          color: 0x3498db,
          timestamp: new Date().toISOString(),
        });

        let keepChecking = true;
        let isClosing = false;

        const interval = setInterval(async () => {
          if (!keepChecking || isClosing) return;

          for (const item of trackedItems) {
            if (!keepChecking || isClosing) return;
            if (item.sold) continue;

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
                console.log(
                  `✅ Item SOLD: ${item.name} | ${item.link} | ${item.price}`
                );

                // Fetch image only when sold
                try {
                  item.image = await itemPage.$eval(
                    'img[data-testid$="--image--img"]',
                    (el) => el.src
                  );
                } catch {}

                saveSoldItem(item);

                // Send SOLD embed
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
                    {
                      name: "Sold At",
                      value: item.soldAt.toISOString(),
                      inline: true,
                    },
                    { name: "Link", value: item.link, inline: false },
                  ],
                  timestamp: new Date().toISOString(),
                });
              } else {
                console.log(`Item still available: ${item.name}`);
              }
            } catch (err) {
              if (!isClosing) console.log("Error checking item:", err.message);
            } finally {
              await itemPage.close().catch(() => {});
            }
          }
        }, CHECK_INTERVAL);

        // Wait batch duration
        await new Promise((resolve) => setTimeout(resolve, BATCH_DURATION));

        // Stop checking and restart new batch
        console.log("Batch duration ended. Closing browser...");
        keepChecking = false;
        isClosing = true;
        clearInterval(interval);
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
        break; // exit attempt loop
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
