/**
 * Módulo de extracción de publicaciones de Instagram
 * Admite:
 * 1. Apify API (usando los actores del repositorio cporter202/social-media-scraping-apis)
 * 2. Scraping web público directo (usando el endpoint Web Profile Info con cabeceras de cliente web)
 */
const config = require('./config');

/**
 * Normaliza un objeto de post a un formato unificado
 */
function normalizePost(raw) {
  let shortcode = raw.shortcode || raw.shortCode || raw.code || '';
  if (!shortcode && raw.url && typeof raw.url === 'string') {
    const match = raw.url.match(/\/p\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[1];
  }

  const postUrl = (raw.url && typeof raw.url === 'string' && raw.url.startsWith('http'))
    ? raw.url
    : (shortcode ? `https://www.instagram.com/p/${shortcode}/` : '');

  const id = String(raw.id || shortcode || raw.pk || Date.now());

  return {
    id,
    shortcode: shortcode || id,
    url: postUrl,
    caption: raw.caption || raw.text || '',
    displayUrl: raw.displayUrl || raw.imageUrl || raw.display_url || (raw.images && raw.images[0]) || '',
    videoUrl: raw.videoUrl || raw.video_url || null,
    isVideo: Boolean(raw.isVideo || raw.is_video || raw.type === 'Video' || raw.videoUrl),
    timestamp: raw.timestamp ? (typeof raw.timestamp === 'string' ? Math.floor(new Date(raw.timestamp).getTime() / 1000) : raw.timestamp) : (raw.taken_at_timestamp || Math.floor(Date.now() / 1000))
  };
}

/**
 * Estrategia 1: Extraer publicaciones mediante Apify
 * Compatible con los scrapers catalogados en el repositorio de GitHub
 */
async function scrapeViaApify(username, limit = 12) {
  if (!config.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN no configurado');
  }

  console.log(`[Scraper] Consultando Apify para el perfil @${username} (límite: ${limit})...`);

  // Usamos el actor oficial y popular 'apify/instagram-scraper'
  const actorId = 'apify~instagram-scraper';
  const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${config.apifyApiToken}&timeout=90`;

  const inputData = {
    directUrls: [`https://www.instagram.com/${username}/`],
    usernames: [username],
    resultsLimit: Math.max(limit, 10),
    resultsType: 'posts'
  };

  const response = await fetch(apifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(inputData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify respondió con estado ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[Scraper Apify] No se obtuvieron publicaciones en el dataset.');
    return [];
  }

  // Filtrar solo los elementos que son publicaciones reales
  const validPosts = items
    .filter(item => item && (item.shortCode || item.code || (typeof item.url === 'string' && item.url.includes('/p/')) || item.displayUrl || item.type === 'Image' || item.type === 'Video' || item.type === 'Sidecar'))
    .map(normalizePost);

  return validPosts;
}

/**
 * Estrategia 2: Extraer publicaciones directamente desde el endpoint web de Instagram
 */
async function scrapeViaDirectWeb(username) {
  console.log(`[Scraper] Intentando scraping directo para @${username}...`);

  const targetUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'X-IG-App-ID': '936619743392459', // App ID público de Instagram Web
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': `https://www.instagram.com/${username}/`
  };

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    throw new Error(`Instagram Direct Web respondió con estado ${response.status}`);
  }

  const json = await response.json();
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges;

  if (!Array.isArray(edges) || edges.length === 0) {
    return [];
  }

  return edges.map(edge => {
    const node = edge.node;
    const captionEdge = node.edge_media_to_caption?.edges?.[0];
    const caption = captionEdge?.node?.text || '';

    return normalizePost({
      id: node.id,
      shortcode: node.shortcode,
      url: `https://www.instagram.com/p/${node.shortcode}/`,
      caption: caption,
      displayUrl: node.display_url,
      videoUrl: node.video_url || null,
      isVideo: Boolean(node.is_video),
      timestamp: node.taken_at_timestamp
    });
  });
}

/**
 * Función principal para obtener las últimas publicaciones
 * Aplica estrategia en cascada: Apify (si está configurado) -> Direct Web
 */
async function getLatestPosts(username = config.instagramUsername, limit = 12) {
  const errors = [];

  // Intento 1: Apify si el usuario proveyó API key
  if (config.apifyApiToken) {
    try {
      const posts = await scrapeViaApify(username, limit);
      if (posts && posts.length > 0) {
        console.log(`[Scraper] Se obtuvieron ${posts.length} publicaciones vía Apify.`);
        return posts;
      }
    } catch (err) {
      console.warn(`[Scraper] Falló Apify (${err.message}). Cambiando a método directo...`);
      errors.push(`Apify: ${err.message}`);
    }
  }

  // Intento 2: Scraping web directo
  try {
    const posts = await scrapeViaDirectWeb(username);
    if (posts && posts.length > 0) {
      console.log(`[Scraper] Se obtuvieron ${posts.length} publicaciones vía Direct Web.`);
      return posts;
    }
  } catch (err) {
    console.warn(`[Scraper] Falló Direct Web (${err.message}).`);
    errors.push(`DirectWeb: ${err.message}`);
  }

  throw new Error(`No se pudieron obtener publicaciones de @${username}. Errores: ${errors.join(' | ')}`);
}

module.exports = {
  getLatestPosts,
  scrapeViaApify,
  scrapeViaDirectWeb,
  normalizePost
};
