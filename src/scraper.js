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
    const match = raw.url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (match) shortcode = match[1];
  }

  const postUrl = (raw.url && typeof raw.url === 'string' && raw.url.startsWith('http'))
    ? raw.url
    : (shortcode ? `https://www.instagram.com/p/${shortcode}/` : '');

  const id = String(raw.id || shortcode || raw.pk || Date.now());

  let ts = 0;
  if (raw.timestamp) {
    ts = typeof raw.timestamp === 'string' ? Math.floor(new Date(raw.timestamp).getTime() / 1000) : Number(raw.timestamp);
  } else if (raw.taken_at_timestamp) {
    ts = Number(raw.taken_at_timestamp);
  } else if (raw.takenAt) {
    ts = typeof raw.takenAt === 'string' ? Math.floor(new Date(raw.takenAt).getTime() / 1000) : Number(raw.takenAt);
  } else if (raw.date) {
    ts = Math.floor(new Date(raw.date).getTime() / 1000);
  }

  return {
    id,
    shortcode: shortcode || id,
    url: postUrl,
    caption: raw.caption || raw.text || '',
    displayUrl: raw.displayUrl || raw.imageUrl || raw.display_url || (raw.images && raw.images[0]) || '',
    videoUrl: raw.videoUrl || raw.video_url || null,
    isVideo: Boolean(raw.isVideo || raw.is_video || raw.type === 'Video' || raw.videoUrl),
    timestamp: ts
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
  const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${config.apifyApiToken}&timeout=120`;

  const inputData = {
    directUrls: [`https://www.instagram.com/${username}/`],
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
    throw new Error(`Apify respondió con estado ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    console.warn('[Scraper Apify] No se obtuvieron publicaciones en el dataset.');
    return [];
  }

  // Filtrar solo los elementos que son publicaciones reales
  const validPosts = items
    .filter(item => item && (item.shortCode || item.code || (typeof item.url === 'string' && (item.url.includes('/p/') || item.url.includes('/reel/') || item.url.includes('/tv/'))) || item.displayUrl || item.type === 'Image' || item.type === 'Video' || item.type === 'Sidecar'))
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
/**
 * Estrategia 0: Recuperar publicaciones del dataset más reciente de Apify (ultra rápido, ~300ms)
 */
async function getPostsFromLatestDataset(username, limit = 12) {
  if (!config.apifyApiToken) return null;

  try {
    const actorId = 'apify~instagram-scraper';
    const runsUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${config.apifyApiToken}&limit=5&desc=true`;
    const runsRes = await fetch(runsUrl);
    if (!runsRes.ok) return null;
    const runsData = await runsRes.json();
    const runs = runsData?.data?.items;
    if (!Array.isArray(runs) || runs.length === 0) return null;

    const succeededRun = runs.find(r => r.status === 'SUCCEEDED' && r.defaultDatasetId);
    if (!succeededRun) return null;

    // Si el dataset tiene más de 2 horas de antigüedad, solicitar scrape en vivo a Instagram
    const MAX_CACHE_AGE_MS = 2 * 60 * 60 * 1000;
    const finishedAtMs = succeededRun.finishedAt ? new Date(succeededRun.finishedAt).getTime() : 0;
    if (Date.now() - finishedAtMs > MAX_CACHE_AGE_MS) {
      console.log(`[Scraper] El dataset en Apify tiene más de 2 horas (${succeededRun.finishedAt}). Se consultará Instagram en vivo.`);
      return null;
    }

    const datasetId = succeededRun.defaultDatasetId;
    const itemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items`;
    const itemsRes = await fetch(itemsUrl);
    if (!itemsRes.ok) return null;
    const items = await itemsRes.json();

    if (Array.isArray(items) && items.length > 0) {
      const validPosts = items
        .filter(item => item && (item.shortCode || item.code || (typeof item.url === 'string' && (item.url.includes('/p/') || item.url.includes('/reel/') || item.url.includes('/tv/'))) || item.displayUrl || item.type === 'Image' || item.type === 'Video' || item.type === 'Sidecar'))
        .map(normalizePost);

      // Ordenar determinísticamente de más reciente a más antiguo
      validPosts.sort((a, b) => {
        const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
        if (timeDiff !== 0) return timeDiff;
        return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
      });

      if (validPosts.length >= Math.min(limit, 10)) {
        console.log(`[Scraper] Se recuperaron ${validPosts.length} publicaciones del dataset previo en Apify.`);
        return validPosts;
      }
    }
  } catch (e) {
    console.warn('[Scraper] Falló recuperación de dataset previo:', e.message);
  }
  return null;
}

/**
 * Función principal para obtener las últimas publicaciones
 * Aplica estrategia en cascada: Dataset Apify -> Ejecutar Apify -> Direct Web
 */
async function getLatestPosts(username = config.instagramUsername, limit = 12, forceFresh = false) {
  const errors = [];

  // Intento 0: Dataset reciente de Apify (si no se fuerza un scrape nuevo)
  if (!forceFresh && config.apifyApiToken) {
    try {
      const cached = await getPostsFromLatestDataset(username, limit);
      if (cached && cached.length > 0) {
        return cached;
      }
    } catch (_) {}
  }

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
  getPostsFromLatestDataset,
  scrapeViaApify,
  scrapeViaDirectWeb,
  normalizePost
};
