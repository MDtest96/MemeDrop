const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'errors.log');
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
  
  // Afficher dans la console normale si ce n'est pas l'agent qui écoute
  if (!agentMode) {
    process.stdout.write(text);
  }

  // Filtrer les mots-clés d'erreur
  const lower = text.toLowerCase();
  if (
    lower.includes('error') || 
    lower.includes('exception') || 
    lower.includes('uncaught') || 
    lower.includes('fail')
  ) {
    if (agentMode) {
      // Ce log va spécifiquement réveiller l'agent
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
