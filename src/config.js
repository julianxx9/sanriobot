try {
  require('dotenv').config();
} catch (_) {}

const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
  instagramUsername: process.env.INSTAGRAM_USERNAME || 'sanrio',
  apifyApiToken: process.env.APIFY_API_TOKEN || '',
  syncSecret: process.env.SYNC_SECRET || '',
  maxPostsPerRun: parseInt(process.env.MAX_POSTS_PER_RUN, 10) || 1,
  isNetlify: Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME),

  validate() {
    const missing = [];
    if (!this.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
    if (!this.telegramChannelId) missing.push('TELEGRAM_CHANNEL_ID');
    return {
      isValid: missing.length === 0,
      missing
    };
  }
};

module.exports = config;
