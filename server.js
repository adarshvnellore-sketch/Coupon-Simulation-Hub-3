const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Get port from environment or use 3000 locally
const PORT = process.env.PORT || 3000;

// Persistent volume paths
const csvFile = "/data/purchases.csv";
const txtFile = "/data/data.txt";

// Ensure /data directory exists (in case volume isn't mounted yet)
if (!fs.existsSync("/data")) {
  fs.mkdirSync("/data", { recursive: true });
}

// Initialize CSV file with headers if it doesn't exist
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, "Timestamp,Customer,Items,Original Total,Discount,Final Price,Behavioral Weight,Session Duration (seconds),Session Duration (minutes)\n");
}

// Push the updated CSV to GitHub asynchronously
function pushToGitHub() {
  const gitCommands = [
    'git config user.email "bot@coupon-simulation-hub.railway.app"',
    'git config user.name "Coupon Simulation Bot"',
    `git add "${csvFile}"`,
    'git diff --cached --quiet || git commit -m "Update purchases log"',
    'git push'
  ].join(' && ');

  exec(gitCommands, { shell: '/bin/sh' }, (err, stdout, stderr) => {
    if (err) {
      console.error("Git push failed (non-fatal):", stderr || err.message);
    } else {
      console.log("Git push succeeded:", stdout.trim() || "(no output)");
    }
  });
}

http.createServer((req,res)=>{

if(req.method === "POST" && req.url === "/log"){

let body="";

req.on("data",chunk=>{
body += chunk;
});

req.on("end",()=>{

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

// Respond immediately — git push runs in the background
res.writeHead(200);
res.end("logged");

// Async: commit and push CSV to GitHub
pushToGitHub();

});

return;
}

res.writeHead(200,{"Content-Type":"text/html"});
fs.createReadStream("index.html").pipe(res);

}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("Server running: http://localhost:3000");
console.log(`Purchases logging to: ${csvFile} and ${txtFile}`);
