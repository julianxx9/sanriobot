/**
 * Módulo de traducción automática al español
 * Utiliza el endpoint universal de traducción de Google Translate (gtx) sin requerir API keys ni suscripciones
 */

/**
 * Motor 1: Google Translate Chrome Extension API (clients5)
 */
async function translateViaClients5(text) {
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=es&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
    return data[0][0];
  }
  throw new Error('Formato de respuesta desconocido');
}

/**
 * Motor 2: MyMemory Translation API
 */
async function translateViaMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=en|es`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  throw new Error('Respuesta inválida de MyMemory');
}

/**
 * Motor 3: Google Translate gtx
 */
async function translateViaGtx(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const translated = data[0]
      .filter(item => Array.isArray(item) && item[0])
      .map(item => item[0])
      .join('')
      .trim();
    if (translated) return translated;
  }
  throw new Error('Respuesta inválida de gtx');
}

/**
 * Traduce un texto a español usando estrategia en cascada de motores
 * @param {string} text - Texto a traducir
 * @returns {Promise<{ translatedText: string, originalText: string, isTranslated: boolean }>}
 */
async function translateToSpanish(text) {
  if (!text || typeof text !== 'string') {
    return { translatedText: '', originalText: '', isTranslated: false };
  }

  const originalText = text.trim();
  if (!originalText) {
    return { translatedText: '', originalText: '', isTranslated: false };
  }

  // Intento 1: Clients5 (el más rápido y fiable)
  try {
    const translatedText = await translateViaClients5(originalText);
    return {
      translatedText,
      originalText,
      isTranslated: translatedText.toLowerCase() !== originalText.toLowerCase()
    };
  } catch (err1) {
    console.warn('[Translator] Falló Clients5:', err1.message);
  }

  // Intento 2: MyMemory
  try {
    const translatedText = await translateViaMyMemory(originalText);
    return {
      translatedText,
      originalText,
      isTranslated: translatedText.toLowerCase() !== originalText.toLowerCase()
    };
  } catch (err2) {
    console.warn('[Translator] Falló MyMemory:', err2.message);
  }

  // Intento 3: gtx
  try {
    const translatedText = await translateViaGtx(originalText);
    return {
      translatedText,
      originalText,
      isTranslated: translatedText.toLowerCase() !== originalText.toLowerCase()
    };
  } catch (err3) {
    console.warn('[Translator] Falló gtx:', err3.message);
  }

  // Si todos fallan, se conserva el texto original
  return { translatedText: originalText, originalText, isTranslated: false };
}

module.exports = {
  translateToSpanish
};
