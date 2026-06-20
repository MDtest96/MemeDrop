const fs = require('fs');
const path = require('path');

const indexJsPath = path.join(__dirname, '../index.js');
let code = fs.readFileSync(indexJsPath, 'utf8');

if (!code.includes('unhandledRejection')) {
  code = code.replace(
    'async function main() {',
    `process.on("unhandledRejection", (error) => {
  console.error("[bot] Unhandled Rejection:", error);
});

client.on("error", (error) => {
  console.error("[bot] Client Error:", error);
});

async function main() {`
  );
  fs.writeFileSync(indexJsPath, code);
  console.log("Added global error handlers");
} else {
  console.log("Global error handlers already present");
}
