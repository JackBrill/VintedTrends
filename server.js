// server.js
import express from "express";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/api/sales", (req, res) => {
  const sales = fs.existsSync("sales.json") ? JSON.parse(fs.readFileSync("sales.json", "utf8")) : [];
  res.json(sales);
});

app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});
