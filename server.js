const express = require('express');
const cors_proxy = require('./lib/cors-anywhere');

// ENV-Konfiguration
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 8080;
const originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
const originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
const checkRateLimit = require('./lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

function parseEnvList(env) {
  if (!env) return [];
  return env.split(',');
}

const app = express();

const proxy = cors_proxy.createServer({
  originBlacklist,
  originWhitelist,
  requireHeader: ['origin', 'x-requested-with'],
  checkRateLimit,
  removeHeaders: [
    'cookie', 'cookie2',
    'x-request-start', 'x-request-id', 'via', 'connect-time', 'total-route-time',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    xfwd: false,
  },
});

// Custom Base64 Proxy Endpoint
app.use('/proxy', (req, res) => {
  const encodedUrl = req.query.url;
  if (!encodedUrl) {
    return res.status(400).send('Missing ?url parameter (Base64 encoded)');
  }

  let decodedUrl;
  try {
    decodedUrl = Buffer.from(encodedUrl, 'base64').toString('utf8');
    if (!/^https?:\/\//.test(decodedUrl)) {
      return res.status(400).send('Decoded URL must start with http:// or https://');
    }
  } catch (err) {
    return res.status(400).send('Invalid Base64 URL');
  }

  // Setze req.url für den Proxy auf den dekodierten Pfad
  req.url = '/' + decodedUrl;

  proxy.emit('request', req, res);
});

// Alle anderen Anfragen normal per Proxy weiterleiten
app.use((req, res) => {
  proxy.emit('request', req, res);
});

app.listen(port, host, () => {
  console.log(`✅ CORS Anywhere mit Base64-Support läuft auf ${host}:${port}`);
});
