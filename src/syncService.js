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
const { translateToSpanish } = require('./translator');

/**
 * Espera un número determinado de milisegundos
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ejecuta el ciclo de sincronización
 * @param {object} options
 * @param {string} [options.channelId] - Canal destino alternativo
 * @param {boolean} [options.dryRun] - Si es true, no publica ni actualiza storage
 * @param {number} [options.limit] - Cantidad máxima de posts a procesar (por defecto: 10)
 * @param {boolean} [options.force] - Si es true, procesa incluso si ya fue registrado antes
 * @returns {Promise<object>} Resumen del ciclo de sincronización
 */
async function runSync(options = {}) {
  const channelId = options.channelId || config.telegramChannelId;
  const isDryRun = Boolean(options.dryRun);
  const limit = options.limit ? parseInt(options.limit, 10) : config.maxPostsPerRun;
  const force = Boolean(options.force);

  const validation = config.validate();
  if (!validation.isValid && !isDryRun) {
    throw new Error(`Faltan variables de entorno requeridas: ${validation.missing.join(', ')}`);
  }

  console.log(`[SyncService] Iniciando sincronización de Instagram @${config.instagramUsername} (límite: ${limit})...`);
  
  const posts = await scraper.getLatestPosts(config.instagramUsername, Math.max(limit, 12));
  console.log(`[SyncService] Se obtuvieron ${posts.length} publicaciones de @${config.instagramUsername}.`);

  const newPosts = [];
  for (const post of posts) {
    const alreadyPosted = force ? false : await storage.hasBeenPosted(post.id);
    if (!alreadyPosted) {
      newPosts.push(post);
    }
  }

  console.log(`[SyncService] Publicaciones a procesar: ${newPosts.length}`);

  if (newPosts.length === 0) {
    return {
      success: true,
      totalScraped: posts.length,
      newFound: 0,
      publishedCount: 0,
      posts: []
    };
  }

  // 1. Asegurar tomar las publicaciones más recientes
  newPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const postsToPublish = newPosts.slice(0, limit);

  // 2. Ordenar cronológicamente (más antiguo primero) para que al publicarse aparezcan en orden natural en el canal
  postsToPublish.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const published = [];
  const errors = [];

  for (const post of postsToPublish) {
    // Traducir descripción al español
    if (post.caption) {
      try {
        console.log(`[SyncService] Traduciendo post ${post.shortcode || post.id} al español...`);
        const { translatedText, isTranslated } = await translateToSpanish(post.caption);
        post.translatedCaption = translatedText;
        post.isTranslated = isTranslated;
      } catch (trErr) {
        console.warn(`[SyncService] Error traduciendo post ${post.id}:`, trErr.message);
        post.translatedCaption = post.caption;
      }
    }

    if (isDryRun) {
      published.push({
        id: post.id,
        shortcode: post.shortcode,
        url: post.url,
        caption: post.caption.substring(0, 80),
        translatedCaption: post.translatedCaption ? post.translatedCaption.substring(0, 80) : '',
        dryRun: true
      });
      continue;
    }

    try {
      console.log(`[SyncService] Enviando publicación ${post.id} (${post.shortcode}) traducida al canal ${channelId}...`);
      await telegram.sendInstagramPost(channelId, post);
      await storage.markAsPosted(post.id);
      
      published.push({
        id: post.id,
        shortcode: post.shortcode,
        url: post.url,
        caption: post.caption ? post.caption.substring(0, 100) : '',
        translatedCaption: post.translatedCaption ? post.translatedCaption.substring(0, 100) : '',
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
