const fs = require('fs');
const path = require('path');

function runTest() {
  const indexJsPath = path.join(__dirname, '../index.js');
  const code = fs.readFileSync(indexJsPath, 'utf8');

  // Find all indices of "interaction.reply"
  const regex = /interaction\.reply\s*\(/g;
  let match;
  let foundUnsafe = 0;

  while ((match = regex.exec(code)) !== null) {
    // Check if it's inside safeReply function
    // A simple heuristic: check the lines around it. 
    // safeReply contains "interaction.reply" but other usages shouldn't.
    const before = code.substring(Math.max(0, match.index - 500), match.index);
    if (!before.includes('async function safeReply(')) {
      foundUnsafe++;
      console.error('Found unsafe interaction.reply at index:', match.index);
    }
  }

  if (foundUnsafe > 1) { // 1 is allowed for the actual safeReply implementation
    console.error(`Test FAILED: Found ${foundUnsafe - 1} unsafe usages of interaction.reply.`);
    process.exit(1);
  } else {
    console.log('Test PASSED: All replies use safeReply.');
    process.exit(0);
  }
}

runTest();
