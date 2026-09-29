# 🎀 Sanrio Telegram Channel Bot (Node.js & Netlify)

Bot de Telegram desarrollado en **Node.js** optimizado para desplegarse en **Netlify** mediante **Serverless Functions** y **Scheduled Functions** (tareas cron automáticas).

Monitorea periódicamente el perfil oficial de Instagram de Sanrio ([@sanrio](https://www.instagram.com/sanrio/)), detecta nuevas publicaciones y las envía automáticamente a tu canal de Telegram con imagen/video, texto explicativo y enlace directo.

---

## 🌟 Características

- ⏱️ **Automatización Total Serverless**: Se ejecuta automáticamente cada hora en Netlify gracias a `Scheduled Functions` sin requerir un servidor dedicado 24/7.
- ⚡ **Scraping Dual Inteligente**:
  - **Apify Integration**: Compatible con los scrapers profesionales del repositorio [cporter202/social-media-scraping-apis](https://github.com/cporter202/social-media-scraping-apis) utilizando `apify/instagram-scraper` con proxies rotativos.
  - **Fallback Directo**: Scraping web público directo sin necesidad de credenciales externas si no se usa Apify.
- 🛡️ **De-duplicación con Netlify Blobs**: Evita publicaciones repetidas mediante `@netlify/blobs` y caché local.
- 💬 **Webhook Interactivo**: El bot responde a comandos directos en Telegram (`/sync`, `/latest`, `/status`, `/help`).
- 🌸 **Panel Web de Control (Dashboard)**: Interfaz gráfica temática de Sanrio alojada en Netlify para probar sincronizaciones con 1 clic y verificar el estado.

---

## 📁 Estructura del Proyecto

```
sanrio/
├── netlify/
│   └── functions/
│       ├── scheduled-sync.js      # Función cron ejecutada periódicamente en Netlify
│       ├── telegram-webhook.js    # Webhook para recibir comandos de Telegram
│       └── sync.js                # API para sincronización manual (/api/sync)
├── src/
│   ├── scraper.js                 # Extractor de posts (Apify y Directo)
│   ├── telegram.js                # Cliente de Telegram Bot API
│   ├── storage.js                 # Almacén de posts procesados (Netlify Blobs / Local)
│   ├── syncService.js             # Lógica central del ciclo de sincronización
│   └── config.js                  # Configuración y variables de entorno
├── public/
│   ├── index.html                 # Panel de control web visual
│   ├── style.css                  # Estilos del panel (tema Sanrio)
│   └── app.js                     # Controlador del panel de control
├── scripts/
│   ├── local-sync.js              # Ejecución de prueba local con 'node'
│   └── test-scraper.js            # Prueba aislada del scraper de Instagram
├── .env.example                   # Plantilla de variables de entorno
├── netlify.toml                   # Configuración de despliegue en Netlify
├── package.json                   # Dependencias de Node.js
└── README.md                      # Documentación y guía de uso
```

---

## 🚀 Guía de Configuración Paso a Paso

### 1. Crear el Bot en Telegram
1. Abre Telegram y busca al bot oficial [@BotFather](https://t.me/BotFather).
2. Envía el comando `/newbot`.
3. Asigna un nombre (ej. `Sanrio Channel Bot`) y un username que termine en `bot` (ej. `MiSanrioCanal_bot`).
4. `@BotFather` te entregará un token con formato: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`. Guárdalo, este es tu `TELEGRAM_BOT_TOKEN`.

### 2. Crear el Canal y Agregar el Bot como Administrador
1. En Telegram, crea un **Nuevo Canal** (puede ser público o privado).
2. Entra a la configuración del canal > **Administradores** > **Añadir Administrador**.
3. Busca el username de tu bot y agrégalo.
4. Asegúrate de concederle el permiso **Publicar mensajes**.
5. Si el canal es público, tu `TELEGRAM_CHANNEL_ID` será `@nombre_de_tu_canal`.

---

## ☁️ Despliegue en Netlify

### Opción A: Desde GitHub (Recomendada)
1. Sube este proyecto a tu cuenta de GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Sanrio Telegram Bot"
   git remote add origin https://github.com/TU_USUARIO/sanrio-bot.git
   git push -u origin main
   ```
2. Ve a [Netlify](https://app.netlify.com/) y selecciona **Add new site** > **Import an existing project** > **GitHub**.
3. Selecciona tu repositorio.
4. En **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `public`
5. En **Environment variables**, añade las siguientes variables:

| Variable | Valor | Obligatoria |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather | **Sí** |
| `TELEGRAM_CHANNEL_ID` | `@tu_canal` o ID numérico | **Sí** |
| `INSTAGRAM_USERNAME` | `sanrio` | No (por defecto `sanrio`) |
| `APIFY_API_TOKEN` | Token de Apify (del repo sugerido) | Opcional |
| `SYNC_SECRET` | Clave para proteger `/api/sync` | Opcional |
| `MAX_POSTS_PER_RUN` | `3` | Opcional |

6. Haz clic en **Deploy Site**.
7. Una vez desplegado, abre la URL de tu sitio en el navegador (ej. `https://tu-sitio.netlify.app`) y haz clic en **"Vincular Webhook"** para que tu bot reciba comandos en tiempo real.

---

## 🔑 Uso de Apify (del repositorio sugerido)

El repositorio [cporter202/social-media-scraping-apis](https://github.com/cporter202/social-media-scraping-apis) cataloga APIs y actores de Apify para Instagram:
- Si configuras la variable `APIFY_API_TOKEN` con tu token de [Apify](https://apify.com/), el bot utilizará el actor `apify/instagram-scraper` con proxies residenciales automáticos, garantizando un 100% de éxito contra bloqueos de Instagram.
- Si dejas `APIFY_API_TOKEN` vacío, el bot usará el scraper directo web como fallback.

---

## 💬 Comandos de Telegram

Una vez vinculado el webhook, puedes escribirle al bot directamente:
- `/sync`: Dispara una sincronización y publica los nuevos posts en el canal de inmediato.
- `/latest`: Muestra la publicación más reciente encontrada en Instagram @sanrio.
- `/status`: Muestra la salud del bot, posts registrados y configuración.
- `/help`: Guía rápida de uso.

---

## 💻 Pruebas Locales

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y coloca tus credenciales:
   ```bash
   cp .env.example .env
   ```
3. Prueba la extracción de Instagram:
   ```bash
   node scripts/test-scraper.js
   ```
4. Prueba la sincronización completa en modo simulación (Dry Run):
   ```bash
   node scripts/local-sync.js --dry-run
   ```
5. Publicar realmente:
   ```bash
   node scripts/local-sync.js
   ```
