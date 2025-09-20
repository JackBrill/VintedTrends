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
      const saleInfoHTML = saleSpeed ?
        `<p class="text-xs text-muted-foreground">Sold in ${saleSpeed}</p>` :
        `<p class="text-xs text-muted-foreground">&nbsp;</p>`; // Use non-breaking space for consistent height

      return `
      <div class="bg-card text-card-foreground flex flex-col">
        <!-- Image -->
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
          <img src="${item.image || 'https://placehold.co/400x600/f1f5f9/94a3b8?text=Sold'}" alt="${item.name}" class="w-full h-auto aspect-[3/4] object-cover" loading="lazy" />
        </a>
        
        <!-- Content -->
        <div class="p-2 flex-grow">
          ${saleInfoHTML}
          <p class="text-base font-semibold mt-1">${item.price}</p>
        </div>
        
        <!-- Button -->
        <div class="px-2 pb-2">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" 
             class="block w-full text-center text-sm font-bold text-primary border border-primary rounded-md py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
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
