// salesData.js
import fs from "fs";
const filePath = "./salesData.json";

export function addSale(item) {
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {}
  data.unshift(item); // add to top
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
