// salesData.js
import fs from "fs";
const FILE_PATH = "./salesData.json";

export function readSales() {
  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addSale(item) {
  const sales = readSales();
  sales.push(item);
  fs.writeFileSync(FILE_PATH, JSON.stringify(sales, null, 2));
}
