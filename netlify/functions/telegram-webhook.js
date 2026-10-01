/**
 * Netlify Function: /api/telegram-webhook
 * Manejador del webhook de Telegram para interactuar con el bot mediante comandos
 */
const config = require('../../src/config');
const telegram = require('../../src/telegram');
const { runSync } = require('../../src/syncService');
const { getPostedIds } = require('../../src/storage');
const scraper = require('../../src/scraper');
const { translateToSpanish } = require('../../src/translator');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook activo. Esperando peticiones POST de Telegram.' })
    };
  }

  try {
    const update = JSON.parse(event.body || '{}');
    const message = update.message || update.channel_post;

    if (!message || !message.text) {
      return { statusCode: 200, body: 'OK' };
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Manejador del comando /start
    if (text.startsWith('/start')) {
      const welcome = `🎀 <b>¡Hola! Soy el Bot de Sanrio para Telegram</b> 🌸\n\n` +
        `Monitoreo el perfil oficial de Instagram <b>@${config.instagramUsername}</b> y publico las novedades traducidas al español en tu canal en modalidad <b>1 publicación al día</b>.\n\n` +
        `📌 <b>Comandos disponibles:</b>\n` +
        `• <code>/sync [N]</code> - Sincroniza publicaciones nuevas (por defecto 1)\n` +
        `• <code>/import [N]</code> - Importa y traduce de inmediato N publicaciones (ej: <code>/import 1</code> o <code>/import 5</code>)\n` +
        `• <code>/import10</code> - Importa las últimas 10 publicaciones de golpe\n` +
        `• <code>/latest</code> - Ver la última publicación de Sanrio en español\n` +
        `• <code>/status</code> - Ver el estado del bot y configuración\n` +
        `• <code>/help</code> - Ayuda e instrucciones`;
      
      await telegram.sendMessage(chatId, welcome);
      return { statusCode: 200, body: 'OK' };
    }

    // Manejador del comando /help
    if (text.startsWith('/help')) {
      const helpMsg = `ℹ️ <b>Instrucciones de Uso:</b>\n\n` +
        `1. Asegúrate de añadir este bot como <b>Administrador</b> a tu canal: <code>${config.telegramChannelId || '@tu_canal'}</code>.\n` +
        `2. Las publicaciones se traducen al español automáticamente.\n` +
        `3. <b>Modo diario:</b> Netlify ejecuta automáticamente la publicación de <b>1 post al día</b>.\n` +
        `4. Usa <code>/import 1</code> para publicar la última publicación ahora mismo.\n` +
        `5. Puedes especificar cualquier cantidad: <code>/import 3</code> o <code>/sync 2</code>.`;

      await telegram.sendMessage(chatId, helpMsg);
      return { statusCode: 200, body: 'OK' };
    }

    // Manejador del comando /status
    if (text.startsWith('/status')) {
      const validation = config.validate();
      const postedIds = await getPostedIds();

      const statusMsg = `📊 <b>Estado del Bot de Sanrio:</b>\n\n` +
        `• <b>Perfil de Instagram:</b> @${config.instagramUsername}\n` +
        `• <b>Canal destino:</b> <code>${config.telegramChannelId || 'No configurado'}</code>\n` +
        `• <b>Modalidad:</b> 1 publicación al día (programada)\n` +
        `• <b>Scraping con Apify:</b> ${config.apifyApiToken ? '✅ Activo' : '⚪ Desactivado (Fallback directo)'}\n` +
        `• <b>Traducción a español:</b> ✅ Activa (Automática)\n` +
        `• <b>Publicaciones registradas:</b> ${postedIds.size}\n` +
        `• <b>Configuración:</b> ${validation.isValid ? '✅ Válida' : '⚠️ Incompleta'}`;

      await telegram.sendMessage(chatId, statusMsg);
      return { statusCode: 200, body: 'OK' };
    }

    // Manejador del comando /latest
    if (text.startsWith('/latest')) {
      await telegram.sendMessage(chatId, `🔍 Buscando la última publicación de @${config.instagramUsername}...`);
      try {
        const posts = await scraper.getLatestPosts(config.instagramUsername, 1);
        if (posts && posts.length > 0) {
          const latest = posts[0];
          if (latest.caption) {
            const { translatedText, isTranslated } = await translateToSpanish(latest.caption);
            latest.translatedCaption = translatedText;
            latest.isTranslated = isTranslated;
          }
          await telegram.sendInstagramPost(chatId, latest);
        } else {
          await telegram.sendMessage(chatId, 'No se encontraron publicaciones disponibles actualmente.');
        }
      } catch (err) {
        await telegram.sendMessage(chatId, `⚠️ Error al consultar Instagram: ${err.message}`);
      }
      return { statusCode: 200, body: 'OK' };
    }

    // Manejador del comando /import, /importar o /import10
    if (text.startsWith('/import') || text.startsWith('/importar')) {
      let limit = 1;
      if (text.startsWith('/import10')) {
        limit = 10;
      } else {
        const parts = text.split(/\s+/);
        if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
          limit = Math.min(Math.max(parseInt(parts[1], 10), 1), 20);
        }
      }

      await telegram.sendMessage(
        chatId,
        `⏳ Importando y traduciendo ${limit === 1 ? '1 publicación' : `las últimas ${limit} publicaciones`} de @${config.instagramUsername}...`
      );

      try {
        const result = await runSync({ limit, force: true });
        let report = `✅ <b>Importación completada:</b>\n\n` +
          `• Posts analizados: ${result.totalScraped}\n` +
          `• Posts publicados traducidos al canal: ${result.publishedCount}\n`;

        if (result.errors && result.errors.length > 0) {
          report += `\n⚠️ Hubo ${result.errors.length} error(es) durante el envío.`;
        }

        await telegram.sendMessage(chatId, report);
      } catch (err) {
        await telegram.sendMessage(chatId, `❌ Error durante la importación: ${err.message}`);
      }

      return { statusCode: 200, body: 'OK' };
    }

    // Manejador del comando /sync
    if (text.startsWith('/sync')) {
      let limit = config.maxPostsPerRun || 1;
      const parts = text.split(/\s+/);
      if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
        limit = Math.min(Math.max(parseInt(parts[1], 10), 1), 20);
      }

      await telegram.sendMessage(
        chatId,
        `⏳ Iniciando sincronización de @${config.instagramUsername} (límite: ${limit} post${limit > 1 ? 's' : ''})...`
      );

      try {
        const result = await runSync({ limit });
        let report = `✅ <b>Sincronización finalizada:</b>\n\n` +
          `• Posts analizados: ${result.totalScraped}\n` +
          `• Posts nuevos detectados: ${result.newFound}\n` +
          `• Publicados en el canal: ${result.publishedCount}\n`;

        if (result.errors && result.errors.length > 0) {
          report += `\n⚠️ Hubo ${result.errors.length} error(es) durante el envío.`;
        }

        await telegram.sendMessage(chatId, report);
      } catch (err) {
        await telegram.sendMessage(chatId, `❌ Error durante la sincronización: ${err.message}`);
      }

      return { statusCode: 200, body: 'OK' };
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('[Telegram Webhook] Error procesando mensaje:', error);
    return {
      statusCode: 200, // Retornamos 200 a Telegram para que no reintente indefinidamente
      body: JSON.stringify({ error: error.message })
    };
  }
};
