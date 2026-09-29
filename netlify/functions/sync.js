/**
 * Netlify Function: /api/sync
 * Permite disparar la sincronización de publicaciones manualmente o vía API
 */
const config = require('../../src/config');
const { runSync } = require('../../src/syncService');
const { getPostedIds, getLastRunStatus } = require('../../src/storage');
const telegram = require('../../src/telegram');
const scraper = require('../../src/scraper');
const { translateToSpanish } = require('../../src/translator');

exports.handler = async (event, context) => {
  // Configuración de cabeceras CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-sync-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    
    // Si se consulta el estado general del bot
    if (params.action === 'status') {
      const validation = config.validate();
      const postedIds = await getPostedIds();
      const lastRun = await getLastRunStatus();
      let botInfo = null;

      if (config.telegramBotToken) {
        try {
          botInfo = await telegram.getMe();
        } catch (e) {
          botInfo = { error: e.message };
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          config: {
            hasTelegramToken: Boolean(config.telegramBotToken),
            channelId: config.telegramChannelId || 'No configurado',
            instagramUsername: config.instagramUsername,
            hasApifyToken: Boolean(config.apifyApiToken),
            isConfigValid: validation.isValid,
            missingVars: validation.missing
          },
          bot: botInfo,
          stats: {
            totalPostedRecorded: postedIds.size,
            lastRun: lastRun || null
          }
        }, null, 2)
      };
    }

    // Probar envío directo de mensaje al canal
    if (params.action === 'test_message') {
      try {
        const testRes = await telegram.sendMessage(
          config.telegramChannelId,
          '🌸 <b>¡Hola! Conexión exitosa.</b>\nEl bot de Sanrio está conectado y listo para publicar.'
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'ok',
            message: 'Mensaje de prueba enviado con éxito al canal.',
            channelId: config.telegramChannelId,
            telegramResponse: testRes
          }, null, 2)
        };
      } catch (tgErr) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: `Fallo al enviar mensaje al canal: ${tgErr.message}`,
            channelId: config.telegramChannelId
          }, null, 2)
        };
      }
    }

    // Probar conexión con la API de Apify
    if (params.action === 'test_apify') {
      if (!config.apifyApiToken) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: 'APIFY_API_TOKEN no está configurado.'
          }, null, 2)
        };
      }

      try {
        // 1. Verificar usuario y plan en Apify
        const meRes = await fetch(`https://api.apify.com/v2/users/me?token=${config.apifyApiToken}`);
        const meData = await meRes.json();

        // 2. Obtener últimas ejecuciones del actor en Apify
        const runsRes = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${config.apifyApiToken}&limit=3&desc=true`);
        const runsData = runsRes.ok ? await runsRes.json() : { error: `HTTP ${runsRes.status}` };

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'ok',
            tokenValid: meRes.ok,
            user: meData?.data ? {
              username: meData.data.username,
              email: meData.data.email,
              plan: meData.data.plan
            } : meData,
            recentRuns: runsData?.data?.items || runsData
          }, null, 2)
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: `Fallo al conectar con Apify: ${err.message}`
          }, null, 2)
        };
      }
    }

    // Publicar 1 post real traducido al canal para verificar publicación multimedia
    if (params.action === 'publish_test_post') {
      try {
        const posts = await scraper.getLatestPosts(config.instagramUsername, 1);
        if (!posts || posts.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ status: 'error', message: 'No se obtuvieron publicaciones' }, null, 2)
          };
        }

        const post = posts[0];
        if (post.caption) {
          const { translatedText, isTranslated } = await translateToSpanish(post.caption);
          post.translatedCaption = translatedText;
          post.isTranslated = isTranslated;
        }

        const tgResult = await telegram.sendInstagramPost(config.telegramChannelId, post);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'ok',
            message: 'Publicación de prueba enviada con éxito',
            post: {
              id: post.id,
              shortcode: post.shortcode,
              originalCaption: post.caption,
              translatedCaption: post.translatedCaption
            },
            telegramResult: tgResult
          }, null, 2)
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: err.message,
            stack: err.stack
          }, null, 2)
        };
      }
    }

    // Probar Netlify Blobs
    if (params.action === 'test_blobs') {
      try {
        const { getStore } = require('@netlify/blobs');
        const store = getStore({ name: 'sanrio-posted-posts' });
        await store.setJSON('test_key', { ok: true, now: new Date().toISOString() });
        const val = await store.get('test_key', { type: 'json' });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'ok', blobsAvailable: true, readValue: val }, null, 2)
        };
      } catch (bErr) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ status: 'error', error: bErr.message, stack: bErr.stack }, null, 2)
        };
      }
    }

    // Importar directamente los últimos 10 posts traducidos
    if (params.action === 'import_10') {
      try {
        const result = await runSync({ force: true, limit: 10 });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'ok',
            message: `Se importaron y publicaron ${result.publishedCount} publicaciones traducidas al español.`,
            result
          }, null, 2)
        };
      } catch (impErr) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: impErr.message,
            stack: impErr.stack
          }, null, 2)
        };
      }
    }

    // Si se desea configurar el webhook de Telegram directamente
    if (params.action === 'setup_webhook') {
      if (!config.telegramBotToken) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: 'Netlify aún no tiene acceso a TELEGRAM_BOT_TOKEN. Si lo acabas de configurar en Site Configuration > Environment variables, debes ir a la pestaña "Deploys" y pulsar "Trigger deploy" > "Deploy site" para que las funciones se actualicen con las nuevas variables.'
          }, null, 2)
        };
      }

      let baseUrl = params.siteUrl ? params.siteUrl.trim() : '';
      if (!baseUrl) {
        const host = event.headers.host || event.headers['x-forwarded-host'];
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        if (host) {
          baseUrl = `${protocol}://${host}`;
        }
      }

      if (!baseUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: 'No se pudo determinar la URL de tu sitio. Por favor escribe https://tu-sitio.netlify.app en el campo de texto y pulsa Vincular Webhook.'
          }, null, 2)
        };
      }

      // Remover cualquier barra final
      baseUrl = baseUrl.replace(/\/+$/, '');
      const webhookUrl = `${baseUrl}/.netlify/functions/telegram-webhook`;

      try {
        const result = await telegram.setWebhook(webhookUrl);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'ok',
            message: `Webhook configurado con éxito hacia ${webhookUrl}`,
            result
          }, null, 2)
        };
      } catch (tgError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            status: 'error',
            message: `Telegram rechazó el webhook: ${tgError.message}`
          }, null, 2)
        };
      }
    }

    // Verificación de secreto si está configurado
    if (config.syncSecret) {
      const secretProvided = event.headers['x-sync-secret'] || params.secret;
      if (secretProvided !== config.syncSecret) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'No autorizado. Proporciona una clave syncSecret válida.' })
        };
      }
    }

    const dryRun = params.dryRun === 'true' || params.dryRun === '1';
    const force = params.force === 'true' || params.force === '1';
    const limit = params.limit ? parseInt(params.limit, 10) : (config.maxPostsPerRun || 10);
    const result = await runSync({ dryRun, force, limit });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        result
      }, null, 2)
    };

  } catch (error) {
    console.error('[Function /api/sync] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: error.message
      }, null, 2)
    };
  }
};
