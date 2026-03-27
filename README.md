# Custom Activity — WhatsApp via BLIP

## Arquitetura

```
SFMC Journey Builder
       │
       │  JWT (save / validate / publish / execute)
       ▼
┌─────────────────────┐          ┌────────────────────┐
│  Heroku  (DEV)      │  loga    │  Mulesoft (PROD)   │
│  Node.js / Express  │──────►  │  Hospeda os mesmos │
│                     │  payload │  endpoints estáticos│
└─────────────────────┘          │  + dispara o BLIP  │
                                 └────────────┬───────┘
                                              │ POST
                                              ▼
                                     BLIP API (WhatsApp)
```

**Heroku é só para desenvolvimento.**  
Em produção, o Mulesoft hospeda os endpoints e é ele quem faz o POST para o BLIP.  
O papel desta custom activity é montar os `inArguments` corretos — o Mulesoft lê e dispara.

---

## Estrutura de arquivos

```
├── server.js               ← Heroku dev: recebe callbacks JB e loga o payload
├── package.json
└── public/
    ├── index.html          ← UI do wizard (iframe no SFMC)
    ├── customActivity.js   ← Lógica Postmonger + montagem do payload
    ├── config.json         ← Manifesto da custom activity para o JB
    ├── main.css            ← Estilos da UI
    └── require.js          ← AMD loader (copiar da pasta do SFMC SDK)
```

---

## Como rodar localmente

```bash
npm install
npm run dev
# servidor sobe em http://localhost:3000
```

---

## Deploy no Heroku

```bash
heroku create SEU-APP-NAME
git push heroku main
```

Atualize as URLs em `public/config.json`:
```json
"url": "https://SEU-APP.herokuapp.com/execute"
```

---

## Como injetar os templates

O array `DEtemplates` em `index.html` deve ser preenchido pelo seu servidor antes de servir o HTML.

**Heroku (dev):** use um template engine (ex: EJS) ou endpoint `/templates` que popule o array.

**Formato esperado:**
```json
[
  {
    "value":  "berlin_ura_faltadeluz_v1",
    "nome":   "Falta de Luz v1",
    "params": ["name", "installationNumber", "userState", "processedDocument", "serviceChoosed"]
  }
]
```

- `value` → nome exato do template no BLIP (`messageTemplate`)
- `nome`  → label amigável exibido no select
- `params` → lista de chaves que vão dentro de `messageParams`

---

## O que o Mulesoft recebe no `/execute`

O Journey Builder envia um POST com o seguinte body (valores já resolvidos pelo JB para o contato):

```json
{
  "inArguments": [
    {
      "messageTemplate": "berlin_ura_faltadeluz_v1",
      "recipient": "+5521999999999",
      "messageParams": {
        "name":               "João Silva",
        "installationNumber": "56965115",
        "userState":          "Rio de Janeiro",
        "processedDocument":  "05086838150",
        "serviceChoosed":     "Débitos"
      },
      "journeyName":          "Jornada Falta de Luz",
      "journeyVersion":       1,
      "eventDefinitionKey":   "abc-123",
      "createdDate":          "2026-03-27T10:00:00.000Z"
    }
  ]
}
```

O Mulesoft lê esses campos e monta o payload do BLIP conforme o contrato da API.

---

## Payload que o Mulesoft envia ao BLIP

```json
{
  "Header": {
    "SistemaOrigen":    "SFMC",
    "FechaHora":        "2026-03-27T10:00:00Z",
    "Funcionalidad":    "SendCampaign",
    "TipoFuncionalidad": "sfmc_whatsapp",
    "IdPeticion":       "uuid-gerado-pelo-mulesoft",
    "CodSistema":       "BLIP"
  },
  "Body": {
    "id": "uuid-gerado-pelo-mulesoft",
    "to": "postmaster@activecampaign.msging.net",
    "method": "set",
    "uri": "/campaign/full",
    "type": "application/vnd.iris.activecampaign.full-campaign+json",
    "resource": {
      "campaign": {
        "name":          "+5521999999999-2026-03-27T10:00:00Z",
        "campaignType":  "Individual",
        "MasterState":   "SEU_BOT@msging.net",
        "flowId":        "SEU_FLOW_ID",
        "stateId":       "onboarding",
        "channelType":   "WhatsApp"
      },
      "audience": {
        "recipient": "+5521999999999",
        "messageParams": {
          "name":               "João Silva",
          "installationNumber": "56965115",
          "userState":          "Rio de Janeiro",
          "processedDocument":  "05086838150",
          "serviceChoosed":     "Débitos"
        }
      },
      "message": {
        "messageTemplate": "berlin_ura_faltadeluz_v1",
        "channelType":     "WhatsApp"
      }
    }
  }
}
```
