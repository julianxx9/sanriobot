/**
 * Script para importar y traducir las últimas 10 publicaciones de Instagram
 * Uso: node scripts/import-10.js [--dry-run]
 */
try {
  require('dotenv').config();
} catch (_) {}
const { runSync } = require('../src/syncService');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

  console.log('====================================================');
  console.log(`🎀 Sanrio Telegram Bot - Importar ${limit} Post(s) Traducido(s)`);
  console.log(`Modo: ${isDryRun ? 'SIMULACIÓN (Dry Run)' : 'PUBLICACIÓN REAL'}`);
  console.log('Idioma de destino: Español (es)');
  console.log('====================================================\n');

  try {
    const result = await runSync({
      limit,
      force: true,
      dryRun: isDryRun
    });

    console.log('\n----------------------------------------------------');
    console.log('Resultado de la importación:');
    console.log(`• Posts obtenidos de Instagram: ${result.totalScraped}`);
    console.log(`• Posts publicados con traducción: ${result.publishedCount}`);

    if (result.published && result.published.length > 0) {
      console.log('\nDetalle de publicaciones enviadas:');
      result.published.forEach((p, idx) => {
        console.log(`\n[#${idx + 1}] ID: ${p.id} | Shortcode: ${p.shortcode}`);
        console.log(`🔗 Enlace: ${p.url}`);
        if (p.translatedCaption) {
          console.log(`🇪🇸 Traducción: ${p.translatedCaption.replace(/\n/g, ' ')}...`);
        }
      });
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Errores ocurridos durante el proceso:');
      result.errors.forEach(e => {
        console.log(`  - Post ${e.id}: ${e.error}`);
      });
    }

    console.log('\n====================================================');
  } catch (err) {
    console.error('\n❌ Error durante la importación:', err.message);
    process.exit(1);
  }
}

main();
