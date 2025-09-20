// server.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import startVintedBot from "./vinted.js";

const app = express();
const PORT = 3000;

// Serve static dashboard files
app.use(express.static(path.join(process.cwd(), "public")));

// API endpoint to get sold items
app.get("/api/sales", async (req, res) => {
  try {
    const dataRaw = await fs.readFile("sales.json", "utf8").catch(() => "[]");
    const sales = JSON.parse(dataRaw);
    res.json(sales);
  } catch (err) {
    console.log("Failed to read sales.json:", err.message);
    res.status(500).json({ error: "Failed to read sales data" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});

// Start the Vinted bot in background
startVintedBot().catch(err => {
  console.error("❌ Vinted bot crashed:", err);
});
