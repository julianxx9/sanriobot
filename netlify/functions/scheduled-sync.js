/**
 * Netlify Scheduled Function: Sincronización periódica automática
 * Ejecutada según la regla 'schedule' de Netlify (por defecto cada hora)
 */
const { schedule } = require('@netlify/functions');
const { runSync } = require('../../src/syncService');

const handler = async (event) => {
  console.log('[Scheduled Sync] Tarea cron iniciada:', new Date().toISOString());

  try {
    const result = await runSync();
    console.log('[Scheduled Sync] Tarea finalizada con éxito:', JSON.stringify(result));
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

// Se programa para ejecutarse cada hora
module.exports.handler = schedule('@hourly', handler);
