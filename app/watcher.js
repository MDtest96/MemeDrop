const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use appData path so it works in production (avoid __dirname = read-only in asar)
const appDataDir = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'MemeDrop-Unified-Agent')
  : path.join(require('os').homedir(), '.memedrop');
if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true });

const LOG_FILE = path.join(appDataDir, 'errors.log');
const agentMode = process.argv.includes('--agent-mode');

if (agentMode) {
  console.log("🤖 Mode Agent activé : Je reste en veille silencieuse et ne serai réveillé qu'en cas d'erreur.");
} else {
  console.log("👀 Démarrage du Watcher MemeDrop QuickLauncher...");
  console.log(`📝 Les erreurs seront sauvegardées dans : ${LOG_FILE}`);
}

// Lancer le processus en mode dev
const child = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  shell: true
});

function logError(chunk) {
  const text = chunk.toString();

  // Rotate log if >5MB
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      for (let i = 3; i >= 1; i--) {
        const old = LOG_FILE + '.' + i;
        const older = LOG_FILE + '.' + (i + 1);
        if (fs.existsSync(old)) fs.renameSync(old, older);
      }
      fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    }
  } catch {}
  if (!agentMode) {
    process.stdout.write(text);
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('error') ||
    lower.includes('exception') ||
    lower.includes('uncaught') ||
    lower.includes('fail')
  ) {
    if (agentMode) {
      process.stdout.write(`\n🚨 [AGENT WAKEUP] ERREUR DÉTECTÉE PAR LE WATCHER :\n${text}\n`);
    }
    const timestamp = new Date().toISOString();
    const errorMsg = `\n[${timestamp}] ERROR DETECTED:\n${text}\n`;
    fs.appendFileSync(LOG_FILE, errorMsg, 'utf8');
  }
}

child.stdout.on('data', logError);
child.stderr.on('data', logError);

child.on('close', (code) => {
  console.log(`🔴 Processus terminé avec le code ${code}`);
  fs.appendFileSync(LOG_FILE, `\n[${new Date().toISOString()}] PROCESS CLOSED WITH CODE ${code}\n`, 'utf8');
});

process.on('SIGINT', () => {
  child.kill();
  process.exit();
});
