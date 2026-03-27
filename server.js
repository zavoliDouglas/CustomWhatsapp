'use strict';

const express = require('express');
const crypto  = require('crypto');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS — obrigatório para o SFMC carregar a custom activity ───────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Rota explícita para o config.json (SFMC busca na raiz)
app.get('/config.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'public', 'config.json'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Monta o payload exato que o Mulesoft vai disparar para o BLIP ───────────
function buildBlipPayload(inArgs) {
  const now       = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const requestId = crypto.randomUUID();

  return {
    Header: {
      SistemaOrigen:    'SFMC',
      FechaHora:        now,
      Funcionalidad:    'SendCampaign',
      TipoFuncionalidad: inArgs.tipoFuncionalidad || 'sfmc_whatsapp',
      IdPeticion:       requestId,
      CodSistema:       'BLIP'
    },
    Body: {
      id:     requestId,
      to:     'postmaster@activecampaign.msging.net',
      method: 'set',
      uri:    '/campaign/full',
      type:   'application/vnd.iris.activecampaign.full-campaign+json',
      resource: {
        campaign: {
          name:          `${inArgs.recipient}-${now}`,
          campaignType:  'Individual',
          MasterState:   inArgs.masterState   || 'SEU_BOT@msging.net',
          flowId:        inArgs.flowId        || 'SEU_FLOW_ID',
          stateId:       'onboarding',
          channelType:   'WhatsApp'
        },
        audience: {
          recipient:     inArgs.recipient,
          messageParams: inArgs.messageParams || {}
        },
        message: {
          messageTemplate: inArgs.messageTemplate,
          channelType:     'WhatsApp'
        }
      }
    }
  };
}

// ─── Callbacks do Journey Builder ────────────────────────────────────────────

// Salva configuração (marketer clicou em Done no wizard)
app.post('/save', (req, res) => {
  console.log('\n[SAVE] Payload recebido do JB:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'ok' });
});

// Publicação da jornada
app.post('/publish', (req, res) => {
  console.log('\n[PUBLISH] Payload recebido do JB:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'ok' });
});

// Validação antes de publicar
app.post('/validate', (req, res) => {
  console.log('\n[VALIDATE] Payload recebido do JB:');
  console.log(JSON.stringify(req.body, null, 2));

  const inArgs = req.body?.inArguments?.[0] || {};
  const errors = [];

  if (!inArgs.messageTemplate) errors.push('messageTemplate é obrigatório');
  if (!inArgs.recipient)       errors.push('recipient (telefone) é obrigatório');

  if (errors.length) {
    console.warn('[VALIDATE] Erros:', errors);
    return res.status(400).json({ status: 'error', errors });
  }

  res.status(200).json({ status: 'ok' });
});

// Parada da jornada
app.post('/stop', (req, res) => {
  console.log('\n[STOP] Payload recebido do JB:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'ok' });
});

// Execução por contato — monta e loga o payload que o Mulesoft vai receber
app.post('/execute', (req, res) => {
  console.log('\n[EXECUTE] inArguments recebidos do JB:');
  console.log(JSON.stringify(req.body, null, 2));

  const inArgs = req.body?.inArguments?.[0] || {};

  if (!inArgs.messageTemplate || !inArgs.recipient) {
    const msg = 'messageTemplate e recipient são obrigatórios';
    console.error('[EXECUTE] Erro de validação:', msg);
    return res.status(400).json({ status: 'error', message: msg });
  }

  // ── Este é o payload exato que o Mulesoft vai disparar em produção ──────────
  const blipPayload = buildBlipPayload(inArgs);

  console.log('\n[EXECUTE] ✅ Payload que o Mulesoft enviaria ao BLIP:');
  console.log(JSON.stringify(blipPayload, null, 2));
  // ── Em produção o Mulesoft lê os inArguments e faz o POST acima ─────────────

  res.status(200).json({ status: 'ok', blipPayload });
});

// Health check
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', env: 'heroku-dev', ts: new Date().toISOString() })
);

app.listen(PORT, () =>
  console.log(`[SERVER] Custom Activity rodando na porta ${PORT}`)
);
