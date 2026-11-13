/* Internet Package BD - pure logic (no DOM). Node-testable.
   All money is BDT (taka). All data is GB. Dates are ISO yyyy-mm-dd. */
(function (root) {
  'use strict';

  var LIMITS = {
    dataGB: { min: 0.1, max: 1000 },
    validityDays: { min: 1, max: 365 },
    priceBDT: { min: 1, max: 100000 },
    hoursPerDay: { min: 0, max: 24 },
  };

  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }

  function costPerGB(pkg) {
    if (!pkg || !(pkg.dataGB > 0)) return null;
    return round2(pkg.priceBDT / pkg.dataGB);
  }
  function costPerDay(pkg) {
    if (!pkg || !(pkg.validityDays > 0)) return null;
    return round2(pkg.priceBDT / pkg.validityDays);
  }
  function dataPerDay(pkg) {
    if (!pkg || !(pkg.validityDays > 0)) return null;
    return round2(pkg.dataGB / pkg.validityDays);
  }

  function validatePack(p) {
    var errors = [];
    if (!p || typeof p.name !== 'string' || p.name.trim().length === 0) errors.push('name');
    if (!(p.dataGB >= LIMITS.dataGB.min && p.dataGB <= LIMITS.dataGB.max)) errors.push('data');
    if (!(p.validityDays >= LIMITS.validityDays.min && p.validityDays <= LIMITS.validityDays.max)) errors.push('validity');
    if (!(p.priceBDT >= LIMITS.priceBDT.min && p.priceBDT <= LIMITS.priceBDT.max)) errors.push('price');
    return errors;
  }
  function isValidPack(p) { return validatePack(p).length === 0; }

  function validateHours(h) {
    var errors = [];
    ['video', 'social', 'browse', 'music'].forEach(function (k) {
      if (!(h[k] >= LIMITS.hoursPerDay.min && h[k] <= LIMITS.hoursPerDay.max)) errors.push(k);
    });
    return errors;
  }

  /* Rank active packs cheapest-first by cost per GB. Ties: lower price first.
     Returns copies annotated with perGB, perDay, dataDay, cheapest, saveVsMax. */
  function rankPackages(packs) {
    var active = packs.filter(function (p) { return p.active !== false && isValidPack(p); });
    var ranked = active.map(function (p) {
      return {
        id: p.id, operator: p.operator, name: p.name, dataGB: p.dataGB,
        validityDays: p.validityDays, priceBDT: p.priceBDT, type: p.type,
        notes: p.notes || '', perGB: costPerGB(p), perDay: costPerDay(p),
        dataDay: dataPerDay(p), cheapest: false, saveVsMax: 0,
        isExample: !!p.example,
      };
    });
    ranked.sort(function (a, b) {
      return (a.perGB - b.perGB) || (a.priceBDT - b.priceBDT);
    });
    if (ranked.length) {
      ranked[0].cheapest = true;
      var maxPerGB = ranked[ranked.length - 1].perGB;
      ranked.forEach(function (r) { r.saveVsMax = round2((maxPerGB - r.perGB) * r.dataGB); });
    }
    return ranked;
  }

  function cheapestPerGB(packs) {
    var ranked = rankPackages(packs);
    return ranked.length ? ranked[0] : null;
  }

  /* Monthly need (GB) from daily hours + usage rates (GB/hour).
     videoRate depends on the chosen quality key. 30-day month. */
  function estimateMonthlyGB(hours, rates, videoQuality) {
    var videoRate = rates['video_' + (videoQuality || 'std')] || rates.video_std;
    var daily = hours.video * videoRate + hours.social * rates.social
      + hours.browse * rates.browse + hours.music * rates.music;
    return round1(daily * 30);
  }

  /* Suggested pack size: round the monthly need up to the next tier so the
     user keeps a small buffer. Tiers are GB. */
  var SIZE_TIERS = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200];
  function suggestedSize(monthlyGB) {
    for (var i = 0; i < SIZE_TIERS.length; i++) {
      if (SIZE_TIERS[i] >= monthlyGB) return SIZE_TIERS[i];
    }
    return Math.ceil(monthlyGB / 50) * 50;
  }

  /* Packs (active only) whose data covers the monthly need, cheapest-first. */
  function matchingPacks(packs, monthlyGB) {
    return rankPackages(packs).filter(function (p) { return p.dataGB >= monthlyGB; });
  }

  /* ---- My Pack tracking ---- */
  function parseDate(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length !== 3) return null;
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function toISODate(d) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(iso, n) {
    var d = parseDate(iso);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }
  /* Whole days between two ISO dates (b - a). Negative when b is before a. */
  function daysBetween(aISO, bISO) {
    var a = parseDate(aISO), b = parseDate(bISO);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  /* Status of a tracked pack as of `asOfISO` (defaults to today).
     expiry = start + validity days (last covered day is the day before).
     daysLeft: 0 on the last covered day, negative once expired. */
  function packStatus(tracked, pkg, asOfISO) {
    var asOf = asOfISO || toISODate(new Date());
    var expiry = addDays(tracked.startDate, pkg.validityDays);
    var daysLeft = daysBetween(asOf, addDays(tracked.startDate, pkg.validityDays - 1));
    var dataLeft = round1(Math.max(0, pkg.dataGB - (tracked.usedGB || 0)));
    var used = round1(Math.min(pkg.dataGB, tracked.usedGB || 0));
    var status = 'active';
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft === 0) status = 'ends_today';
    else if (dataLeft <= 0) status = 'data_finished';
    var dailyBudget = daysLeft > 0 ? round2(dataLeft / daysLeft) : 0;
    return {
      expiry: expiry, daysLeft: daysLeft, dataLeft: dataLeft, used: used,
      status: status, dailyBudget: dailyBudget,
      usedPct: pkg.dataGB > 0 ? Math.round((used / pkg.dataGB) * 100) : 0,
    };
  }

  function validateTracked(tracked, pkg) {
    var errors = [];
    if (!tracked || !parseDate(tracked.startDate)) errors.push('startDate');
    if (pkg && !(tracked.usedGB >= 0 && tracked.usedGB <= pkg.dataGB)) errors.push('used');
    return errors;
  }

  /* ---- Backup validation ---- */
  function validateBackup(obj) {
    if (!obj || typeof obj !== 'object' || obj.app !== 'internet-package-bd') return false;
    if (!Array.isArray(obj.packages)) return false;
    for (var i = 0; i < obj.packages.length; i++) {
      var p = obj.packages[i];
      if (!p || typeof p.id !== 'string' || !isValidPack(p)) return false;
    }
    if (obj.tracked != null) {
      var t = obj.tracked;
      if (typeof t !== 'object' || typeof t.packageId !== 'string' || !parseDate(t.startDate)) return false;
      if (!(t.usedGB >= 0)) return false;
    }
    return true;
  }

  /* Bengali digits for display. */
  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function fmtNum(n, lang) {
    if (n == null || isNaN(n)) return '';
    var s = String(n);
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  var api = {
    LIMITS: LIMITS, costPerGB: costPerGB, costPerDay: costPerDay,
    dataPerDay: dataPerDay, validatePack: validatePack, isValidPack: isValidPack,
    validateHours: validateHours, rankPackages: rankPackages,
    cheapestPerGB: cheapestPerGB, estimateMonthlyGB: estimateMonthlyGB,
    suggestedSize: suggestedSize, matchingPacks: matchingPacks,
    parseDate: parseDate, toISODate: toISODate, addDays: addDays,
    daysBetween: daysBetween, packStatus: packStatus,
    validateTracked: validateTracked, validateBackup: validateBackup,
    toBnDigits: toBnDigits, fmtNum: fmtNum, SIZE_TIERS: SIZE_TIERS,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IPBD_CORE = api;
})(typeof window !== 'undefined' ? window : globalThis);
