/**
 * Netlify Background Function: sync-background
 * Permite ejecutar tareas de scraping y traducción que tomen más de 30 segundos
 * (Netlify Background Functions admiten hasta 15 minutos de ejecución)
 */
const { runSync } = require('../../src/syncService');

exports.handler = async (event, context) => {
  console.log('[Sync Background] Iniciando ejecución en segundo plano...', new Date().toISOString());

  try {
    const params = event.queryStringParameters || {};
    const force = params.force === 'true' || params.force === '1' || true; // Por defecto true para importaciones
    const limit = params.limit ? parseInt(params.limit, 10) : 10;

    const result = await runSync({ force, limit });
    console.log('[Sync Background] Resultado de la importación:', JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', result })
    };
  } catch (error) {
    console.error('[Sync Background] Error durante la ejecución:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
};
