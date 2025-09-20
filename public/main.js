// public/main.js

async function fetchSales() {
  try {
    const res = await fetch("/api/sales");
    const sales = await res.json();

    const container = document.getElementById("salesContainer");
    container.innerHTML = ""; // clear previous items

    if (sales.length === 0) {
      container.innerHTML = "<p>No sold items yet.</p>";
      return;
    }

    sales.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.classList.add("sale-item");

      itemEl.innerHTML = `
        <a href="${item.link}" target="_blank">
          <img src="${item.image}" alt="${item.name}" class="sale-img"/>
          <h3>${item.name}</h3>
        </a>
        <p>Price: ${item.price}</p>
        <p>Sold in: ${item.soldTime} seconds</p>
      `;

      container.appendChild(itemEl);
    });
  } catch (err) {
    console.error("Failed to fetch sales:", err);
  }
}

// Refresh sales every 10 seconds
fetchSales();
setInterval(fetchSales, 10000);
