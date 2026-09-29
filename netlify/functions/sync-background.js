/**
 * Netlify Background Function: sync-background
 * Permite ejecutar tareas de scraping y traducción que tomen más de 30 segundos
 * (Netlify Background Functions admiten hasta 15 minutos de ejecución)
 */
const { runSync } = require('../../src/syncService');
const { recordRunStatus } = require('../../src/storage');
const telegram = require('../../src/telegram');
const config = require('../../src/config');

exports.handler = async (event, context) => {
  const startedAt = new Date().toISOString();
  console.log('[Sync Background] Iniciando ejecución en segundo plano...', startedAt);

  const params = event.queryStringParameters || {};
  const force = params.force === 'true' || params.force === '1' || true;
  const limit = params.limit ? parseInt(params.limit, 10) : 10;

  await recordRunStatus({
    status: 'running',
    startedAt,
    limit,
    force
  });

  try {
    const result = await runSync({ force, limit });
    console.log('[Sync Background] Resultado de la importación:', JSON.stringify(result, null, 2));

    await recordRunStatus({
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      result
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', result })
    };
  } catch (error) {
    console.error('[Sync Background] Error durante la ejecución:', error.message);

    await recordRunStatus({
      status: 'error',
      startedAt,
      failedAt: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });

    try {
      if (config.telegramChannelId) {
        await telegram.sendMessage(
          config.telegramChannelId,
          `⚠️ <b>Aviso de importación Sanrio:</b>\nNo se pudieron importar publicaciones en este ciclo:\n<code>${error.message}</code>`
        );
      }
    } catch (_) {}

    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
};

exports.config = {
  background: true
};
