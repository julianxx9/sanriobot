/**
 * Netlify Function: /api/sync
 * Permite disparar la sincronización de publicaciones manualmente o vía API
 */
const config = require('../../src/config');
const { runSync } = require('../../src/syncService');
const { getPostedIds } = require('../../src/storage');
const telegram = require('../../src/telegram');

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
            totalPostedRecorded: postedIds.size
          }
        }, null, 2)
      };
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
