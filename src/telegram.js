/**
 * Módulo de integración con la API de Telegram Bot
 */
const config = require('./config');

const BASE_URL = 'https://api.telegram.org';

/**
 * Realiza una llamada a la API de Telegram
 */
async function callTelegramApi(method, payload) {
  if (!config.telegramBotToken) {
    throw new Error('Falta configurar TELEGRAM_BOT_TOKEN');
  }

  const url = `${BASE_URL}/bot${config.telegramBotToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Error en Telegram API (${method}): ${result.description || 'Error desconocido'}`);
  }
  return result.result;
}

/**
 * Escapa caracteres para HTML en Telegram
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Prepara el texto del pie de foto / mensaje para Telegram
 */
function formatPostCaption(post) {
  const title = `🎀 <b>¡Nueva publicación de Sanrio (@${config.instagramUsername})!</b>`;
  const postUrl = post.url || `https://www.instagram.com/p/${post.shortcode}/`;

  let caption = (post.translatedCaption || post.caption || '').trim();
  
  // Límite de caption en Telegram es 1024 caracteres
  const maxCaptionLength = 800;
  if (caption.length > maxCaptionLength) {
    caption = caption.substring(0, maxCaptionLength).trim() + '...';
  }

  let formatted = `${title}\n\n`;
  if (caption) {
    formatted += `${escapeHtml(caption)}\n\n`;
  }
  formatted += `💖 <a href="${postUrl}">Ver publicación en Instagram</a>`;
  return formatted;
}

/**
 * Envía una publicación al canal de Telegram
 * @param {string} targetChatId - ID del canal o chat (opcional, usa el de config si no se especifica)
 * @param {object} post - Objeto con información del post
 */
async function sendInstagramPost(targetChatId, post) {
  const chatId = targetChatId || config.telegramChannelId;
  if (!chatId) {
    throw new Error('No se ha configurado TELEGRAM_CHANNEL_ID');
  }

  const caption = formatPostCaption(post);
  const parse_mode = 'HTML';

  // Si es un video y tenemos URL directa del video
  if (post.isVideo && post.videoUrl) {
    try {
      return await callTelegramApi('sendVideo', {
        chat_id: chatId,
        video: post.videoUrl,
        caption,
        parse_mode,
        supports_streaming: true
      });
    } catch (err) {
      console.warn('Fallo al enviar como video, intentando como foto/enlace:', err.message);
    }
  }

  // Si tiene imagen
  const imageUrl = post.displayUrl || post.imageUrl;
  if (imageUrl) {
    try {
      return await callTelegramApi('sendPhoto', {
        chat_id: chatId,
        photo: imageUrl,
        caption,
        parse_mode
      });
    } catch (err) {
      console.warn('Fallo al enviar foto por URL directa, intentando con mensaje de texto:', err.message);
    }
  }

  // Fallback a mensaje de texto enriquecido con enlace
  const text = `${caption}\n\n${imageUrl ? `<a href="${imageUrl}">&#8205;</a>` : ''}`;
  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode,
    disable_web_page_preview: false
  });
}

/**
 * Envía un mensaje simple
 */
async function sendMessage(chatId, text, options = {}) {
  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview ?? true
  });
}

/**
 * Obtiene los datos del bot para verificar conectividad
 */
async function getMe() {
  return await callTelegramApi('getMe', {});
}

/**
 * Configura el Webhook de Telegram hacia la URL de Netlify
 */
async function setWebhook(webhookUrl) {
  return await callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'channel_post']
  });
}

/**
 * Elimina el webhook actual
 */
async function deleteWebhook() {
  return await callTelegramApi('deleteWebhook', {});
}

module.exports = {
  getMe,
  sendMessage,
  sendInstagramPost,
  setWebhook,
  deleteWebhook,
  formatPostCaption
};
