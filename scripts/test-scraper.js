/**
 * Script de prueba para validar la extracción de publicaciones de Instagram
 * Uso: node scripts/test-scraper.js [username]
 */
try {
  require('dotenv').config();
} catch (_) {}
const scraper = require('../src/scraper');
const config = require('../src/config');

async function test() {
  const targetUser = process.argv[2] || config.instagramUsername || 'sanrio';

  console.log('==================================================');
  console.log(`🔍 Probando extracción de posts para: @${targetUser}`);
  console.log(`Apify Token configurado: ${config.apifyApiToken ? 'SÍ' : 'NO'}`);
  console.log('==================================================\n');

  try {
    const posts = await scraper.getLatestPosts(targetUser);

    console.log(`✅ ¡Éxito! Se obtuvieron ${posts.length} publicaciones:\n`);

    posts.slice(0, 3).forEach((post, i) => {
      console.log(`--- [Post #${i + 1}] ---`);
      console.log(`ID: ${post.id}`);
      console.log(`Shortcode: ${post.shortcode}`);
      console.log(`URL: ${post.url}`);
      console.log(`Tipo: ${post.isVideo ? 'Video 📹' : 'Imagen 🖼️'}`);
      console.log(`Media URL: ${post.displayUrl ? post.displayUrl.substring(0, 70) + '...' : 'N/A'}`);
      console.log(`Caption: ${post.caption ? post.caption.substring(0, 100).replace(/\n/g, ' ') + '...' : '(Sin texto)'}`);
      console.log(`Fecha/Timestamp: ${post.timestamp ? new Date(post.timestamp * 1000).toLocaleString() : 'N/A'}\n`);
    });

  } catch (err) {
    console.error('❌ Error durante la prueba de scraping:', err.message);
  }
}

test();
