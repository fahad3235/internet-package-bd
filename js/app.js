/* Internet Package BD - UI layer. Depends on IPBD_CORE, IPBD_DATA, IPBD_I18N. */
(function () {
  'use strict';
  var CORE = window.IPBD_CORE;
  var DATA = window.IPBD_DATA;
  var I18N = window.IPBD_I18N;
  var STORE_KEY = 'internet-package-bd-v1';

  var state = { lang: 'en', packages: [], tracked: null, editingId: null };
  var filters = { operator: 'all', type: 'all', activeOnly: true };

  function $(id) { return document.getElementById(id); }
  function t(key) {
    var lang = state.lang;
    if (I18N[lang] && I18N[lang][key] != null) return I18N[lang][key];
    return I18N.en[key] || key;
  }
  function num(n) { return CORE.fmtNum(n, state.lang); }
  function opName(id) {
    var o = DATA.OPERATORS.find(function (x) { return x.id === id; });
    return o ? (state.lang === 'bn' ? o.bn : o.en) : id;
  }
  function typeName(id) {
    var x = DATA.PACK_TYPES.find(function (y) { return y.id === id; });
    return x ? (state.lang === 'bn' ? x.bn : x.en) : id;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- persistence ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj.lang === 'bn' || obj.lang === 'en') state.lang = obj.lang;
      if (Array.isArray(obj.packages)) state.packages = obj.packages;
      if (obj.tracked) state.tracked = obj.tracked;
    } catch (e) { /* corrupted storage: start clean */ }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      lang: state.lang, packages: state.packages, tracked: state.tracked,
    }));
  }

  /* ---------- i18n ---------- */
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = t('langBtn');
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  }

  /* ---------- selects ---------- */
  function fillOperatorSelects() {
    var opts = '<option value="all">' + esc(t('filterAll')) + '</option>' +
      DATA.OPERATORS.map(function (o) {
        return '<option value="' + o.id + '">' + esc(state.lang === 'bn' ? o.bn : o.en) + '</option>';
      }).join('');
    $('fltOperator').innerHTML = opts;
    var optsNoAll = DATA.OPERATORS.map(function (o) {
      return '<option value="' + o.id + '">' + esc(state.lang === 'bn' ? o.bn : o.en) + '</option>';
    }).join('');
    $('pfOperator').innerHTML = optsNoAll;
  }
  function fillTypeSelects() {
    var opts = '<option value="all">' + esc(t('filterAll')) + '</option>' +
      DATA.PACK_TYPES.map(function (x) {
        return '<option value="' + x.id + '">' + esc(state.lang === 'bn' ? x.bn : x.en) + '</option>';
      }).join('');
    $('fltType').innerHTML = opts;
    $('pfType').innerHTML = DATA.PACK_TYPES.map(function (x) {
      return '<option value="' + x.id + '">' + esc(state.lang === 'bn' ? x.bn : x.en) + '</option>';
    }).join('');
  }

  /* ---------- pack cards ---------- */
  function packCardHTML(r, opts) {
    var badges = [];
    if (r.cheapest) badges.push('<span class="badge">' + esc(t('cheapest')) + '</span>');
    if (r.isExample) badges.push('<span class="badge amber">' + esc(t('exampleTag')) + '</span>');
    var html = '<div class="pack-card" data-id="' + esc(r.id) + '">' +
      '<div class="pack-top"><div><div class="pack-name">' + esc(r.name) + '</div>' +
      '<div class="pack-op">' + esc(opName(r.operator)) + ' · ' + esc(typeName(r.type)) + '</div></div>' +
      '<div>' + badges.join(' ') + '</div></div>' +
      '<div class="pack-nums">' +
      '<span><b>' + num(r.dataGB) + '</b> ' + esc(t('gb')) + '<span class="dim">' + esc(t('dataPerDay')) + ': ' + num(r.dataDay) + ' ' + esc(t('gb')) + '</span></span>' +
      '<span><b>' + num(r.validityDays) + '</b> ' + esc(t('days')) + '<span class="dim">' + esc(t('validity')) + '</span></span>' +
      '<span><b>' + esc(t('taka')) + num(r.priceBDT) + '</b><span class="dim">' + esc(t('perDay')) + ': ' + esc(t('taka')) + num(r.perDay) + '</span></span>' +
      '<span><b>' + esc(t('taka')) + num(r.perGB) + '</b><span class="dim">' + esc(t('perGB')) + '</span></span>' +
      '</div>';
    if (r.saveVsMax > 0) {
      html += '<div class="save-line">' + esc(t('taka')) + num(r.saveVsMax) + ' ' + esc(t('savesVsMostExpensive')) + '</div>';
    }
    if (r.notes) html += '<div class="pack-op">' + esc(r.notes) + '</div>';
    if (opts && opts.actions) {
      html += '<div class="pack-actions">' +
        '<button class="mini-btn" data-act="pause">' + esc(r.paused ? t('resume') : t('pause')) + '</button>' +
        '<button class="mini-btn" data-act="edit">' + esc(t('edit')) + '</button>' +
        '<button class="mini-btn danger" data-act="delete">' + esc(t('delete')) + '</button>' +
        '</div>';
    }
    return html + '</div>';
  }

  function filteredRanked() {
    var list = state.packages.slice();
    if (filters.operator !== 'all') list = list.filter(function (p) { return p.operator === filters.operator; });
    if (filters.type !== 'all') list = list.filter(function (p) { return p.type === filters.type; });
    if (filters.activeOnly) list = list.filter(function (p) { return p.active !== false; });
    return CORE.rankPackages(list);
  }

  function renderStats() {
    $('statTotal').textContent = num(state.packages.length);
    var cheapest = CORE.cheapestPerGB(state.packages);
    $('statCheapest').textContent = cheapest ? t('taka') + num(cheapest.perGB) : t('none');
    var avg = null;
    if (state.packages.length) {
      var sum = state.packages.reduce(function (a, p) { return a + p.priceBDT; }, 0);
      avg = Math.round(sum / state.packages.length);
    }
    $('statAvg').textContent = avg == null ? t('none') : t('taka') + num(avg);
    var trackedPkg = state.tracked ? state.packages.find(function (p) { return p.id === state.tracked.packageId; }) : null;
    $('statTracked').textContent = trackedPkg ? trackedPkg.name : t('none');
  }

  function renderCompare() {
    var ranked = filteredRanked();
    $('compareList').innerHTML = ranked.map(function (r) { return packCardHTML(r); }).join('');
    $('compareEmpty').classList.toggle('hidden', state.packages.length > 0);
    $('compareNoMatch').classList.toggle('hidden', !(state.packages.length > 0 && ranked.length === 0));
    $('loadExamplesBtn').classList.toggle('hidden', state.packages.length > 0);
  }

  function renderManage() {
    var ranked = CORE.rankPackages(state.packages);
    var byId = {};
    ranked.forEach(function (r) { byId[r.id] = r; });
    var html = state.packages.map(function (p) {
      var r = byId[p.id] || {
        id: p.id, operator: p.operator, name: p.name, dataGB: p.dataGB,
        validityDays: p.validityDays, priceBDT: p.priceBDT, type: p.type,
        notes: p.notes || '', perGB: CORE.costPerGB(p), perDay: CORE.costPerDay(p),
        dataDay: CORE.dataPerDay(p), cheapest: false, saveVsMax: 0, paused: p.active === false,
      };
      r.paused = p.active === false;
      r.isExample = !!p.example;
      return packCardHTML(r, { actions: true });
    }).join('');
    $('manageList').innerHTML = html;
    $('manageEmpty').classList.toggle('hidden', state.packages.length > 0);
    if (state.packages.length > 0) $('manageEmpty').classList.add('hidden');
  }

  /* ---------- planner ---------- */
  function plannerInputs() {
    return {
      video: parseFloat($('plVideo').value) || 0,
      social: parseFloat($('plSocial').value) || 0,
      browse: parseFloat($('plBrowse').value) || 0,
      music: parseFloat($('plMusic').value) || 0,
    };
  }
  function renderPlanner() {
    var hours = plannerInputs();
    var errs = CORE.validateHours(hours);
    if (errs.length) {
      $('plError').textContent = t('errHours');
      $('plError').classList.remove('hidden');
      $('plNeed').textContent = t('none');
      $('plSuggest').textContent = t('none');
      $('matchList').innerHTML = '';
      $('matchEmpty').classList.add('hidden');
      return;
    }
    $('plError').classList.add('hidden');
    var need = CORE.estimateMonthlyGB(hours, DATA.USAGE_RATES, $('plQuality').value);
    $('plNeed').textContent = num(need) + ' ' + t('gb');
    $('plSuggest').textContent = num(CORE.suggestedSize(need)) + ' ' + t('gb');
    var matches = CORE.matchingPacks(state.packages, need);
    $('matchList').innerHTML = matches.map(function (r) {
      return packCardHTML(r);
    }).join('');
    $('matchEmpty').classList.toggle('hidden', matches.length > 0);
  }

  /* ---------- my pack ---------- */
  function trackedPkg() {
    if (!state.tracked) return null;
    return state.packages.find(function (p) { return p.id === state.tracked.packageId; }) || null;
  }
  function renderMyPack() {
    var pkg = trackedPkg();
    var has = !!pkg;
    $('trackedCard').classList.toggle('hidden', !has);
    $('trackForm').classList.toggle('hidden', has);
    $('trStartBtn').classList.toggle('hidden', has);
    $('myPackEmpty').classList.toggle('hidden', has || state.packages.length > 0);
    if (!has) {
      var sel = $('trPackSelect');
      var active = state.packages.filter(function (p) { return p.active !== false; });
      sel.innerHTML = active.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.name) + ' — ' + esc(opName(p.operator)) + '</option>';
      }).join('');
      if (!sel.value && active.length) sel.value = active[0].id;
      $('trStartBtn').disabled = active.length === 0;
      if (!$('trStartDate').value) $('trStartDate').value = CORE.toISODate(new Date());
      return;
    }
    var st = CORE.packStatus(state.tracked, pkg);
    $('trName').textContent = pkg.name + ' — ' + opName(pkg.operator);
    var badge = $('trStatus');
    if (st.status === 'active') { badge.textContent = t('active'); badge.className = 'badge'; }
    else if (st.status === 'ends_today') { badge.textContent = t('endsToday'); badge.className = 'badge amber'; }
    else if (st.status === 'expired') { badge.textContent = t('expired'); badge.className = 'badge red'; }
    else { badge.textContent = t('dataFinished'); badge.className = 'badge red'; }
    $('trBar').style.width = Math.min(100, st.usedPct) + '%';
    $('trUsed').textContent = num(st.used) + ' / ' + num(pkg.dataGB) + ' ' + t('gb');
    $('trLeft').textContent = num(st.dataLeft) + ' ' + t('gb');
    $('trDays').textContent = st.daysLeft < 0
      ? t('expired') + ' (' + num(-st.daysLeft) + ' ' + t('days') + ')'
      : num(st.daysLeft) + ' ' + t('daysLeft');
    $('trBudget').textContent = num(st.dailyBudget) + ' ' + t('gb');
    $('trExpiry').textContent = st.expiry;
    $('trUsedInput').value = state.tracked.usedGB;
  }

  function renderAll() {
    applyI18n();
    fillOperatorSelects();
    fillTypeSelects();
    $('fltOperator').value = filters.operator;
    $('fltType').value = filters.type;
    $('fltActive').checked = filters.activeOnly;
    renderStats();
    renderCompare();
    renderPlanner();
    renderMyPack();
    renderManage();
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.add('hidden'); });
      $('tab-' + btn.getAttribute('data-tab')).classList.remove('hidden');
    });
  });

  /* ---------- language ---------- */
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save();
    renderAll();
  });

  /* ---------- compare filters ---------- */
  $('fltOperator').addEventListener('change', function () { filters.operator = this.value; renderCompare(); });
  $('fltType').addEventListener('change', function () { filters.type = this.value; renderCompare(); });
  $('fltActive').addEventListener('change', function () { filters.activeOnly = this.checked; renderCompare(); });

  /* ---------- examples ---------- */
  $('loadExamplesBtn').addEventListener('click', function () {
    DATA.EXAMPLE_PACKS.forEach(function (ex) {
      state.packages.push({
        id: 'p' + Date.now() + Math.floor(Math.random() * 100000),
        operator: ex.operator, name: ex.name, dataGB: ex.dataGB,
        validityDays: ex.validityDays, priceBDT: ex.priceBDT, type: ex.type,
        notes: ex.notes, active: true, example: true,
      });
    });
    save();
    renderAll();
  });

  /* ---------- planner inputs ---------- */
  ['plVideo', 'plSocial', 'plBrowse', 'plMusic'].forEach(function (id) {
    $(id).addEventListener('input', renderPlanner);
  });
  $('plQuality').addEventListener('change', renderPlanner);

  /* ---------- pack form ---------- */
  function readPackForm() {
    return {
      name: $('pfName').value.trim(),
      operator: $('pfOperator').value,
      type: $('pfType').value,
      dataGB: parseFloat($('pfData').value),
      validityDays: parseInt($('pfValidity').value, 10),
      priceBDT: parseFloat($('pfPrice').value),
      notes: $('pfNotes').value.trim(),
      active: true,
    };
  }
  function packFormError(errs) {
    var map = { name: 'errName', data: 'errData', validity: 'errValidity', price: 'errPrice' };
    return errs.map(function (e) { return t(map[e] || 'errName'); }).join(' ');
  }
  $('pfSaveBtn').addEventListener('click', function () {
    var p = readPackForm();
    var errs = CORE.validatePack(p);
    if (errs.length) {
      $('pfError').textContent = packFormError(errs);
      $('pfError').classList.remove('hidden');
      return;
    }
    $('pfError').classList.add('hidden');
    if (state.editingId) {
      var idx = state.packages.findIndex(function (x) { return x.id === state.editingId; });
      if (idx >= 0) state.packages[idx] = Object.assign({}, state.packages[idx], p, { id: state.editingId });
      state.editingId = null;
      $('pfCancelBtn').classList.add('hidden');
    } else {
      p.id = 'p' + Date.now() + Math.floor(Math.random() * 100000);
      state.packages.push(p);
    }
    $('packForm').reset();
    save();
    renderAll();
  });
  $('pfCancelBtn').addEventListener('click', function () {
    state.editingId = null;
    $('packForm').reset();
    $('pfCancelBtn').classList.add('hidden');
    $('pfError').classList.add('hidden');
  });

  /* ---------- manage actions (delegated) ---------- */
  $('manageList').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    var card = ev.target.closest('.pack-card');
    var id = card.getAttribute('data-id');
    var idx = state.packages.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return;
    var act = btn.getAttribute('data-act');
    if (act === 'delete') {
      state.packages.splice(idx, 1);
      if (state.tracked && state.tracked.packageId === id) state.tracked = null;
      save();
      renderAll();
    } else if (act === 'pause') {
      state.packages[idx].active = state.packages[idx].active === false ? true : false;
      save();
      renderAll();
    } else if (act === 'edit') {
      var p = state.packages[idx];
      state.editingId = id;
      $('pfOperator').value = p.operator;
      $('pfType').value = p.type;
      $('pfName').value = p.name;
      $('pfData').value = p.dataGB;
      $('pfValidity').value = p.validityDays;
      $('pfPrice').value = p.priceBDT;
      $('pfNotes').value = p.notes || '';
      $('pfCancelBtn').classList.remove('hidden');
      document.querySelector('[data-tab="packages"]').scrollIntoView();
      $('pfName').focus();
    }
  });

  /* ---------- my pack actions ---------- */
  $('trStartBtn').addEventListener('click', function () {
    var pkgId = $('trPackSelect').value;
    var pkg = state.packages.find(function (p) { return p.id === pkgId; });
    var used = parseFloat($('trUsedNew').value) || 0;
    var tr = { packageId: pkgId, startDate: $('trStartDate').value, usedGB: used };
    var errs = CORE.validateTracked(tr, pkg);
    if (errs.length) {
      $('trFormError').textContent = errs.indexOf('startDate') >= 0 ? t('errStartDate') : t('errUsed');
      $('trFormError').classList.remove('hidden');
      return;
    }
    $('trFormError').classList.add('hidden');
    state.tracked = tr;
    save();
    renderAll();
  });
  $('trUpdateBtn').addEventListener('click', function () {
    var pkg = trackedPkg();
    if (!pkg) return;
    var used = parseFloat($('trUsedInput').value) || 0;
    var tr = { packageId: state.tracked.packageId, startDate: state.tracked.startDate, usedGB: used };
    var errs = CORE.validateTracked(tr, pkg);
    if (errs.length) {
      $('trError').textContent = t('errUsed');
      $('trError').classList.remove('hidden');
      return;
    }
    $('trError').classList.add('hidden');
    state.tracked = tr;
    save();
    renderAll();
  });
  $('trStopBtn').addEventListener('click', function () {
    state.tracked = null;
    save();
    renderAll();
  });

  /* ---------- export / import / erase ---------- */
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ app: 'internet-package-bd', version: 1, packages: state.packages, tracked: state.tracked }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'internet-package-bd-backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (!CORE.validateBackup(obj)) throw new Error('invalid');
        state.packages = obj.packages;
        state.tracked = obj.tracked || null;
        save();
        renderAll();
        $('dataMsg').textContent = t('importOk');
        $('dataMsg').classList.remove('hidden');
      } catch (e) {
        $('dataMsg').textContent = t('importBad');
        $('dataMsg').classList.remove('hidden');
      }
    };
    reader.readAsText(file);
    this.value = '';
  });
  $('eraseBtn').addEventListener('click', function () {
    $('eraseBox').classList.toggle('hidden');
  });
  $('eraseConfirmBtn').addEventListener('click', function () {
    if ($('eraseInput').value.trim() !== 'DELETE') return;
    state.packages = [];
    state.tracked = null;
    state.editingId = null;
    save();
    $('eraseInput').value = '';
    $('eraseBox').classList.add('hidden');
    $('dataMsg').textContent = t('eraseDone');
    $('dataMsg').classList.remove('hidden');
    renderAll();
  });

  load();
  renderAll();
})();
