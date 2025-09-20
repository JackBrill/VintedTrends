const salesContainer = document.getElementById("salesContainer");

/**
 * Calculates and formats the time it took for an item to sell.
 * It can handle two data formats:
 * 1. Using `startedAt` and `soldAt` timestamps.
 * 2. Using a pre-calculated `speed` property in seconds.
 * @param {object} item The sale item object.
 * @returns {string|null} A formatted string like "2m 41s" or null if data is unavailable.
 */
function getSaleSpeed(item) {
  if (item.startedAt && item.soldAt) {
    const startTime = new Date(item.startedAt);
    const soldTime = new Date(item.soldAt);
    const diffMs = soldTime - startTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}m ${diffSecs}s`;
  }
  if (typeof item.speed === 'number') {
    const totalSeconds = Math.floor(item.speed);
    const diffMins = Math.floor(totalSeconds / 60);
    const diffSecs = totalSeconds % 60;
    return `${diffMins}m ${diffSecs}s`;
  }
  return null;
}

async function fetchSales() {
  try {
    const res = await fetch("/api/sales"); 
    const sales = await res.json();

    if (!sales || sales.length === 0) {
      salesContainer.innerHTML = `
        <div class="col-span-full text-center py-12">
          <h2 class="text-xl font-semibold text-muted-foreground">No sold items recorded yet.</h2>
          <p class="text-muted-foreground">The tracker is running. Sold items will appear here automatically.</p>
        </div>`;
      return;
    }
    
    // Sort by soldAt date to show the most recent sales first
    const sortedSales = sales.sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));

    salesContainer.innerHTML = sortedSales.map(item => {
      const saleSpeed = getSaleSpeed(item);
      
      const subtitleHTML = item.subtitle ? `<p class="text-xs text-muted-foreground truncate mb-2">${item.subtitle}</p>` : '';
      const saleSpeedHTML = saleSpeed ? `<p class="text-sm text-muted-foreground mb-4">Sold in: <span class="font-medium">${saleSpeed}</span></p>` : '';

      return `
      <div class="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-lg flex flex-col transition-transform duration-300 hover:scale-105">
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
          <img src="${item.image || 'https://via.placeholder.com/250'}" alt="${item.name}" class="w-full h-64 object-cover" loading="lazy" />
        </a>
        <div class="p-4 flex flex-col flex-grow">
          <h3 class="font-semibold text-lg mb-1">${item.name}</h3>
          ${subtitleHTML}
          <div class="flex-grow"></div>
          <p class="text-2xl font-bold mt-2 text-primary">${item.price}</p>
          ${saleSpeedHTML}
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="mt-auto text-center bg-primary text-primary-foreground font-bold py-2 px-4 rounded-md hover:bg-vinted-teal-light transition-colors">
            View
          </a>
        </div>
      </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Failed to fetch sales:", err);
    salesContainer.innerHTML = `<p class="col-span-full text-destructive text-center">Error loading sales data. Please check the console.</p>`;
  }
}

fetchSales();
setInterval(fetchSales, 5000);
