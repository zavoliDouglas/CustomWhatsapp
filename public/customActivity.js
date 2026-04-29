define(['postmonger'], function (Postmonger) {
  'use strict';

  var connection  = new Postmonger.Session();
  var payload     = {};
  var schema      = [];
  var currentStep = 'step1';

  // ─── Templates ───────────────────────────────────────────────────────────
  //
  // COMO ADICIONAR OU EDITAR UM TEMPLATE:
  //   1. Copie um bloco existente abaixo e ajuste os campos
  //   2. value  → nome exato do template cadastrado no BLIP/WABA
  //   3. nome   → label amigável que aparece no select do wizard
  //   4. params → lista de variáveis {{}} do template (ver Figma Projeto 734)
  //   5. Se o param ainda não existir em PARAM_LABELS, adicione lá também
  //   6. Faça commit + deploy — o wizard atualiza automaticamente
  //
  // ATENÇÃO: inclua TODOS os templates que o WABA aprovar, mesmo os ainda
  // não cadastrados. Basta removê-los ou comentá-los quando necessário.
  //
  var TEMPLATES = [

    // ── Ligação Nova ─────────────────────────────────────────────────────────
    {
      value:  'enel_ln_abertura_sembotao_01',
      nome:   'LN — Abertura',
      params: ['nome', 'protocolo', 'numero', 'prazo']
    },
    {
      value:  'enel_ln_despacho_01',
      nome:   'LN — Despacho',
      params: ['nome', 'protocolo', 'numero']
    },
    {
      value:  'enel_ln_boasvindas_01',
      nome:   'LN — Boas-vindas / Conclusão',
      params: ['nome', 'protocolo', 'numero']
    },
    {
      value:  'enel_ln_rejeicaoausenciatitular_01',
      nome:   'LN — Rejeição: Ausência de responsável',
      params: ['nome', 'protocolo', 'numero', 'data_visita']
    },

    // ── Troca de Titularidade ────────────────────────────────────────────────
    {
      value:  'enel_tt_abertura_01',
      nome:   'TT — Abertura',
      params: ['nome', 'endereco']
    },
    {
      value:  'enel_tt_analise_emandamento_01',
      nome:   'TT — Em andamento / Análise',
      params: ['nome', 'protocolo']
    },
    {
      value:  'enel_tt_boasvindas_01',
      nome:   'TT — Boas-vindas / Conclusão',
      params: ['nome', 'protocolo', 'numero']
    },
    {
      value:  'enel_tt_rejeicao_01',
      nome:   'TT — Rejeição',
      params: ['protocolo']
    },

    // ── Corte e Religa ───────────────────────────────────────────────────────
    {
      value:  'berlin_enel_pendenciadepagamentocr_01',
      nome:   'CR — Pendência de Pagamento',
      params: ['nome', 'numero', 'valor']
    },
    {
      value:  'enel_cr_cancelamentodecorte_01',
      nome:   'CR — Cancelamento de Corte',
      params: ['nome']
    },
    {
      value:  'berlin_enel_corteexecutadocr_01',
      nome:   'CR — Corte Executado',
      params: ['nome', 'numero', 'valor']
    },
    {
      value:  'berlin_enel_pagamentoparcialcr_01',
      nome:   'CR — Pagamento Parcial',
      params: ['nome']
    },
    {
      value:  'berlin_enel_pagamentototalcr_01',
      nome:   'CR — Pagamento Total / Envio Religa',
      params: ['nome', 'protocolo', 'numero', 'prazo']
    },
    // CR NA6 Despacho Religa — não cadastrado no WABA ainda
    // {
    //   value:  'enel_cr_despachoreliga_01',
    //   nome:   'CR — Despacho Religa',
    //   params: ['nome', 'protocolo', 'numero']
    // },
    // CR NA7 Execução Religa — não cadastrado no WABA ainda
    // {
    //   value:  'enel_cr_execucaoreliga_01',
    //   nome:   'CR — Execução Religa',
    //   params: ['nome']
    // },
    {
      value:  'berlin_enel_rejeicaoreligacr_01',
      nome:   'CR — Rejeição Religa',
      params: ['nome']
    },

    // ── Faturamento ──────────────────────────────────────────────────────────
    {
      value:  'berlin_enel_tarifabranca_01',
      nome:   'FA — Tarifa Branca',
      params: ['nome', 'de', 'para', 'numero', 'endereco', 'site']
    },
    {
      value:  'berlin_enel_tarifasocial_01',
      nome:   'FA — Tarifa Social',
      params: ['nome', 'numero', 'endereco']
    },
    {
      value:  'berlin_enel_alertavencimentoconta_01',
      nome:   'FA — Alerta de Vencimento de Conta',
      params: ['nome', 'numero', 'endereco', 'valor', 'data_vencimento']
    },
    {
      value:  'berlin_enel_contavencida_01',
      nome:   'FA — Conta Vencida',
      params: ['nome', 'valor', 'data_vencimento']
    },
    {
      value:  'berlin_enel_liberacaocriticafaturamento_01',
      nome:   'FA — Liberação Crítica Faturamento',
      params: ['nome', 'valor', 'data_vencimento']
    },

    // ── URA ──────────────────────────────────────────────────────────────────
    {
      value:  'berlin_ura_faltadeluz_v1',
      nome:   'URA — Falta de Luz',
      params: ['name', 'installationNumber', 'userState', 'processedDocument', 'serviceChoosed']
    }

    // ── Novo template — copie e preencha: ────────────────────────────────────
    // ,{
    //   value:  'nome_exato_no_blip',
    //   nome:   'Seção — Descrição amigável',
    //   params: ['param1', 'param2', 'param3']
    // }
  ];

  // Labels amigáveis exibidos na UI ao lado do nome técnico de cada parâmetro.
  // Adicione aqui o label de qualquer novo param que criar em TEMPLATES.
  var PARAM_LABELS = {
    // Comuns
    nome:           'Nome do Cliente',
    protocolo:      'Número do Protocolo',
    numero:         'Número da UC',
    prazo:          'Prazo (horas ou dias úteis)',
    data_visita:    'Data da Visita Técnica',
    endereco:       'Endereço do Imóvel',
    valor:          'Valor (R$)',
    data_vencimento:'Data de Vencimento',
    // Tarifa Branca
    de:             'Tarifa Anterior',
    para:           'Nova Tarifa',
    site:           'Link do Site',
    // URA
    name:               'Nome do Cliente (URA)',
    installationNumber: 'Número de Instalação',
    userState:          'Estado do Usuário',
    processedDocument:  'CPF / Documento',
    serviceChoosed:     'Serviço Selecionado'
  };

  // ─── Metadados da jornada ─────────────────────────────────────────────────
  var eventDefinitionKey = '';
  var journeyName        = '';
  var journeyVersion     = '';

  // ─── Registra TODOS os handlers ANTES de triggar ready ───────────────────
  // (evita race condition onde o evento chega antes do handler estar pronto)

  connection.on('initActivity', onInitActivity);

  // requestedSchema: registrado aqui para garantir que está pronto
  connection.on('requestedSchema', function (schemaData) {
    schema = schemaData['schema'] || [];
    populateTemplateSelect();
    populateRecipientSelect();

    var saved = getSavedArgs();
    if (saved && saved.messageTemplate) {
      restoreSavedState(saved);
    }
  });

  connection.on('requestedInteraction', function (settings) {
    try {
      eventDefinitionKey = settings.triggers[0].metaData.eventDefinitionKey;
    } catch (e) { eventDefinitionKey = ''; }
    journeyName    = settings.name    || '';
    journeyVersion = settings.version || '';
  });

  connection.on('requestedTokens',    function () {});
  connection.on('requestedEndpoints', function () {});
  connection.on('clickedNext',        onClickedNext);
  connection.on('clickedBack',        onClickedBack);
  connection.on('gotoStep',           onGotoStep);
  connection.on('clickedDone',        save);

  // ─── Boot: dispara ready DEPOIS de registrar todos os handlers ────────────
  $(window).ready(function () {
    connection.trigger('ready');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('requestSchema');
    connection.trigger('requestInteraction');
  });

  // ─── initActivity ─────────────────────────────────────────────────────────
  function onInitActivity(data) {
    if (data) payload = data;
    // Schema pode já ter chegado antes do initActivity — se chegou, ok.
    // Se não chegou ainda, o handler requestedSchema acima vai cuidar.
  }

  function getSavedArgs() {
    try {
      var args = payload.arguments.execute.inArguments;
      if (!args || !args.length) return {};
      // inArguments pode ser array de objetos separados ou objeto único
      if (Array.isArray(args) && typeof args[0] === 'object') {
        return args.reduce(function (acc, obj) {
          return Object.assign(acc, obj);
        }, {});
      }
      return args[0] || {};
    } catch (e) { return {}; }
  }

  // ─── Step 1 ───────────────────────────────────────────────────────────────
  function populateTemplateSelect() {
    var sel = document.getElementById('selectTemplate');
    // Limpa opções anteriores (exceto o default)
    while (sel.options.length > 1) sel.remove(1);

    TEMPLATES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.value;
      opt.text  = t.nome;
      sel.appendChild(opt);
    });
    $('#selectTemplate').select2({ width: '320px' });
  }

  function populateRecipientSelect() {
    var sel = document.getElementById('selectRecipient');
    while (sel.options.length > 1) sel.remove(1);

    schema.forEach(function (field) {
      var opt = document.createElement('option');
      opt.value = field.name;
      opt.text  = field.name + (field.type === 'Phone' ? ' (Phone)' : '');
      sel.appendChild(opt);
    });
    $('#selectRecipient').select2({ width: '320px' });
  }

  // ─── Step 2 ───────────────────────────────────────────────────────────────
  function buildParamFields(templateValue) {
    var tmpl      = TEMPLATES.find(function (t) { return t.value === templateValue; });
    var container = document.getElementById('paramsContainer');
    container.innerHTML = '';
    if (!tmpl) return;

    tmpl.params.forEach(function (paramKey) {
      var group = document.createElement('div');
      group.className = 'param-row mb-3';

      var lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.setAttribute('for', 'param_' + paramKey);
      lbl.innerHTML =
        '<span class="param-blip-name">' + paramKey + '</span>'
        + ' <span class="param-friendly">— ' + (PARAM_LABELS[paramKey] || paramKey) + '</span>';

      var sel = document.createElement('select');
      sel.id   = 'param_' + paramKey;
      sel.name = paramKey;
      sel.className = 'form-select form-select-sm';
      sel.setAttribute('data-param', paramKey);

      var def = document.createElement('option');
      def.value = '';
      def.text  = '— selecione o campo da DE —';
      sel.appendChild(def);

      schema.forEach(function (field) {
        var opt = document.createElement('option');
        opt.value = field.name;
        opt.text  = field.name;
        sel.appendChild(opt);
      });

      group.appendChild(lbl);
      group.appendChild(sel);
      container.appendChild(group);

      $('#param_' + paramKey).select2({ width: '320px' });
    });
  }

  // ─── Restaura estado salvo ────────────────────────────────────────────────
  function restoreSavedState(saved) {
    $('#selectTemplate').val(saved.messageTemplate).trigger('change');
    if (saved.recipient_field) {
      $('#selectRecipient').val(saved.recipient_field).trigger('change');
    }
    buildParamFields(saved.messageTemplate);
    if (saved.messageParams) {
      Object.keys(saved.messageParams).forEach(function (key) {
        var el = document.getElementById('param_' + key);
        if (!el) return;
        var fieldName = saved.messageParams[key]
          .replace(/^\{\{Event\.[^.]+\./, '')
          .replace(/\}\}$/, '');
        $(el).val(fieldName).trigger('change');
      });
    }
  }

  // ─── Navegação ────────────────────────────────────────────────────────────
  function showStep(key) {
    currentStep = key;
    document.getElementById('step1').style.display = key === 'step1' ? 'block' : 'none';
    document.getElementById('step2').style.display = key === 'step2' ? 'block' : 'none';
    document.getElementById('stepIndicator').textContent =
      key === 'step1' ? 'Passo 1 de 2' : 'Passo 2 de 2';

    connection.trigger('updateButton', { button: 'back', visible: key !== 'step1' });
    connection.trigger('updateButton', { button: 'next', visible: true,
      text: key === 'step2' ? 'Done' : 'Next' });
  }

  function onClickedNext() {
    if (currentStep === 'step1') {
      var tmplVal = $('#selectTemplate').val();
      if (!tmplVal) {
        showAlert('alertTemplate');
        connection.trigger('ready');
        return;
      }
      hideAlert('alertTemplate');
      buildParamFields(tmplVal);
      showStep('step2');
      connection.trigger('nextStep');

    } else if (currentStep === 'step2') {
      if (hasEmptyParams()) {
        showAlert('alertParams');
        connection.trigger('ready');
        return;
      }
      hideAlert('alertParams');
      save();
    }
  }

  function onClickedBack() {
    showStep('step1');
    connection.trigger('prevStep');
  }

  function onGotoStep(step) {
    showStep(step.key);
    connection.trigger('ready');
  }

  function hasEmptyParams() {
    var empty = false;
    document.querySelectorAll('#paramsContainer select[data-param]')
      .forEach(function (s) { if (!s.value) empty = true; });
    return empty;
  }

  function showAlert(id) { document.getElementById(id).style.display = 'block'; }
  function hideAlert(id) { document.getElementById(id).style.display = 'none';  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  //
  // Com useJwt: false, o SFMC envia os inArguments como JSON puro para o
  // Mulesoft. O Mulesoft recebe e repassa direto para o BLIP sem transformar.
  // Por isso montamos o payload BLIP completo aqui no frontend e serializamos
  // como string em blipPayload — o Mulesoft só faz JSON.parse e POST.
  //
  function save() {
    var messageTemplate = $('#selectTemplate').val();
    var recipientField  = $('#selectRecipient').val();

    console.log('[SAVE] messageTemplate:', messageTemplate);
    console.log('[SAVE] recipientField:', recipientField);
    console.log('[SAVE] eventDefinitionKey:', eventDefinitionKey);

    var toToken = function (field) {
      return '{{Event.' + eventDefinitionKey + '.' + field + '}}';
    };

    // Coleta campos mapeados no Step 2
    var mapped = {};
    document.querySelectorAll('#paramsContainer select[data-param]')
      .forEach(function (sel) {
        mapped[sel.getAttribute('data-param')] = sel.value;
      });

    // Monta messageParams com tokens JB para cada param do template
    var messageParams = {};
    Object.keys(mapped).forEach(function (key) {
      if (mapped[key]) messageParams[key] = toToken(mapped[key]);
    });

    var recipientToken = toToken(recipientField);

    // Payload BLIP completo — o SFMC resolve os tokens {{Event.KEY.campo}}
    // para os valores reais do contato antes de chamar o /execute no Mulesoft
    var blipPayload = {
      Header: {
        SistemaOrigen:     'SFMC',
        FechaHora:         '{{NOW}}',        // Mulesoft substitui pelo timestamp real
        Funcionalidad:     'SendCampaign',
        TipoFuncionalidad: 'sfmc_whatsapp',
        IdPeticion:        '{{UUID}}',       // Mulesoft gera UUID real
        CodSistema:        'BLIP'
      },
      Body: {
        id:     '{{UUID}}',
        to:     'postmaster@activecampaign.msging.net',
        method: 'set',
        uri:    '/campaign/full',
        type:   'application/vnd.iris.activecampaign.full-campaign+json',
        resource: {
          campaign: {
            name:         recipientToken + '-{{NOW}}',
            campaignType: 'Individual',
            MasterState:  '{{MASTER_STATE}}', // Mulesoft substitui pela config
            flowId:       '{{FLOW_ID}}',      // Mulesoft substitui pela config
            stateId:      'onboarding',
            channelType:  'WhatsApp'
          },
          audience: {
            recipient:     recipientToken,
            messageParams: messageParams
          },
          message: {
            messageTemplate: messageTemplate,
            channelType:     'WhatsApp'
          }
        }
      }
    };

    if (recipientField) {
      payload['arguments']                     = payload['arguments'] || {};
      payload['arguments'].execute             = payload['arguments'].execute || {};
      payload['arguments'].execute.inArguments = [
        { blipPayload: JSON.stringify(blipPayload) }
      ];

      // Salva também para reload do wizard
      payload['arguments'].messageTemplate = messageTemplate;
      payload['arguments'].recipient_field = recipientField;

      payload['metaData']              = payload['metaData'] || {};
      payload['metaData'].isConfigured = true;

      console.log('[SAVE] blipPayload:', JSON.stringify(blipPayload, null, 2));
      console.log('[SAVE] payload completo:', JSON.stringify(payload));

      connection.trigger('updateActivity', payload);
    }
  }

});
