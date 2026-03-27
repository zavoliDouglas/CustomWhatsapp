define(['postmonger'], function (Postmonger) {
  'use strict';

  var connection  = new Postmonger.Session();
  var payload     = {};
  var schema      = [];
  var currentStep = 'step1';

  // ─── Templates fixos ─────────────────────────────────────────────────────
  var TEMPLATES = [
    {
      value:  'berlin_ura_faltadeluz_v1',
      nome:   'Berlin URA Falta de Luz v1',
      params: ['installationNumber', 'userState', 'processedDocument', 'serviceChoosed', 'name']
    }
  ];

  var PARAM_LABELS = {
    installationNumber: 'Número de Instalação',
    userState:          'Estado do Usuário',
    processedDocument:  'CPF / Documento',
    serviceChoosed:     'Serviço Selecionado',
    name:               'Nome do Cliente'
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

    // inArguments como array de objetos separados —
    // exatamente igual ao formato declarado no config.json
    // para o JB reconhecer, persistir e reenviar no /execute
    var inArguments = [
      { messageTemplate:    messageTemplate },
      { recipient:          toToken(recipientField) },
      { installationNumber: mapped.installationNumber ? toToken(mapped.installationNumber) : '' },
      { userState:          mapped.userState          ? toToken(mapped.userState)          : '' },
      { processedDocument:  mapped.processedDocument  ? toToken(mapped.processedDocument)  : '' },
      { serviceChoosed:     mapped.serviceChoosed      ? toToken(mapped.serviceChoosed)     : '' },
      { name:               mapped.name               ? toToken(mapped.name)               : '' },
      { recipient_field:    recipientField },
      { eventDefinitionKey: eventDefinitionKey },
      { journeyName:        journeyName },
      { journeyVersion:     String(journeyVersion) },
      { createdDate:        new Date().toISOString() }
    ];

    if (recipientField) {
      payload['arguments']                     = payload['arguments'] || {};
      payload['arguments'].execute             = payload['arguments'].execute || {};
      payload['arguments'].execute.inArguments = inArguments;
      payload['arguments'].messageTemplate     = messageTemplate;
      payload['arguments'].recipient_field     = recipientField;

      payload['metaData']              = payload['metaData'] || {};
      payload['metaData'].isConfigured = true;

      console.log('[SAVE] inArguments:', JSON.stringify(inArguments));
      console.log('[SAVE] payload completo:', JSON.stringify(payload));

      connection.trigger('updateActivity', payload);
    }
  }

});
