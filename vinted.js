// vinted.js
import { chromium } from "playwright";
import fetch from "node-fetch";
import { EventEmitter } from "events";

// Shared notifier for dashboard
export const notifier = new EventEmitter();

// === CONFIG ===
const PROXIES = [
  "208.66.76.70:5994:mtqikwov:autmrqhdcnfn",
  "72.1.153.25:5417:mtqikwov:autmrqhdcnfn",
  "150.241.248.232:7449:mtqikwov:autmrqhdcnfn",
  "138.226.77.124:7313:mtqikwov:autmrqhdcnfn",
  "45.196.32.223:5855:mtqikwov:autmrqhdcnfn",
  "45.196.51.227:5923:mtqikwov:autmrqhdcnfn",
  "46.203.47.181:5680:mtqikwov:autmrqhdcnfn",
  "62.164.231.66:9378:mtqikwov:autmrqhdcnfn",
  "45.196.54.120:6699:mtqikwov:autmrqhdcnfn",
  "46.203.20.40:6541:mtqikwov:autmrqhdcnfn",
  "154.194.27.8:6548:mtqikwov:autmrqhdcnfn",
  "104.252.59.11:7483:mtqikwov:autmrqhdcnfn",
  "45.196.52.181:6196:mtqikwov:autmrqhdcnfn",
  "46.203.15.117:7118:mtqikwov:autmrqhdcnfn",
  "45.56.177.51:8852:mtqikwov:autmrqhdcnfn",
  "46.203.144.26:7793:mtqikwov:autmrqhdcnfn",
  "130.180.231.36:8178:mtqikwov:autmrqhdcnfn",
  "104.252.81.67:5938:mtqikwov:autmrqhdcnfn",
  "104.252.81.97:5968:mtqikwov:autmrqhdcnfn",
  "154.194.26.109:6350:mtqikwov:autmrqhdcnfn",
];

// Discord webhook
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1418908479229530223/8_Eg73-4nZL-QoaGKjXIJF0UOxEAMBiuZGRv5CS3VGd11gLvblOgaLNk1UIqmCbTyA6Z";

// Settings
const BATCH_SIZE = 30;
const CHECK_INTERVAL = 60 * 1000;
const BATCH_DURATION = 10 * 60 * 1000;

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
            const image = await item.$eval(
              'img[data-testid$="--image"]',
              (el) => el.src
            );

            trackedItems.push({
              name,
              subtitle,
              price,
              link,
              image,
              sold: false,
              startedAt: new Date(),
              soldAt: null,
            });
            console.log(`Tracking item: ${name} | ${link} | ${price}`);
          } catch {}
        }

        // Notify scan start
        notifier.emit("scan_start", trackedItems);
        await sendDiscordNotification({
          title: "📡 Scan Starting",
          description: trackedItems.map((i) => i.name).join(", "),
          color: 0x3498db,
          timestamp: new Date().toISOString(),
        });

        let keepChecking = true;

        const interval = setInterval(async () => {
          if (!keepChecking) return;

          for (const item of trackedItems) {
            if (item.sold) continue;
            const itemPage = await context.newPage().catch(() => null);
            if (!itemPage) return;

            try {
              await itemPage.goto(item.link, {
                waitUntil: "domcontentloaded",
                timeout: 15000,
              });
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
                item.timeToSell = Math.round(
                  (item.soldAt - item.startedAt) / 1000
                );

                console.log(
                  `✅ Item SOLD: ${item.name} | ${item.price} | ${item.timeToSell}s`
                );

                notifier.emit("item_sold", item);

                await sendDiscordNotification({
                  title: "🛑 Item SOLD",
                  color: 0xff0000,
                  fields: [
                    { name: "Name", value: item.name },
                    { name: "Price", value: item.price },
                    {
                      name: "Time to Sell",
                      value: `${item.timeToSell}s`,
                    },
                    { name: "Link", value: item.link },
                  ],
                  timestamp: new Date().toISOString(),
                });
              }
            } finally {
              await itemPage.close().catch(() => {});
            }
          }
        }, CHECK_INTERVAL);

        await new Promise((r) => setTimeout(r, BATCH_DURATION));

        keepChecking = false;
        clearInterval(interval);
        await browser.close().catch(() => {});
        break;
      } catch (err) {
        console.log("Navigation error:", err.message);
        attempt++;
        await browser.close().catch(() => {});
      }
    }
  }
})();
