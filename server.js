const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Get port from environment or use 3000 locally
const PORT = process.env.PORT || 3000;

// Persistent volume paths
const DATA_DIR = "/data";
const csvFile = "/data/purchases.csv";
const txtFile = "/data/data.txt";

// Ensure /data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize CSV file with headers if it doesn't exist
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, "Timestamp,Customer,Items,Original Total,Discount,Final Price,Behavioral Weight,Session Duration (seconds),Session Duration (minutes)\n");
}

// Push CSV to GitHub asynchronously after each purchase
function pushToGitHub() {
  exec(
    `git config user.email "bot@railway.app" && ` +
    `git config user.name "Railway Bot" && ` +
    `git add ${csvFile} && ` +
    `git commit -m "chore: update purchases log" && ` +
    `git push`,
    (err, stdout, stderr) => {
      if (err) {
        console.error("Git push failed:", stderr || err.message);
      } else {
        console.log("Git push succeeded:", stdout.trim());
      }
    }
  );
}

http.createServer((req, res) => {

  // ── POST /log ── record a purchase
  if (req.method === "POST" && req.url === "/log") {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {

      let data = JSON.parse(body);

      // Convert session duration
      let sessionSeconds = data.sessionDuration || 0;
      let sessionMinutes = (sessionSeconds / 60).toFixed(2);

      // Create CSV line with all data
      let timestamp = new Date().toISOString();
      let csvLine = `"${timestamp}","${data.user}","${data.items}",${data.total},${data.discount},${data.final},${data.weight},${sessionSeconds},${sessionMinutes}\n`;

      // Create txt line (legacy format)
      let txtLine = `${data.user},${data.total},${data.discount},${data.final},${data.weight},${data.time},${sessionSeconds}s/${sessionMinutes}min\n`;

      fs.appendFileSync(csvFile, csvLine);
      fs.appendFileSync(txtFile, txtLine);

      // Log to Railway deploy logs (visible in Railway dashboard)
      const itemsSummary = data.items || "(no items)";
      console.log(`PURCHASE: ${data.user} | Items: ${itemsSummary} | Total: ${data.total} | Discount: ${data.discount} | Final: ${data.final}`);

      // Sync CSV to GitHub in the background
      pushToGitHub();

      res.writeHead(200);
      res.end("logged");

    });

    return;
  }

  // ── GET /logs ── download the CSV file
  if (req.method === "GET" && req.url === "/logs") {
    if (!fs.existsSync(csvFile)) {
      res.writeHead(404);
      res.end("No CSV log found yet.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=\"purchases.csv\""
    });
    fs.createReadStream(csvFile).pipe(res);
    return;
  }

  // ── GET /logs-txt ── download the TXT file
  if (req.method === "GET" && req.url === "/logs-txt") {
    if (!fs.existsSync(txtFile)) {
      res.writeHead(404);
      res.end("No TXT log found yet.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Content-Disposition": "attachment; filename=\"data.txt\""
    });
    fs.createReadStream(txtFile).pipe(res);
    return;
  }

  // ── GET /logs-view ── display CSV as an HTML table
  if (req.method === "GET" && req.url === "/logs-view") {
    if (!fs.existsSync(csvFile)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>No purchases logged yet.</h2></body></html>");
      return;
    }

    const raw = fs.readFileSync(csvFile, "utf8");
    const lines = raw.trim().split("\n").filter(l => l.trim() !== "");

    if (lines.length < 2) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>No purchase records yet.</h2></body></html>");
      return;
    }

    // Parse CSV rows (handles quoted fields)
    function parseCSVLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result;
    }

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(parseCSVLine);

    const headerCells = headers.map(h => `<th>${h}</th>`).join("");
    const bodyRows = rows.map(row =>
      "<tr>" + row.map(cell => `<td>${cell}</td>`).join("") + "</tr>"
    ).join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Logs</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; background: #f4f6f9; color: #222; }
    h1 { margin-bottom: 16px; }
    .actions { margin-bottom: 16px; }
    .actions a { margin-right: 12px; padding: 8px 14px; background: #0070f3; color: #fff;
                 text-decoration: none; border-radius: 4px; font-size: 14px; }
    .actions a:hover { background: #005bb5; }
    table { border-collapse: collapse; width: 100%; background: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1); border-radius: 6px; overflow: hidden; }
    th { background: #0070f3; color: #fff; padding: 10px 14px; text-align: left; font-size: 13px; }
    td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #e8eaed; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9fafb; }
    .count { margin-top: 12px; font-size: 13px; color: #555; }
  </style>
</head>
<body>
  <h1>&#x1F4CB; Purchase Logs</h1>
  <div class="actions">
    <a href="/logs">&#x2B07; Download CSV</a>
    <a href="/logs-txt">&#x2B07; Download TXT</a>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="count">${rows.length} record(s) total.</p>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  // ── GET /logs-data ── return CSV as JSON for the website's logs table
  if (req.method === "GET" && req.url === "/logs-data") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    if (!fs.existsSync(csvFile)) {
      res.end(JSON.stringify({ headers: [], rows: [] }));
      return;
    }

    const raw = fs.readFileSync(csvFile, "utf8");
    const lines = raw.trim().split("\n").filter(l => l.trim() !== "");

    if (lines.length < 1) {
      res.end(JSON.stringify({ headers: [], rows: [] }));
      return;
    }

    // Parse CSV line, handling quoted fields correctly
    function parseCSVLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseCSVLine(lines[0]);
    // Return last 20 rows, most recent first
    const allRows = lines.slice(1).map(parseCSVLine);
    const rows = allRows.slice(-20).reverse();

    res.end(JSON.stringify({ headers, rows }));
    return;
  }

  // ── Default ── serve the main HTML page
  res.writeHead(200, { "Content-Type": "text/html" });
  fs.createReadStream("index.html").pipe(res);

}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("Server running: http://localhost:3000");
console.log(`Purchases logging to: ${csvFile} and ${txtFile}`);
