import { chromium } from 'playwright';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1418689032728219678/sIkXJ-SgQYBzZX2J3p6jOwMwzdS-atWzpJfOm8_N5AdHDdF3RMgC-t1UhvfWv49WmOUo';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://www.vinted.co.uk', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="feed-item"]', { timeout: 10000 });

    const firstItemSelector = '[data-testid="feed-item"]';
    const nameSelector = '[data-testid$="description-title"]';
    const priceSelector = '[data-testid$="price-text"]';
    const linkSelector = 'a[data-testid$="overlay-link"]';
    const imageSelector = 'img[data-testid$="image--img"]';
    const soldSelector = '[data-testid$="item-status--content"]';

    // Get initial item info
    const firstItem = await page.$(firstItemSelector);
    const name = await firstItem.$eval(nameSelector, el => el.innerText.trim());
    const price = await firstItem.$eval(priceSelector, el => el.innerText.trim());
    const link = await firstItem.$eval(linkSelector, el => el.href);
    const image = await firstItem.$eval(imageSelector, el => el.src);

    console.log({ name, price, link, image });

    // Send initial Discord message
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: name,
          url: link,
          description: `Price: **${price}**`,
          color: 0x1abc9c,
          image: { url: image },
          footer: { text: 'Vinted.co.uk' }
        }]
      })
    });

    console.log('Sent initial listing to Discord!');

    // Poll every 10 seconds to check if sold
    const interval = setInterval(async () => {
      try {
        // Re-query the first item each time
        const currentItem = await page.$(firstItemSelector);
        if (!currentItem) {
          console.log('Item disappeared from feed');
          clearInterval(interval);
          return;
        }

        const soldElement = await currentItem.$(soldSelector);
        if (soldElement) {
          const soldText = await soldElement.innerText();
          if (soldText.toLowerCase().includes('sold')) {
            console.log('Item sold! Sending Discord message...');

            await fetch(WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [{
                  title: name,
                  url: link,
                  description: `Item is **SOLD**`,
                  color: 0xe74c3c,
                  image: { url: image },
                  footer: { text: 'Vinted.co.uk' }
                }]
              })
            });

            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error checking sold status:', err);
      }
    }, 10000);

  } catch (err) {
    console.error('Error:', err);
  }
})();
