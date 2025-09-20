// salesData.js
import fs from "fs";

const FILE = "sales.json";
let salesData = [];

// Load sales at startup
export function loadSales() {
  try {
    if (fs.existsSync(FILE)) {
      salesData = JSON.parse(fs.readFileSync(FILE, "utf-8"));
      console.log(`📂 Loaded ${salesData.length} past sales from ${FILE}`);
    }
  } catch (err) {
    console.error("⚠️ Failed to load sales:", err.message);
  }
}

// Save sales to file
export function saveSales() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(salesData, null, 2));
  } catch (err) {
    console.error("⚠️ Failed to save sales:", err.message);
  }
}

// Add a sale (auto-save)
export function addSale(sale) {
  salesData.push(sale);
  saveSales();
}

// Access all sales
export function getSales() {
  return salesData;
}
