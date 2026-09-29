/**
 * Script para ejecutar la sincronización localmente desde la terminal
 * Uso: node scripts/local-sync.js [--dry-run]
 */
require('dotenv').config();
const { runSync } = require('../src/syncService');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('==================================================');
  console.log('🎀 Sanrio Telegram Bot - Sincronización Local');
  console.log(`Modo: ${isDryRun ? 'SIMULACIÓN (Dry Run)' : 'PUBLICACIÓN REAL'}`);
  console.log('==================================================\n');

  try {
    const result = await runSync({ dryRun: isDryRun });
    console.log('\n--------------------------------------------------');
    console.log('Resultado de la ejecución:');
    console.log(`• Total extraídos: ${result.totalScraped}`);
    console.log(`• Nuevos no publicados: ${result.newFound}`);
    console.log(`• Publicados exitosamente: ${result.publishedCount}`);
    
    if (result.published && result.published.length > 0) {
      console.log('\nDetalle de publicaciones enviadas:');
      result.published.forEach((p, idx) => {
        console.log(`  [${idx + 1}] ID: ${p.id} | Shortcode: ${p.shortcode} | URL: ${p.url}`);
      });
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Errores ocurridos:');
      result.errors.forEach(e => {
        console.log(`  - Post ${e.id}: ${e.error}`);
      });
    }

    console.log('\n==================================================');
  } catch (err) {
    console.error('\n❌ Error durante la ejecución:', err.message);
    process.exit(1);
  }
}

main();
