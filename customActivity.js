define(['postmonger'], function (Postmonger) {
  'use strict';

  var connection   = new Postmonger.Session();
  var payload      = {};
  var schema       = [];
  var currentStep  = 'step1';

  var steps = [
    { label: 'Template',    key: 'step1' },
    { label: 'Parâmetros', key: 'step2' }
  ];

  // Templates injetados pelo servidor (ex: MuleSoft DataWeave ou similar)
  // Formato esperado de cada item:
  // {
  //   value: 'berlin_ura_faltadeluz_v1',   <- messageTemplate (nome exato no BLIP)
  //   nome:  'Falta de Luz v1',             <- label amigável no select
  //   params: ['name','installationNumber','userState','processedDocument','serviceChoosed']
  // }
  var templates = (typeof DEtemplates !== 'undefined') ? DEtemplates : [];

  // ─── Inicialização ────────────────────────────────────────────────────────

  $(window).ready(function () {
    connection.trigger('ready');
    connection.trigger('requestTokens');
    connection.trigger('requestEndpoints');
    connection.trigger('requestSchema');
    connection.trigger('requestInteraction');
  });

  connection.on('initActivity',         onInitActivity);
  connection.on('requestedTokens',      function () {});
  connection.on('requestedEndpoints',   function () {});
  connection.on('clickedNext',          onClickedNext);
  connection.on('clickedBack',          onClickedBack);
  connection.on('gotoStep',             onGotoStep);
  connection.on('clickedDone',          save);

  // Captura dados da jornada para usar no payload
  var eventDefinitionKey = '';
  var journeyName        = '';
  var journeyVersion     = '';

  connection.on('requestedInteraction', function (settings) {
    eventDefinitionKey = settings.triggers[0].metaData.eventDefinitionKey;
    journeyName        = settings.name;
    journeyVersion     = settings.version;
  });

  // ─── initActivity: carrega estado salvo anteriormente ────────────────────

  function onInitActivity(data) {
    if (data) payload = data;

    connection.on('requestedSchema', function (schemaData) {
      schema = schemaData['schema'] || [];
      populateStep1();
      populatePhoneField();

      var saved = (payload.arguments && payload.arguments.execute &&
                   payload.arguments.execute.inArguments &&
                   payload.arguments.execute.inArguments[0]) || {};

      if (saved.messageTemplate) {
        restoreStep1(saved);
        restoreStep2(saved);
      }
    });
  }

  // ─── Step 1 ──────────────────────────────────────────────────────────────

  function populateStep1() {
    var select = document.getElementById('selectTemplate');
    templates.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.value;
      opt.text  = t.nome;
      select.appendChild(opt);
    });
    $('#selectTemplate').trigger('change');
  }

  function populatePhoneField() {
    var sel = document.getElementById('selectRecipient');
    schema.forEach(function (field) {
      if (field.type === 'Phone' || field.type === 'Text') {
        var opt = document.createElement('option');
        opt.value = field.name;
        opt.text  = field.name + (field.type === 'Phone' ? ' (Phone)' : '');
        sel.appendChild(opt);
      }
    });
    $('#selectRecipient').trigger('change');
  }

  function restoreStep1(saved) {
    $('#selectTemplate').val(saved.messageTemplate).trigger('change');
    $('#selectRecipient').val(saved.recipient_field);
  }

  // ─── Step 2: renderiza campos dinâmicos baseados no template ─────────────

  function buildStep2(templateValue) {
    var container = document.getElementById('paramsContainer');
    container.innerHTML = '';

    var tmpl = templates.find(function (t) { return t.value === templateValue; });
    if (!tmpl || !tmpl.params || tmpl.params.length === 0) {
      container.innerHTML = '<p class="text-muted">Este template não possui parâmetros.</p>';
      return;
    }

    tmpl.params.forEach(function (paramName) {
      var group = document.createElement('div');
      group.className = 'mb-3';

      var label = document.createElement('label');
      label.className = 'form-label fw-semibold';
      label.setAttribute('for', 'param_' + paramName);
      label.textContent = paramName;

      var sel = document.createElement('select');
      sel.id        = 'param_' + paramName;
      sel.name      = paramName;
      sel.className = 'form-select form-select-sm';
      sel.setAttribute('data-param', paramName);

      var defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.text  = '— selecione —';
      sel.appendChild(defaultOpt);

      schema.forEach(function (field) {
        var opt = document.createElement('option');
        opt.value = field.name;
        opt.text  = field.name;
        sel.appendChild(opt);
      });

      group.appendChild(label);
      group.appendChild(sel);
      container.appendChild(group);

      $(sel).select2({ width: '280px' });
    });
  }

  function restoreStep2(saved) {
    if (!saved.messageParams) return;
    Object.keys(saved.messageParams).forEach(function (paramName) {
      var sel = document.getElementById('param_' + paramName);
      if (sel) $(sel).val(saved.messageParams[paramName]).trigger('change');
    });
  }

  // ─── Navegação entre steps ───────────────────────────────────────────────

  function showStep(key) {
    currentStep = key;
    document.getElementById('step1').style.display = key === 'step1' ? 'block' : 'none';
    document.getElementById('step2').style.display = key === 'step2' ? 'block' : 'none';

    connection.trigger('updateButton', { button: 'back',  visible: key !== 'step1' });
    connection.trigger('updateButton', { button: 'next',  visible: true,
      text: key === 'step2' ? 'Done' : 'Next' });
  }

  function onClickedNext() {
    if (currentStep === 'step1') {
      var tmplVal = $('#selectTemplate').val();
      if (!tmplVal) {
        document.getElementById('alertTemplate').style.display = 'block';
        connection.trigger('ready');
        return;
      }
      document.getElementById('alertTemplate').style.display = 'none';
      buildStep2(tmplVal);
      showStep('step2');
      connection.trigger('nextStep');

    } else if (currentStep === 'step2') {
      if (hasEmptyParams()) {
        document.getElementById('alertParams').style.display = 'block';
        connection.trigger('ready');
        return;
      }
      document.getElementById('alertParams').style.display = 'none';
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
    var selects = document.querySelectorAll('#paramsContainer select[data-param]');
    for (var i = 0; i < selects.length; i++) {
      if (!selects[i].value) return true;
    }
    return false;
  }

  // ─── Save: monta o payload que o Mulesoft vai ler no /execute ─────────────
  //
  //  O Mulesoft recebe os inArguments com os valores já resolvidos pelo JB
  //  ({{Event.KEY.campo}} → valor real do contato) e monta o POST para o BLIP.
  //
  function save() {
    var messageTemplate = $('#selectTemplate').val();
    var recipientField  = $('#selectRecipient').val();

    // Mapeia cada parâmetro do template para {{Event.KEY.campo}}
    var messageParams = {};
    document.querySelectorAll('#paramsContainer select[data-param]').forEach(function (sel) {
      var paramName  = sel.getAttribute('data-param');
      var fieldValue = sel.value;
      // JB resolve em runtime para o valor real do contato
      messageParams[paramName] = '{{Event.' + eventDefinitionKey + '.' + fieldValue + '}}';
    });

    // Campo recipient também como token JB
    var recipientToken = '{{Event.' + eventDefinitionKey + '.' + recipientField + '}}';

    // ── inArguments: estrutura que o Mulesoft vai receber no /execute ────────
    payload['arguments'] = payload['arguments'] || {};
    payload['arguments'].execute = payload['arguments'].execute || {};
    payload['arguments'].execute.inArguments = [
      {
        // Dados de roteamento para o BLIP
        messageTemplate:  messageTemplate,
        recipient:        recipientToken,
        messageParams:    messageParams,

        // Metadados da jornada (úteis para rastreabilidade)
        journeyName:      journeyName,
        journeyVersion:   journeyVersion,
        eventDefinitionKey: eventDefinitionKey,
        createdDate:      new Date().toISOString(),

        // Campos salvos para reload do wizard
        recipient_field:  recipientField
      }
    ];

    payload['metaData'] = payload['metaData'] || {};
    payload['metaData'].isConfigured = true;

    connection.trigger('updateActivity', payload);
  }

});
