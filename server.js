'use strict';

const express = require('express');
const crypto  = require('crypto');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Body parsing — useJwt: false, chega como JSON puro ──────────────────────
app.use(express.json());

// ─── Static files ─────────────────────────────────────────────────────────────
app.get('/config.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'public', 'config.json'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Lifecycle endpoints — save/publish/validate/stop ─────────────────────────
// Ainda chegam como JWT (useJwt: true nos configurationArguments)
// Só precisam retornar 200

app.post('/save', (req, res) => {
  console.log('\n[SAVE] body recebido:', JSON.stringify(req.body));
  res.status(200).json({ status: 'ok' });
});

app.post('/publish', (req, res) => {
  console.log('\n[PUBLISH] body recebido:', JSON.stringify(req.body));
  res.status(200).json({ status: 'ok' });
});

app.post('/validate', (req, res) => {
  console.log('\n[VALIDATE] body recebido:', JSON.stringify(req.body));
  res.status(200).json({ status: 'ok' });
});

app.post('/stop', (req, res) => {
  console.log('\n[STOP] body recebido:', JSON.stringify(req.body));
  res.status(200).json({ status: 'ok' });
});

// ─── /execute — recebe JSON puro (useJwt: false) ─────────────────────────────
// O body já vem com inArguments contendo o blipPayload montado pelo frontend.
// O Mulesoft em produção só faz JSON.parse(blipPayload) e POST para o BLIP.
app.post('/execute', (req, res) => {
  console.log('\n[EXECUTE] body recebido:');
  console.log(JSON.stringify(req.body, null, 2));

  const inArguments = req.body?.inArguments;
  if (!Array.isArray(inArguments) || inArguments.length === 0) {
    console.error('[EXECUTE] inArguments ausente ou vazio');
    return res.status(400).json({ status: 'error', message: 'inArguments ausente' });
  }

  // Achata o array de objetos em objeto único
  const inArgs = inArguments.reduce((acc, obj) => Object.assign(acc, obj), {});

  if (!inArgs.blipPayload) {
    console.error('[EXECUTE] blipPayload ausente');
    return res.status(400).json({ status: 'error', message: 'blipPayload ausente' });
  }

  // Desserializa o blipPayload
  let blipPayload;
  try {
    blipPayload = JSON.parse(inArgs.blipPayload);
  } catch (e) {
    console.error('[EXECUTE] Erro ao parsear blipPayload:', e.message);
    return res.status(400).json({ status: 'error', message: 'blipPayload inválido' });
  }

  // Substitui os placeholders que o Mulesoft preencheria em produção
  const now        = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const uuid       = crypto.randomUUID();
  const payloadStr = JSON.stringify(blipPayload)
    .replace(/\{\{NOW\}\}/g,          now)
    .replace(/\{\{UUID\}\}/g,         uuid)
    .replace(/\{\{MASTER_STATE\}\}/g, process.env.BLIP_MASTER_STATE || 'SEU_BOT@msging.net')
    .replace(/\{\{FLOW_ID\}\}/g,      process.env.BLIP_FLOW_ID      || 'SEU_FLOW_ID');

  blipPayload = JSON.parse(payloadStr);

  console.log('\n[EXECUTE] ✅ Payload que o Mulesoft enviaria ao BLIP:');
  console.log(JSON.stringify(blipPayload, null, 2));

  res.status(200).json({ status: 'ok', blipPayload });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', env: 'heroku-dev', ts: new Date().toISOString() })
);

app.listen(PORT, () =>
  console.log(`[SERVER] Custom Activity rodando na porta ${PORT}`)
);
