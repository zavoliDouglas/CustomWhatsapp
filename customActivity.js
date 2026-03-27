define(['postmonger'], function (Postmonger) {
  'use strict';

  var connection  = new Postmonger.Session();
  var payload     = {};
  var schema      = [];
  var currentStep = 'step1';

  // ─── Templates FIXOS (mock) ──────────────────────────────────────────────
  // Baseado no cURL de exemplo: messageTemplate = "berlin_ura_faltadeluz_v1"
  // e messageParams conforme o payload do BLIP.
  var TEMPLATES = [
    {
      value:  'berlin_ura_faltadeluz_v1',
      nome:   'Berlin URA Falta de Luz v1',
      params: [
        'installationNumber',
        'userState',
        'processedDocument',
        'serviceChoosed',
        'name'
      ]
    }
  ];

  // Labels amigáveis exibidos na UI ao lado do nome técnico do parâmetro
  var PARAM_LABELS = {
    installationNumber: 'Número de Instalação',
    userState:          'Estado do Usuário',
    processedDocument:  'CPF / Documento',
    serviceChoosed:     'Serviço Selecionado',
    name:               'Nome do Cliente'
  };

  // ─── Metadados da jornada ────────────────────────────────────────────────
  var eventDefinitionKey = '';
  var journeyName        = '';
  var journeyVersion     = '';

  // ─── Boot ────────────────────────────────────────────────────────────────
  $(window).ready(function () {
    connection.trigger('ready');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('requestSchema');
    connection.trigger('requestInteraction');
  });

  connection.on('initActivity',       onInitActivity);
  connection.on('requestedTokens',    function () {});
  connection.on('requestedEndpoints', function () {});
  connection.on('clickedNext',        onClickedNext);
  connection.on('clickedBack',        onClickedBack);
  connection.on('gotoStep',           onGotoStep);
  connection.on('clickedDone',        save);

  connection.on('requestedInteraction', function (settings) {
    eventDefinitionKey = settings.triggers[0].metaData.eventDefinitionKey;
    journeyName        = settings.name;
    journeyVersion     = settings.version;
  });

  // ─── initActivity ─────────────────────────────────────────────────────────
  function onInitActivity(data) {
    if (data) payload = data;

    connection.on('requestedSchema', function (schemaData) {
      schema = schemaData['schema'] || [];
      populateTemplateSelect();
      populateRecipientSelect();

      var saved = getSavedArgs();
      if (saved && saved.messageTemplate) {
        restoreSavedState(saved);
      }
    });
  }

  function getSavedArgs() {
    try { return payload.arguments.execute.inArguments[0] || {}; }
    catch (e) { return {}; }
  }

  // ─── Step 1 ───────────────────────────────────────────────────────────────
  function populateTemplateSelect() {
    var sel = document.getElementById('selectTemplate');
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
    schema.forEach(function (field) {
      var opt = document.createElement('option');
      opt.value = field.name;
      opt.text  = field.name + (field.type === 'Phone' ? ' (Phone)' : '');
      sel.appendChild(opt);
    });
    $('#selectRecipient').select2({ width: '320px' });
  }

  // ─── Step 2: campos fixos baseados no template ────────────────────────────
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
        // Token salvo: "{{Event.KEY.nomeCampo}}" — extrai só nomeCampo
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
      if (!$('#selectTemplate').val()) {
        showAlert('alertTemplate');
        connection.trigger('ready');
        return;
      }
      hideAlert('alertTemplate');
      buildParamFields($('#selectTemplate').val());
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
  //  Monta os inArguments que o JB vai enviar ao /execute.
  //  O JB resolve cada {{Event.KEY.campo}} para o valor real do contato
  //  antes de chamar o Heroku (dev) ou o Mulesoft (prod).
  //
  function save() {
    var messageTemplate = $('#selectTemplate').val();
    var recipientField  = $('#selectRecipient').val();

    // { paramBLIP: "{{Event.KEY.campoDE}}" }
    var messageParams = {};
    document.querySelectorAll('#paramsContainer select[data-param]')
      .forEach(function (sel) {
        messageParams[sel.getAttribute('data-param')] =
          '{{Event.' + eventDefinitionKey + '.' + sel.value + '}}';
      });

    payload['arguments']                     = payload['arguments'] || {};
    payload['arguments'].execute             = payload['arguments'].execute || {};
    payload['arguments'].execute.inArguments = [
      {
        // Campos que o Mulesoft usa para montar o POST ao BLIP
        messageTemplate:    messageTemplate,
        recipient:          '{{Event.' + eventDefinitionKey + '.' + recipientField + '}}',
        messageParams:      messageParams,

        // Rastreabilidade
        journeyName:        journeyName,
        journeyVersion:     journeyVersion,
        eventDefinitionKey: eventDefinitionKey,
        createdDate:        new Date().toISOString(),

        // Reload do wizard
        recipient_field:    recipientField
      }
    ];

    payload['metaData']              = payload['metaData'] || {};
    payload['metaData'].isConfigured = true;

    connection.trigger('updateActivity', payload);
  }

});
