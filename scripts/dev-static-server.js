/**
 * Serves the static site on the LAN so phones/tablets can open it via http://<PC-IP>:port/
 * Run: npm run dev:lan
 */
const os = require('os');
const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT) || 3333;
const root = path.join(__dirname, '..');

const app = express();
app.use(express.static(root, { index: 'index.html' }));

app.listen(PORT, '0.0.0.0', () => {
  const lines = [`\n  This machine:  http://127.0.0.1:${PORT}/`];
  const lan = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      lan.push(`http://${net.address}:${PORT}/`);
    }
  }
  if (lan.length) {
    lines.push(`\n  On phone/tablet (same Wi‑Fi), open one of:`);
    lan.forEach((u) => lines.push(`    ${u}`));
  } else {
    lines.push(`\n  Could not detect LAN IP — use: http://<your-PC-IPv4>:${PORT}/`);
  }
  lines.push(`\n  Press Ctrl+C to stop.\n`);
  console.log(lines.join('\n'));
});
