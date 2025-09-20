// salesData.js
import fs from "fs";
const FILE_PATH = "./salesData.json";

let sales = [];
if (fs.existsSync(FILE_PATH)) {
  sales = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}

export default {
  add(item) {
    sales.push(item);
    fs.writeFileSync(FILE_PATH, JSON.stringify(sales, null, 2));
  },
  getAll() {
    return sales;
  }
};
