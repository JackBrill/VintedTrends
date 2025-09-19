import { chromium } from 'playwright';

const ITEM_URL = 'https://www.vinted.co.uk/items/7078373453-weekend-offender-orange-shirt';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Monitoring item: ${ITEM_URL}`);

    const checkSoldStatus = async () => {
      try {
        await page.reload({ waitUntil: 'domcontentloaded' });

        const soldElement = await page.$('[data-testid="item-status--content"]');
        if (soldElement) {
          const statusText = await soldElement.innerText();
          if (statusText.toLowerCase().includes('sold')) {
            console.log(`${new Date().toLocaleTimeString()}: Item is SOLD!`);
          } else {
            console.log(`${new Date().toLocaleTimeString()}: Item still available`);
          }
        } else {
          console.log(`${new Date().toLocaleTimeString()}: Sold status not found, item may still be available`);
        }
      } catch (err) {
        console.error('Error checking sold status:', err.message);
      }
    };

    // Run check every 30 seconds
    const interval = setInterval(checkSoldStatus, CHECK_INTERVAL);

  } catch (err) {
    console.error('Failed to load item:', err.message);
    await browser.close();
  }
})();
