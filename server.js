const http = require("http");
const fs = require("fs");
const path = require("path");

// Get port from environment or use 3000 locally
const PORT = process.env.PORT || 3000;

// Initialize CSV file with headers if it doesn't exist
const csvFile = "purchases.csv";
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, "Timestamp,Customer,Items,Original Total,Discount,Final Price,Behavioral Weight,Session Duration (seconds),Session Duration (minutes)\n");
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
fs.appendFileSync("data.txt", txtLine);

res.writeHead(200);
res.end("logged");

});

return;
}

res.writeHead(200,{"Content-Type":"text/html"});
fs.createReadStream("index.html").pipe(res);

}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("Server running: http://localhost:3000");
console.log("Purchases logging to: purchases.csv and data.txt");