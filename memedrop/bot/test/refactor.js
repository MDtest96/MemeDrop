const fs = require('fs');
const path = require('path');

const indexJsPath = path.join(__dirname, '../index.js');
let code = fs.readFileSync(indexJsPath, 'utf8');

// Replace safeReply definition
code = code.replace(
  /async function safeReply\(interaction, content\) \{[\s\S]*?\}\n\}/,
  `async function safeReply(interaction, options) {
  try {
    const payload = typeof options === 'string' ? { content: options, flags: 64 /* Ephemeral */ } : options;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (e) {
    console.error("[bot] reply failed:", e.message);
  }
}`
);

// Replace "return interaction.reply({...});" -> "return safeReply(interaction, {...});"
code = code.replace(/interaction\.reply\(\{/g, 'safeReply(interaction, {');

// Also catch things like "await interaction.reply("
code = code.replace(/await interaction\.reply\(\{/g, 'await safeReply(interaction, {');

fs.writeFileSync(indexJsPath, code);
console.log("Refactored interaction.reply to safeReply");
