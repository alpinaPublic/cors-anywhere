const express = require('express');
const http = require('http');
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

// Starte den Express-Server
const app = express();

// Custom Base64-Proxy-Endpunkt
app.get('/proxy', (req, res) => {
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

  // Füge den dekodierten Pfad als Fake-URL in req.url ein (benötigt von cors-anywhere)
  req.url = '/' + decodedUrl;

  proxy.emit('request', req, res);
});

// Starte den regulären CORS-Proxy
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

// Binde den Proxy an Express für Standardrouten
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/proxy?')) {
    app(req, res); // delegiere an Express-Handler
  } else {
    proxy.emit('request', req, res);
  }
});

server.listen(port, host, () => {
  console.log('✅ CORS Anywhere mit Base64-Support läuft auf ' + host + ':' + port);
});
