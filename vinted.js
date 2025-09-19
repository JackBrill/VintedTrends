import { chromium } from 'playwright';

// Discord webhook URL
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="feed-item"]', { timeout: 10000 });

    // Scroll down to load more items
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000); // wait for items to load
    }

    // Get all loaded items
    const items = await page.$$('[data-testid="feed-item"]');

    if (items.length === 0) {
      console.log('No items found.');
      return;
    }

    // Pick a random item
    const randomIndex = Math.floor(Math.random() * items.length);
    const firstItem = items[randomIndex];

    const name = await firstItem.$eval('[data-testid="feed-item--description-title"]', el => el.innerText.trim());
    const price = await firstItem.$eval('[data-testid="feed-item--price-text"]', el => el.innerText.trim());
    const link = await firstItem.$eval('a[data-testid="feed-item--overlay-link"]', el => el.href);
    const image = await firstItem.$eval('img[data-testid="feed-item--image--img"]', el => el.src);

    console.log('Selected item:', { name, price, link, image });

    // Send embed to Discord webhook
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: name,
            url: link,
            description: `Price: **${price}**`,
            color: 0x1abc9c,
            image: { url: image },
            footer: { text: 'Vinted.co.uk' }
          }
        ]
      })
    });

    console.log('Sent to Discord webhook as an embed!');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
