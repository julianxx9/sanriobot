/**
 * Servicio de sincronización principal:
 * 1. Extrae publicaciones
 * 2. Compara contra las ya procesadas
 * 3. Publica las nuevas en el canal de Telegram
 * 4. Actualiza el almacén de publicaciones procesadas
 */
const config = require('./config');
const scraper = require('./scraper');
const storage = require('./storage');
const telegram = require('./telegram');

/**
 * Espera un número determinado de milisegundos
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ejecuta el ciclo de sincronización
 * @param {object} options
 * @param {string} [options.channelId] - Canal destino alternativo
 * @param {boolean} [options.dryRun] - Si es true, no publica ni actualiza storage
 * @returns {Promise<object>} Resumen del ciclo de sincronización
 */
async function runSync(options = {}) {
  const channelId = options.channelId || config.telegramChannelId;
  const isDryRun = Boolean(options.dryRun);

  const validation = config.validate();
  if (!validation.isValid && !isDryRun) {
    throw new Error(`Faltan variables de entorno requeridas: ${validation.missing.join(', ')}`);
  }

  console.log(`[SyncService] Iniciando sincronización de Instagram @${config.instagramUsername}...`);
  
  const posts = await scraper.getLatestPosts(config.instagramUsername);
  console.log(`[SyncService] Se obtuvieron ${posts.length} publicaciones de @${config.instagramUsername}.`);

  const newPosts = [];
  for (const post of posts) {
    const alreadyPosted = await storage.hasBeenPosted(post.id);
    if (!alreadyPosted) {
      newPosts.push(post);
    }
  }

  console.log(`[SyncService] Publicaciones nuevas no enviadas: ${newPosts.length}`);

  if (newPosts.length === 0) {
    return {
      success: true,
      totalScraped: posts.length,
      newFound: 0,
      publishedCount: 0,
      posts: []
    };
  }

  // Ordenar cronológicamente (más antiguo primero para que aparezcan en orden en el canal)
  newPosts.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Limitar cantidad por corrida para evitar saturar el canal
  const postsToPublish = newPosts.slice(0, config.maxPostsPerRun);
  const published = [];
  const errors = [];

  for (const post of postsToPublish) {
    if (isDryRun) {
      published.push({
        id: post.id,
        shortcode: post.shortcode,
        url: post.url,
        caption: post.caption.substring(0, 100),
        dryRun: true
      });
      continue;
    }

    try {
      console.log(`[SyncService] Enviando publicación ${post.id} (${post.shortcode}) al canal ${channelId}...`);
      await telegram.sendInstagramPost(channelId, post);
      await storage.markAsPosted(post.id);
      
      published.push({
        id: post.id,
        shortcode: post.shortcode,
        url: post.url,
        publishedAt: new Date().toISOString()
      });

      // Pausa de cortesía para respetar rate-limits de Telegram
      await sleep(1500);
    } catch (err) {
      console.error(`[SyncService] Error al publicar post ${post.id}:`, err.message);
      errors.push({ id: post.id, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    totalScraped: posts.length,
    newFound: newPosts.length,
    publishedCount: published.length,
    published,
    errors
  };
}

module.exports = {
  runSync
};
