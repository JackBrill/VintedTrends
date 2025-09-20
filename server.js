// server.js
import express from "express";
import { getSales, loadSales } from "./salesData.js";

const app = express();
const PORT = 3000;

loadSales();

app.get("/api/sales", (req, res) => {
  res.json(getSales());
});

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});
