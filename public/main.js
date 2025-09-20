const salesContainer = document.getElementById("salesContainer");

async function fetchSales() {
  try {
    const res = await fetch("/api/sales");
    const sales = await res.json();

    if (!sales || sales.length === 0) {
      salesContainer.innerHTML = `
        <div class="col-span-full text-center py-12">
          <h2 class="text-xl font-semibold text-muted-foreground">No sold items recorded yet.</h2>
          <p class="text-muted-foreground">The tracker is running in the background. Sold items will appear here automatically.</p>
        </div>
      `;
      return;
    }
    
    // Reverse the array to show the most recent sales first
    const sortedSales = sales.reverse();

    salesContainer.innerHTML = sortedSales.map(item => `
      <div class="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-lg flex flex-col transition-transform duration-300 hover:scale-105">
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
          <img src="${item.image || 'https://via.placeholder.com/250'}" alt="${item.name}" class="w-full h-64 object-cover" loading="lazy" />
        </a>
        <div class="p-4 flex flex-col flex-grow">
          <h3 class="font-semibold text-lg flex-grow mb-2">${item.name}</h3>
          <p class="text-2xl font-bold my-2 text-primary">${item.price}</p>
          <p class="text-sm text-muted-foreground mb-4">Sold in: <span class="font-medium">${getSoldDuration(item.startedAt, item.soldAt)}</span></p>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="mt-auto text-center bg-primary text-primary-foreground font-bold py-2 px-4 rounded-md hover:bg-vinted-teal-light transition-colors">
            View on Vinted
          </a>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Failed to fetch sales:", err);
    salesContainer.innerHTML = `<p class="col-span-full text-destructive text-center">Error loading sales data. Please check the console.</p>`;
  }
}

function getSoldDuration(start, sold) {
  if (!sold) return "Still available";
  const startTime = new Date(start);
  const soldTime = new Date(sold);
  const diffMs = soldTime - startTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  return `${diffMins}m ${diffSecs}s`;
}

// Initial fetch and then refresh every 5 seconds
fetchSales();
setInterval(fetchSales, 5000);
