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
  formatted += `💖 <a href="${escapeHtml(postUrl)}">Ver publicación en Instagram</a>`;
  return formatted;
}

/**
 * Envía una publicación al canal de Telegram
 * @param {string} targetChatId - ID del canal o chat (opcional, usa el de config si no se especifica)
 * @param {object} post - Objeto con información del post
 */
/**
 * Envía una foto a Telegram mediante buffer binario (garantiza entrega ante bloqueos de CDN)
 */
async function sendPhotoBuffer(chatId, buffer, filename, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  form.append('photo', blob, filename || 'photo.jpg');

  const url = `${BASE_URL}/bot${config.telegramBotToken}/sendPhoto`;
  const response = await fetch(url, {
    method: 'POST',
    body: form
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Telegram sendPhoto (buffer) error: ${result.description}`);
  }
  return result.result;
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
  const postUrl = post.url || `https://www.instagram.com/p/${post.shortcode}/`;

  // 1. Si es video y tenemos url directa
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
      console.warn('Fallo al enviar como video URL directa, probando imagen:', err.message);
    }
  }

  // 2. Si tiene imagen, probar por URL
  const imageUrl = post.displayUrl || post.imageUrl;
  if (imageUrl) {
    try {
      return await callTelegramApi('sendPhoto', {
        chat_id: chatId,
        photo: imageUrl,
        caption,
        parse_mode
      });
    } catch (photoUrlErr) {
      console.warn('Fallo al enviar foto por URL, intentando descarga de buffer directa:', photoUrlErr.message);

      // 3. Descargar el buffer de imagen directamente para saltar bloqueos de Instagram
      try {
        const imgRes = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return await sendPhotoBuffer(chatId, buffer, `sanrio_${post.shortcode || post.id}.jpg`, caption);
        }
      } catch (bufErr) {
        console.warn('Fallo al subir imagen en buffer:', bufErr.message);
      }
    }
  }

  // 4. Fallback seguro a mensaje de texto formateado en HTML
  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: caption,
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
