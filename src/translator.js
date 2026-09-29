/**
 * Módulo de traducción automática al español
 * Utiliza el endpoint universal de traducción de Google Translate (gtx) sin requerir API keys ni suscripciones
 */

/**
 * Traduce un texto a español (detecta automáticamente el idioma de origen)
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

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(originalText)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`[Translator] Estado HTTP ${res.status}. Usando texto original.`);
      return { translatedText: originalText, originalText, isTranslated: false };
    }

    const data = await res.json();

    // El resultado viene en data[0] como un arreglo de fragmentos [[traducido, original], ...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translatedText = data[0]
        .filter(item => Array.isArray(item) && item[0])
        .map(item => item[0])
        .join('')
        .trim();

      if (translatedText) {
        return {
          translatedText,
          originalText,
          isTranslated: translatedText.toLowerCase() !== originalText.toLowerCase()
        };
      }
    }

    return { translatedText: originalText, originalText, isTranslated: false };
  } catch (err) {
    console.warn(`[Translator] Error al traducir: ${err.message}. Usando texto original.`);
    return { translatedText: originalText, originalText, isTranslated: false };
  }
}

module.exports = {
  translateToSpanish
};
