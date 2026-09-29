/**
 * Módulo de almacenamiento de publicaciones procesadas
 * Soporta @netlify/blobs (producción en Netlify) y fallback a archivo local JSON (desarrollo local / tmp)
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const LOCAL_DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'posted_posts.json');
const BLOB_STORE_NAME = 'sanrio-posted-posts';
const BLOB_KEY = 'posted_ids_list';

let memoryCache = null;

/**
 * Obtiene el store de Netlify Blobs si está disponible
 */
function getNetlifyStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore({ name: BLOB_STORE_NAME });
  } catch (err) {
    return null;
  }
}

/**
 * Lee la lista local de publicaciones desde archivo o /tmp
 */
function readLocalFile() {
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const content = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    // Si falla por permisos o directorio, intentar en /tmp
    const tmpFile = path.join('/tmp', 'sanrio_posted_posts.json');
    if (fs.existsSync(tmpFile)) {
      try {
        return JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
      } catch (_) {}
    }
  }
  return [];
}

/**
 * Guarda la lista localmente en disco o /tmp
 */
function saveLocalFile(data) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    try {
      const tmpFile = path.join('/tmp', 'sanrio_posted_posts.json');
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }
}

/**
 * Obtiene el conjunto de todos los IDs ya publicados
 * @returns {Promise<Set<string>>}
 */
async function getPostedIds() {
  if (memoryCache !== null) {
    return memoryCache;
  }

  const store = getNetlifyStore();
  if (store && config.isNetlify) {
    try {
      const blob = await store.get(BLOB_KEY, { type: 'json' });
      if (Array.isArray(blob)) {
        memoryCache = new Set(blob);
        return memoryCache;
      }
    } catch (err) {
      console.warn('Advertencia al consultar Netlify Blobs, usando fallback local:', err.message);
    }
  }

  const localList = readLocalFile();
  memoryCache = new Set(localList);
  return memoryCache;
}

/**
 * Verifica si un ID de publicación ya fue enviado
 * @param {string} postId
 * @returns {Promise<boolean>}
 */
async function hasBeenPosted(postId) {
  if (!postId) return false;
  const set = await getPostedIds();
  return set.has(String(postId));
}

/**
 * Registra una o varias publicaciones como enviadas
 * @param {string|string[]} postIds
 * @param {object} [metadata]
 */
async function markAsPosted(postIds) {
  const ids = Array.isArray(postIds) ? postIds : [postIds];
  const set = await getPostedIds();
  
  let changed = false;
  for (const id of ids) {
    const strId = String(id);
    if (!set.has(strId)) {
      set.add(strId);
      changed = true;
    }
  }

  if (!changed) return;

  const array = Array.from(set);
  memoryCache = set;

  const store = getNetlifyStore();
  if (store && config.isNetlify) {
    try {
      await store.setJSON(BLOB_KEY, array);
    } catch (err) {
      console.warn('Error al guardar en Netlify Blobs:', err.message);
    }
  }

  saveLocalFile(array);
}

const LAST_RUN_KEY = 'last_run_status';
const LOCAL_LAST_RUN_FILE = path.join(LOCAL_DATA_DIR, 'last_run.json');

/**
 * Guarda el resumen de la última ejecución
 */
async function recordRunStatus(data) {
  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  };

  const store = getNetlifyStore();
  if (store && config.isNetlify) {
    try {
      await store.setJSON(LAST_RUN_KEY, payload);
    } catch (err) {
      console.warn('Error al guardar status en Blobs:', err.message);
    }
  }

  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_LAST_RUN_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Obtiene el resumen de la última ejecución
 */
async function getLastRunStatus() {
  const store = getNetlifyStore();
  if (store && config.isNetlify) {
    try {
      const data = await store.get(LAST_RUN_KEY, { type: 'json' });
      if (data) return data;
    } catch (_) {}
  }

  try {
    if (fs.existsSync(LOCAL_LAST_RUN_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_LAST_RUN_FILE, 'utf8'));
    }
  } catch (_) {}

  return null;
}

module.exports = {
  getPostedIds,
  hasBeenPosted,
  markAsPosted,
  recordRunStatus,
  getLastRunStatus
};
