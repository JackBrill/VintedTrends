const salesContainer = document.getElementById("salesContainer");

async function fetchSales() {
  try {
    const res = await fetch("/api/sales");
    const sales = await res.json();

    salesContainer.innerHTML = sales.map(item => `
      <div class="saleItem">
        <img src="${item.image || 'https://via.placeholder.com/250'}" alt="${item.name}" />
        <h3>${item.name}</h3>
        <p>Price: ${item.price}</p>
        <p>Sold in: ${getSoldDuration(item.startedAt, item.soldAt)}</p>
        <a href="${item.link}" target="_blank">View on Vinted</a>
      </div>
    `).join("");
  } catch (err) {
    console.log("Failed to fetch sales:", err);
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

// Refresh every 5 seconds
fetchSales();
setInterval(fetchSales, 5000);
