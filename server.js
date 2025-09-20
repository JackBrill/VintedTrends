// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import './vinted.js'; // <-- runs the scanner automatically

const app = express();
const PORT = 3000;

// Path to sales data
const DATA_FILE = path.join(process.cwd(), 'salesData.json');

// Serve static files (if you have CSS/JS for dashboard)
app.use(express.static('public'));

// API endpoint to get sold items
app.get('/api/sold-items', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(data);
});

// Serve a simple dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vinted Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .item { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; }
        .item img { max-width: 100px; }
      </style>
    </head>
    <body>
      <h1>Sold Items</h1>
      <div id="items"></div>
      <script>
        async function loadItems() {
          const res = await fetch('/api/sold-items');
          const items = await res.json();
          const container = document.getElementById('items');
          container.innerHTML = '';
          items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = \`
              <a href="\${item.link}" target="_blank">
                <img src="\${item.image}" />
              </a>
              <strong>\${item.name}</strong><br/>
              Price: \${item.price}<br/>
              Sold in: \${item.soldTime} seconds
            \`;
            container.appendChild(div);
          });
        }
        loadItems();
        setInterval(loadItems, 5000); // refresh every 5s
      </script>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});
