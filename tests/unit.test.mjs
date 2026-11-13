/* Internet Package BD - unit tests (Node, no DOM).
   Run: node --test tests/unit.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

globalThis.window = globalThis;
const coreSrc = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8');
eval(coreSrc);
const CORE = globalThis.IPBD_CORE;
eval(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'));
const DATA = globalThis.IPBD_DATA;
const I18N = globalThis.IPBD_I18N;

const P = (over) => Object.assign({
  id: 'p1', operator: 'gp', name: '15 GB / 30 days', dataGB: 15,
  validityDays: 30, priceBDT: 299, type: 'regular', active: true,
}, over || {});

test('cost math: per-GB, per-day, data-per-day', () => {
  assert.equal(CORE.costPerGB(P()), 19.93);
  assert.equal(CORE.costPerDay(P()), 9.97);
  assert.equal(CORE.costPerDay(P({ priceBDT: 300, validityDays: 30 })), 10);
  assert.equal(CORE.dataPerDay(P()), 0.5);
  assert.equal(CORE.costPerGB(P({ dataGB: 40, priceBDT: 499 })), 12.48);
  assert.equal(CORE.costPerGB({ dataGB: 0, priceBDT: 100 }), null);
});

test('pack validation accepts good packs and rejects each bad field', () => {
  assert.deepEqual(CORE.validatePack(P()), []);
  assert.deepEqual(CORE.validatePack(P({ name: '  ' })), ['name']);
  assert.deepEqual(CORE.validatePack(P({ dataGB: 0.05 })), ['data']);
  assert.deepEqual(CORE.validatePack(P({ dataGB: 1001 })), ['data']);
  assert.deepEqual(CORE.validatePack(P({ validityDays: 0 })), ['validity']);
  assert.deepEqual(CORE.validatePack(P({ validityDays: 366 })), ['validity']);
  assert.deepEqual(CORE.validatePack(P({ priceBDT: 0 })), ['price']);
  assert.deepEqual(CORE.validatePack(P({ priceBDT: 100001 })), ['price']);
  assert.deepEqual(CORE.validatePack(P({ dataGB: 0.1, validityDays: 1, priceBDT: 1 })), []);
  assert.equal(CORE.isValidPack(P({ priceBDT: -5 })), false);
});

test('ranking: cheapest first, cheapest flag, savings vs most expensive', () => {
  const packs = [
    P({ id: 'a', dataGB: 15, priceBDT: 299 }),          // 19.93/GB
    P({ id: 'b', dataGB: 40, priceBDT: 499 }),          // 12.48/GB
    P({ id: 'c', dataGB: 5, priceBDT: 99, validityDays: 7 }), // 19.80/GB
  ];
  const ranked = CORE.rankPackages(packs);
  assert.deepEqual(ranked.map((r) => r.id), ['b', 'c', 'a']);
  assert.equal(ranked[0].cheapest, true);
  assert.equal(ranked[1].cheapest, false);
  // most expensive is a (19.93/GB); b saves (19.93-12.48)*40 = 298
  assert.equal(ranked[0].saveVsMax, 298);
  assert.equal(ranked[2].saveVsMax, 0);
  // paused and invalid packs are excluded
  const withPaused = CORE.rankPackages(packs.concat([
    P({ id: 'd', dataGB: 100, priceBDT: 100, active: false }),
    P({ id: 'e', dataGB: 0, priceBDT: 1 }),
  ]));
  assert.equal(withPaused.length, 3);
  assert.equal(CORE.cheapestPerGB([]), null);
  assert.equal(CORE.cheapestPerGB(packs).id, 'b');
});

test('monthly estimate: rates, video quality, 30-day month', () => {
  const h = { video: 1, social: 2, browse: 1, music: 1 };
  // std: 1*0.7 + 2*0.15 + 1*0.06 + 1*0.05 = 1.11/day -> 33.3 GB
  assert.equal(CORE.estimateMonthlyGB(h, DATA.USAGE_RATES, 'std'), 33.3);
  // low: 1*0.3 + 0.3 + 0.06 + 0.05 = 0.71/day -> 21.3 GB
  assert.equal(CORE.estimateMonthlyGB(h, DATA.USAGE_RATES, 'low'), 21.3);
  // hd: 1*1.5 + 0.41 = 1.91/day -> 57.3 GB
  assert.equal(CORE.estimateMonthlyGB(h, DATA.USAGE_RATES, 'hd'), 57.3);
  assert.equal(CORE.estimateMonthlyGB({ video: 0, social: 0, browse: 0, music: 0 }, DATA.USAGE_RATES, 'std'), 0);
});

test('hours validation: 0-24 per day', () => {
  assert.deepEqual(CORE.validateHours({ video: 1, social: 2, browse: 1, music: 1 }), []);
  assert.deepEqual(CORE.validateHours({ video: 25, social: 0, browse: 0, music: 0 }), ['video']);
  assert.deepEqual(CORE.validateHours({ video: -1, social: 0, browse: 0, music: 0 }), ['video']);
  assert.deepEqual(CORE.validateHours({ video: 24, social: 24, browse: 24, music: 24 }), []);
});

test('suggested size rounds up to the next tier', () => {
  assert.equal(CORE.suggestedSize(0.5), 1);
  assert.equal(CORE.suggestedSize(10), 10);
  assert.equal(CORE.suggestedSize(10.1), 15);
  assert.equal(CORE.suggestedSize(33.3), 40);
  assert.equal(CORE.suggestedSize(200), 200);
  assert.equal(CORE.suggestedSize(250), 250);
});

test('matching packs cover the need, cheapest first', () => {
  const packs = [
    P({ id: 'a', dataGB: 15, priceBDT: 299 }),
    P({ id: 'b', dataGB: 40, priceBDT: 499 }),
    P({ id: 'c', dataGB: 5, priceBDT: 99, validityDays: 7 }),
  ];
  assert.deepEqual(CORE.matchingPacks(packs, 33.3).map((p) => p.id), ['b']);
  assert.deepEqual(CORE.matchingPacks(packs, 5).map((p) => p.id), ['b', 'c', 'a']);
  assert.deepEqual(CORE.matchingPacks(packs, 100), []);
});

test('date math: addDays, daysBetween, month-end clamping via Date', () => {
  assert.equal(CORE.addDays('2026-11-13', 30), '2026-12-13');
  assert.equal(CORE.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(CORE.daysBetween('2026-11-13', '2026-11-20'), 7);
  assert.equal(CORE.daysBetween('2026-11-20', '2026-11-13'), -7);
  assert.equal(CORE.daysBetween('2026-11-13', '2026-11-13'), 0);
  assert.equal(CORE.parseDate('not-a-date'), null);
});

test('pack status: active, ends today, expired, data finished, daily budget', () => {
  const pkg = P({ dataGB: 15, validityDays: 30 });
  // start 2026-11-01, asOf 2026-11-13: last covered day 2026-11-30, daysLeft 17
  let st = CORE.packStatus({ startDate: '2026-11-01', usedGB: 5 }, pkg, '2026-11-13');
  assert.equal(st.status, 'active');
  assert.equal(st.daysLeft, 17);
  assert.equal(st.dataLeft, 10);
  assert.equal(st.expiry, '2026-12-01');
  assert.equal(st.dailyBudget, 0.59);
  assert.equal(st.usedPct, 33);
  // last covered day
  st = CORE.packStatus({ startDate: '2026-11-01', usedGB: 0 }, pkg, '2026-11-30');
  assert.equal(st.status, 'ends_today');
  assert.equal(st.daysLeft, 0);
  // expired
  st = CORE.packStatus({ startDate: '2026-11-01', usedGB: 0 }, pkg, '2026-12-05');
  assert.equal(st.status, 'expired');
  assert.equal(st.daysLeft, -5);
  // data finished while still valid
  st = CORE.packStatus({ startDate: '2026-11-01', usedGB: 15 }, pkg, '2026-11-13');
  assert.equal(st.status, 'data_finished');
  assert.equal(st.dataLeft, 0);
  assert.equal(st.dailyBudget, 0);
});

test('tracked validation: start date required, used within pack', () => {
  const pkg = P({ dataGB: 15 });
  assert.deepEqual(CORE.validateTracked({ startDate: '2026-11-13', usedGB: 5 }, pkg), []);
  assert.deepEqual(CORE.validateTracked({ startDate: '', usedGB: 0 }, pkg), ['startDate']);
  assert.deepEqual(CORE.validateTracked({ startDate: '2026-11-13', usedGB: 16 }, pkg), ['used']);
  assert.deepEqual(CORE.validateTracked({ startDate: '2026-11-13', usedGB: -1 }, pkg), ['used']);
});

test('backup validation round-trip and rejections', () => {
  const good = { app: 'internet-package-bd', version: 1, packages: [P()], tracked: { packageId: 'p1', startDate: '2026-11-13', usedGB: 2 } };
  assert.equal(CORE.validateBackup(good), true);
  assert.equal(CORE.validateBackup({ app: 'internet-package-bd', packages: [] }), true);
  assert.equal(CORE.validateBackup({ app: 'other-app', packages: [] }), false);
  assert.equal(CORE.validateBackup({ app: 'internet-package-bd', packages: [P({ priceBDT: 0 })] }), false);
  assert.equal(CORE.validateBackup({ app: 'internet-package-bd', packages: 'x' }), false);
  assert.equal(CORE.validateBackup({ app: 'internet-package-bd', packages: [], tracked: { packageId: 'p1', startDate: 'bad', usedGB: 0 } }), false);
  assert.equal(CORE.validateBackup(null), false);
});

test('data + i18n integrity', () => {
  assert.equal(DATA.OPERATORS.length, 5);
  assert.equal(DATA.PACK_TYPES.length, 5);
  assert.equal(DATA.EXAMPLE_PACKS.length, 3);
  DATA.EXAMPLE_PACKS.forEach((p) => assert.deepEqual(CORE.validatePack(Object.assign({ name: 'x' }, p)), []));
  const enKeys = Object.keys(I18N.en).sort();
  const bnKeys = Object.keys(I18N.bn).sort();
  assert.deepEqual(bnKeys, enKeys);
  assert.ok(enKeys.length >= 80, 'expected >= 80 strings, got ' + enKeys.length);
  enKeys.forEach((k) => {
    assert.ok(I18N.en[k].length > 0, 'empty EN ' + k);
    assert.ok(I18N.bn[k].length > 0, 'empty BN ' + k);
  });
  // usage rates sane
  assert.ok(DATA.USAGE_RATES.video_hd > DATA.USAGE_RATES.video_std);
  assert.ok(DATA.USAGE_RATES.video_std > DATA.USAGE_RATES.video_low);
});

test('Bengali digits', () => {
  assert.equal(CORE.toBnDigits('1234567890'), '১২৩৪৫৬৭৮৯০');
  assert.equal(CORE.fmtNum(19.93, 'bn'), '১৯.৯৩');
  assert.equal(CORE.fmtNum(19.93, 'en'), '19.93');
});
