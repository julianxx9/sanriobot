/**
 * Netlify Scheduled Function: Sincronización periódica automática
 * Ejecutada según la regla 'schedule' de Netlify (por defecto cada hora)
 */
const { schedule } = require('@netlify/functions');
const { runSync } = require('../../src/syncService');

const handler = async (event) => {
  console.log('[Scheduled Sync] Tarea cron iniciada:', new Date().toISOString());

  try {
    const result = await runSync({ limit: 1 });
    console.log('[Scheduled Sync] Tarea finalizada con éxito (1 post al día):', JSON.stringify(result));
    return {
      statusCode: 200
    };
  } catch (err) {
    console.error('[Scheduled Sync] Error en ejecución programada:', err.message);
    return {
      statusCode: 500
    };
  }
};

// Se programa para ejecutarse una vez al día (13:00 UTC / 8:00 AM UTC-5)
module.exports.handler = schedule('0 13 * * *', handler);

