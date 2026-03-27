'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || '';

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
// O JB envia os endpoints de lifecycle (save/validate/publish/execute)
// como application/jwt — body é um JWT assinado, não JSON puro
app.use(bodyParser.raw({ type: 'application/jwt' }));
app.use(express.json());

// ─── Middleware: decodifica JWT em todas as rotas POST ────────────────────────
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();

  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  if (!raw) return next();

  try {
    // Tenta verificar com secret (se configurado), senão só decodifica
    const decoded = JWT_SECRET
      ? jwt.verify(raw, JWT_SECRET, { algorithms: ['HS256'] })
      : jwt.decode(raw);

    req.jwtDecoded = decoded;
    console.log('[JWT] Decoded:', JSON.stringify(decoded, null, 2));
  } catch (e) {
    console.warn('[JWT] Falha ao decodificar:', e.message);
  }

  next();
});

// ─── Static files ─────────────────────────────────────────────────────────────
app.get('/config.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'public', 'config.json'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper: monta payload BLIP a partir dos inArguments ─────────────────────
function buildBlipPayload(inArgs) {
  const now       = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const requestId = crypto.randomUUID();

  return {
    Header: {
      SistemaOrigen:     'SFMC',
      FechaHora:         now,
      Funcionalidad:     'SendCampaign',
      TipoFuncionalidad: 'sfmc_whatsapp',
      IdPeticion:        requestId,
      CodSistema:        'BLIP'
    },
    Body: {
      id:     requestId,
      to:     'postmaster@activecampaign.msging.net',
      method: 'set',
      uri:    '/campaign/full',
      type:   'application/vnd.iris.activecampaign.full-campaign+json',
      resource: {
        campaign: {
          name:         `${inArgs.recipient}-${now}`,
          campaignType: 'Individual',
          MasterState:  inArgs.masterState || 'SEU_BOT@msging.net',
          flowId:       inArgs.flowId      || 'SEU_FLOW_ID',
          stateId:      'onboarding',
          channelType:  'WhatsApp'
        },
        audience: {
          recipient:     inArgs.recipient,
          messageParams: {
            installationNumber: inArgs.installationNumber || '',
            userState:          inArgs.userState          || '',
            processedDocument:  inArgs.processedDocument  || '',
            serviceChoosed:     inArgs.serviceChoosed      || '',
            name:               inArgs.name               || ''
          }
        },
        message: {
          messageTemplate: inArgs.messageTemplate,
          channelType:     'WhatsApp'
        }
      }
    }
  };
}

// ─── Helper: achata inArguments (array de objetos ou objeto único) ────────────
function flattenInArgs(inArguments) {
  if (!Array.isArray(inArguments) || inArguments.length === 0) return {};
  if (inArguments.length === 1) return inArguments[0];
  return inArguments.reduce((acc, obj) => Object.assign(acc, obj), {});
}

// ─── Endpoints Journey Builder ────────────────────────────────────────────────

app.post('/save', (req, res) => {
  console.log('\n[SAVE] jwtDecoded:', JSON.stringify(req.jwtDecoded, null, 2));
  res.status(200).json({ status: 'ok' });
});

app.post('/publish', (req, res) => {
  console.log('\n[PUBLISH] jwtDecoded:', JSON.stringify(req.jwtDecoded, null, 2));
  res.status(200).json({ status: 'ok' });
});

app.post('/validate', (req, res) => {
  console.log('\n[VALIDATE] jwtDecoded:', JSON.stringify(req.jwtDecoded, null, 2));
  // Deixa sempre passar — validação real é feita pelo Mulesoft em produção
  res.status(200).json({ status: 'ok' });
});

app.post('/stop', (req, res) => {
  console.log('\n[STOP] jwtDecoded:', JSON.stringify(req.jwtDecoded, null, 2));
  res.status(200).json({ status: 'ok' });
});

app.post('/execute', (req, res) => {
  console.log('\n[EXECUTE] jwtDecoded completo:');
  console.log(JSON.stringify(req.jwtDecoded, null, 2));

  if (!req.jwtDecoded) {
    console.error('[EXECUTE] JWT não decodificado — body não é JWT válido');
    return res.status(400).json({ status: 'error', message: 'JWT inválido ou ausente' });
  }

  const inArguments = req.jwtDecoded.inArguments;
  if (!Array.isArray(inArguments) || inArguments.length === 0) {
    console.error('[EXECUTE] inArguments ausente ou vazio');
    return res.status(400).json({ status: 'error', message: 'inArguments ausente' });
  }

  const inArgs = flattenInArgs(inArguments);
  console.log('\n[EXECUTE] inArgs consolidados:', JSON.stringify(inArgs, null, 2));

  if (!inArgs.messageTemplate || !inArgs.recipient) {
    console.error('[EXECUTE] messageTemplate ou recipient ausente');
    return res.status(400).json({ status: 'error', message: 'messageTemplate e recipient são obrigatórios' });
  }

  const blipPayload = buildBlipPayload(inArgs);
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
