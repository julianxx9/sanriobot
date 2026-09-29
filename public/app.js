/**
 * Lógica del panel de control de Sanrio Telegram Bot
 */
document.addEventListener('DOMContentLoaded', () => {
  const consoleOutput = document.getElementById('console-output');
  const btnSync = document.getElementById('btn-sync');
  const btnDryRun = document.getElementById('btn-dry-run');
  const btnCheckStatus = document.getElementById('btn-check-status');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const btnSetupWebhook = document.getElementById('btn-setup-webhook');
  const siteUrlInput = document.getElementById('site-url-input');

  const botStatusEl = document.getElementById('bot-status');
  const botUsernameEl = document.getElementById('bot-username');
  const channelNameEl = document.getElementById('channel-name');
  const igProfileEl = document.getElementById('ig-profile');
  const scraperTypeEl = document.getElementById('scraper-type');
  const postsCountEl = document.getElementById('posts-count');

  // Pre-llenar input con la URL actual del sitio
  if (window.location.origin && window.location.origin.startsWith('http')) {
    siteUrlInput.value = window.location.origin;
  }

  function appendLog(message, type = 'info') {
    const p = document.createElement('p');
    p.className = `log-line ${type}`;
    const time = new Date().toLocaleTimeString();
    p.textContent = `[${time}] ${message}`;
    consoleOutput.appendChild(p);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // Consultar estado
  async function checkStatus() {
    appendLog('Consultando estado del bot...', 'info');
    try {
      const res = await fetch('/api/sync?action=status');
      if (!res.ok) {
        throw new Error(`Servidor respondió con código ${res.status}`);
      }
      const data = await res.json();

      // Bot
      if (data.bot && data.bot.username) {
        botStatusEl.innerHTML = `<span class="badge badge-success">Conectado</span>`;
        botUsernameEl.textContent = `@${data.bot.username} (${data.bot.first_name || ''})`;
      } else if (data.config && data.config.hasTelegramToken) {
        botStatusEl.innerHTML = `<span class="badge badge-warn">Token Configurado</span>`;
        botUsernameEl.textContent = data.bot?.error || 'Token presente';
      } else {
        botStatusEl.innerHTML = `<span class="badge badge-error">Sin Configurar</span>`;
        botUsernameEl.textContent = 'Falta TELEGRAM_BOT_TOKEN';
      }

      // Canal
      channelNameEl.textContent = data.config.channelId || 'No configurado';

      // Instagram
      igProfileEl.textContent = `@${data.config.instagramUsername || 'sanrio'}`;

      // Scraper
      if (data.config.hasApifyToken) {
        scraperTypeEl.innerHTML = `<span class="badge badge-success">Apify (API Token)</span>`;
      } else {
        scraperTypeEl.innerHTML = `<span class="badge badge-info">Direct Web Scraping</span>`;
      }

      // Conteo de posts
      postsCountEl.textContent = `${data.stats?.totalPostedRecorded || 0} publicaciones registradas`;

      if (data.config && !data.config.hasTelegramToken) {
        appendLog('⚠️ AVISO: Netlify no tiene cargado TELEGRAM_BOT_TOKEN en las funciones activas. Si ya guardaste las variables en Site Configuration, debes ir a la pestaña "Deploys" y hacer clic en "Trigger deploy" > "Deploy site".', 'warn');
      } else {
        appendLog(`Estado verificado: Bot @${data.bot?.username || 'desconocido'} | Canal: ${data.config.channelId}`, 'success');
      }
      return data;
    } catch (err) {
      botStatusEl.innerHTML = `<span class="badge badge-error">Error</span>`;
      botUsernameEl.textContent = err.message;
      appendLog(`Error al consultar estado: ${err.message}`, 'error');
    }
  }

  // Ejecutar sincronización
  async function triggerSync(dryRun = false) {
    const modeText = dryRun ? 'Simulación (Dry Run)' : 'Sincronización Real';
    appendLog(`Iniciando ${modeText}...`, 'info');

    btnSync.disabled = true;
    btnDryRun.disabled = true;

    try {
      const url = dryRun ? '/api/sync?dryRun=true' : '/api/sync';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (data.status === 'ok') {
        const r = data.result || {};
        appendLog(`Éxito: Se analizaron ${r.totalScraped || 0} posts. Nuevos: ${r.newFound || 0}. Publicados: ${r.publishedCount || 0}.`, 'success');
        
        if (r.published && r.published.length > 0) {
          r.published.forEach(p => {
            appendLog(`  -> Publicación procesada: [${p.shortcode || p.id}] ${p.url || ''}`, 'info');
          });
        }

        if (r.errors && r.errors.length > 0) {
          r.errors.forEach(e => {
            appendLog(`  ⚠️ Error en post ${e.id}: ${e.error}`, 'warn');
          });
        }
      } else {
        appendLog(`Error reportado: ${data.message || 'Desconocido'}`, 'error');
      }
    } catch (err) {
      appendLog(`Error de red al ejecutar sync: ${err.message}`, 'error');
    } finally {
      btnSync.disabled = false;
      btnDryRun.disabled = false;
      checkStatus();
    }
  }

  // Configurar webhook
  async function setupWebhook() {
    const url = siteUrlInput.value.trim();
    appendLog(`Registrando webhook para Telegram...`, 'info');

    try {
      const endpoint = url 
        ? `/api/sync?action=setup_webhook&siteUrl=${encodeURIComponent(url)}`
        : '/api/sync?action=setup_webhook';

      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        appendLog(`Webhook configurado exitosamente: ${data.message}`, 'success');
      } else {
        appendLog(`Error al configurar webhook: ${data.message || data.error || 'Código ' + res.status}`, 'error');
      }
    } catch (err) {
      appendLog(`Fallo al registrar webhook: ${err.message}`, 'error');
    }
  }

  // Eventos de botones
  btnSync.addEventListener('click', () => triggerSync(false));
  btnDryRun.addEventListener('click', () => triggerSync(true));
  btnCheckStatus.addEventListener('click', checkStatus);
  btnSetupWebhook.addEventListener('click', setupWebhook);
  btnClearLogs.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
  });

  // Ejecutar verificación inicial
  checkStatus();
});
