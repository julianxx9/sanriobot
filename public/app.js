/**
 * Lógica del panel de control de Sanrio Telegram Bot
 */
document.addEventListener('DOMContentLoaded', () => {
  const consoleOutput = document.getElementById('console-output');
  const btnImport1 = document.getElementById('btn-import-1');
  const btnImport10 = document.getElementById('btn-import-10');
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

  // Elementos de la interfaz de inicio de sesión
  const loginOverlay = document.getElementById('login-overlay');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnTogglePassword = document.getElementById('btn-toggle-password');
  const btnLogout = document.getElementById('btn-logout');
  const currentUserDisplay = document.getElementById('current-user-display');

  const AUTH_STORAGE_KEY = 'sanrio_bot_auth_session';

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.user) return data;
    } catch (_) {}
    return null;
  }

  function setSession(username, token) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: username,
        token: token || 'authenticated',
        loggedInAt: Date.now()
      }));
    } catch (_) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (_) {}
  }

  function showDashboard(username) {
    if (currentUserDisplay) {
      currentUserDisplay.textContent = username || 'anderson';
    }
    if (loginOverlay) {
      loginOverlay.style.display = 'none';
    }
    if (dashboardContainer) {
      dashboardContainer.style.display = 'block';
    }
    checkStatus();
  }

  function showLogin() {
    if (dashboardContainer) {
      dashboardContainer.style.display = 'none';
    }
    if (loginOverlay) {
      loginOverlay.style.display = 'flex';
    }
    if (loginError) {
      loginError.style.display = 'none';
    }
    if (loginPasswordInput) {
      loginPasswordInput.value = '';
    }
    if (loginUsernameInput) {
      loginUsernameInput.focus();
    }
  }

  // Alternar visibilidad de contraseña
  if (btnTogglePassword && loginPasswordInput) {
    btnTogglePassword.addEventListener('click', () => {
      const isPassword = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isPassword ? 'text' : 'password';
      btnTogglePassword.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // Envío del formulario de login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (loginUsernameInput.value || '').trim();
      const password = (loginPasswordInput.value || '').trim();

      const btnSubmit = document.getElementById('btn-login-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Verificando...</span>';
      }

      // Credenciales requeridas: usuario = anderson, contraseña = 4nders()n. o 4nders()n
      const isUserValid = username.toLowerCase() === 'anderson';
      const isPassValid = (password === '4nders()n.' || password === '4nders()n');

      if (isUserValid && isPassValid) {
        setSession('anderson');
        if (loginError) loginError.style.display = 'none';
        showDashboard('anderson');
        appendLog('Sesión iniciada con éxito como anderson.', 'success');
      } else {
        // Validación complementaria contra la API
        try {
          const res = await fetch('/api/sync?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (res.ok && data.status === 'ok') {
            setSession(data.username || 'anderson', data.token);
            if (loginError) loginError.style.display = 'none';
            showDashboard(data.username || 'anderson');
            appendLog('Sesión iniciada con éxito como anderson.', 'success');
            return;
          }
        } catch (_) {}

        if (loginError) {
          loginError.style.display = 'flex';
          loginError.classList.remove('shake');
          void loginError.offsetWidth; // Trigger reflow para animación
          loginError.classList.add('shake');
        }
        if (loginPasswordInput) {
          loginPasswordInput.value = '';
          loginPasswordInput.focus();
        }
      }

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>🌸 Ingresar al Panel</span>';
      }
    });
  }

  // Cerrar sesión
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      clearSession();
      appendLog('Sesión cerrada por el usuario.', 'info');
      showLogin();
    });
  }

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

  // Importar publicaciones traducidas (1 o N)
  async function importPosts(limit = 1) {
    const isSingle = limit === 1;
    appendLog(`🚀 Iniciando importación y traducción de ${isSingle ? '1 publicación' : `${limit} publicaciones`}...`, 'info');
    if (btnImport1) btnImport1.disabled = true;
    if (btnImport10) btnImport10.disabled = true;
    btnSync.disabled = true;
    btnDryRun.disabled = true;

    try {
      const res = await fetch(`/api/sync?action=import&limit=${limit}`, { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        const count = data.result?.publishedCount || 0;
        appendLog(`✨ ¡Éxito total! Se publicaron ${count} publicación(es) traducida(s) al español en tu canal.`, 'success');
        if (data.result?.published) {
          data.result.published.forEach((p, idx) => {
            appendLog(`  #${idx + 1} [${p.shortcode}] Traducido: "${(p.translatedCaption || '').substring(0, 70)}..."`, 'info');
          });
        }
      } else {
        appendLog(`Error al importar: ${data.message || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      appendLog(`Error de red: ${err.message}`, 'error');
    } finally {
      if (btnImport1) btnImport1.disabled = false;
      if (btnImport10) btnImport10.disabled = false;
      btnSync.disabled = false;
      btnDryRun.disabled = false;
      checkStatus();
    }
  }

  // Eventos de botones
  if (btnImport1) btnImport1.addEventListener('click', () => importPosts(1));
  if (btnImport10) btnImport10.addEventListener('click', () => importPosts(10));
  btnSync.addEventListener('click', () => triggerSync(false));
  btnDryRun.addEventListener('click', () => triggerSync(true));
  btnCheckStatus.addEventListener('click', checkStatus);
  btnSetupWebhook.addEventListener('click', setupWebhook);
  btnClearLogs.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
  });

  // Control de inicio: verificar sesión activa
  const existingSession = getStoredSession();
  if (existingSession && existingSession.user) {
    showDashboard(existingSession.user);
  } else {
    showLogin();
  }
});
