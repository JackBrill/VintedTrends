// commands.js
import { addSale } from "./salesData.js";
import { DISCORD_WEBHOOK_URL } from "./config.js";
import fetch from "node-fetch";

export async function sendTestSoldItem() {
  const testItem = {
    name: "Test Item",
    subtitle: "Test Brand",
    price: "£99.99",
    link: "https://www.vinted.co.uk/items/0000000000-test-item",
    sold: true,
    startedAt: new Date(),
    soldAt: new Date(),
    image: "https://via.placeholder.com/200x200.png?text=Test+Item",
  };

  // Save to JSON for dashboard
  addSale(testItem);

  // Send Discord embed
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🛑 Item SOLD (Test)",
            color: 0xff0000,
            fields: [
              { name: "Name", value: testItem.name, inline: false },
              { name: "Price", value: testItem.price, inline: true },
              { name: "Started Tracking", value: testItem.startedAt.toISOString(), inline: true },
              { name: "Sold At", value: testItem.soldAt.toISOString(), inline: true },
              { name: "Link", value: testItem.link, inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    console.log("✅ Test sold item sent to Discord and dashboard!");
  } catch (err) {
    console.log("❌ Failed to send test item:", err.message);
  }
}
