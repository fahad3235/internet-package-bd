/* Internet Package BD - headless-Chrome smoke tests via raw CDP (no deps).
   Run: node tests/smoke.mjs [width]   (default 1280; pass 390 for mobile)
   Uses the Playwright-cached headless_shell. Serves the app over file:// */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHELL = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = 900;
const PORT = 9336;

let failures = [];
let checks = 0;
function check(name, cond, extra = '') {
  checks++;
  if (cond) console.log('  PASS ' + name);
  else { failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, `--window-size=${WIDTH},${HEIGHT}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('CDP did not start');
}

async function main() {
  const browserWs = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { browserWs.onopen = res; browserWs.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const events = [];
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, method, params }));
  });

  const target = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = target.result.targetId;
  const attached = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  const sendS = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, sessionId, method, params }));
  });

  await sendS('Runtime.enable');
  await sendS('Page.enable');
  await sendS('Network.enable');
  await sendS('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 500 });

  const consoleErrors = [];
  const pageErrors = [];
  const extRequests = [];
  const origOnMessage = browserWs.onmessage;
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    }
    if (m.sessionId === sessionId && m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (m.sessionId === sessionId && m.method === 'Network.requestWillBeSent') {
      const url = m.params.request.url;
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('chrome')) {
        extRequests.push(url);
      }
    }
    origOnMessage(ev);
  };

  const evalJs = async (expr) => {
    const r = await sendS('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  const fileUrl = 'file://' + path.join(ROOT, 'index.html');
  await sendS('Page.navigate', { url: fileUrl });
  await sleep(1200);

  console.log(`== smoke @ ${WIDTH}px ==`);

  check('page title', (await evalJs('document.title')).includes('Internet Package BD'));
  check('h1 renders', (await evalJs(`document.querySelector('h1').textContent`)) === 'Internet Package BD');
  check('4 tabs present', (await evalJs(`document.querySelectorAll('.tab').length`)) === 4);
  check('compare empty state shows', (await evalJs(`document.getElementById('compareEmpty').classList.contains('hidden')`)) === false);
  check('load-examples button visible', (await evalJs(`document.getElementById('loadExamplesBtn').classList.contains('hidden')`)) === false);
  check('stats total is 0', (await evalJs(`document.getElementById('statTotal').textContent`)) === '0');
  check('no horizontal overflow (compare)', (await evalJs('document.documentElement.scrollWidth')) <= WIDTH + 1,
    'scrollWidth=' + (await evalJs('document.documentElement.scrollWidth')));

  // --- load examples: 3 packs, cheapest = 40 GB Robi at 12.48/GB ---
  await evalJs(`document.getElementById('loadExamplesBtn').click()`);
  await sleep(250);
  check('3 packs after loading examples', (await evalJs(`document.querySelectorAll('#compareList .pack-card').length`)) === 3);
  check('stats total is 3', (await evalJs(`document.getElementById('statTotal').textContent`)) === '3');
  check('cheapest stat is 12.48', (await evalJs(`document.getElementById('statCheapest').textContent`)).includes('12.48'),
    await evalJs(`document.getElementById('statCheapest').textContent`));
  check('cheapest badge on 40 GB pack', await evalJs(`(function(){
    const cards = document.querySelectorAll('#compareList .pack-card');
    return cards[0].textContent.includes('40 GB') && cards[0].textContent.includes('Cheapest');
  })()`));
  check('example badges shown', (await evalJs(`document.querySelectorAll('#compareList .badge.amber').length`)) === 3);
  check('load-examples button hidden after load', (await evalJs(`document.getElementById('loadExamplesBtn').classList.contains('hidden')`)) === true);

  // --- operator filter: GP only -> 1 pack ---
  await evalJs(`(function(){ const s = document.getElementById('fltOperator'); s.value = 'gp'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(200);
  check('GP filter narrows to 1 pack', (await evalJs(`document.querySelectorAll('#compareList .pack-card').length`)) === 1);
  await evalJs(`(function(){ const s = document.getElementById('fltOperator'); s.value = 'all'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(200);
  check('clearing filter restores 3 packs', (await evalJs(`document.querySelectorAll('#compareList .pack-card').length`)) === 3);

  // --- planner: defaults video 1h std, social 2h, browse 1h, music 1h -> 33.3 GB, suggest 40 GB ---
  await evalJs(`document.querySelector('[data-tab="planner"]').click()`);
  await sleep(200);
  check('planner need is 33.3 GB', (await evalJs(`document.getElementById('plNeed').textContent`)).includes('33.3'),
    await evalJs(`document.getElementById('plNeed').textContent`));
  check('planner suggests 40 GB', (await evalJs(`document.getElementById('plSuggest').textContent`)).includes('40'),
    await evalJs(`document.getElementById('plSuggest').textContent`));
  check('1 matching pack covers 33.3 GB', (await evalJs(`document.querySelectorAll('#matchList .pack-card').length`)) === 1);
  // HD video raises the need
  await evalJs(`(function(){ const s = document.getElementById('plQuality'); s.value = 'hd'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(200);
  check('HD quality raises need to 57.3 GB', (await evalJs(`document.getElementById('plNeed').textContent`)).includes('57.3'),
    await evalJs(`document.getElementById('plNeed').textContent`));
  check('no pack covers 57.3 GB, empty state shows', (await evalJs(`document.getElementById('matchEmpty').classList.contains('hidden')`)) === false);
  await evalJs(`(function(){ const s = document.getElementById('plQuality'); s.value = 'std'; s.dispatchEvent(new Event('change')); })()`);
  await sleep(200);

  // --- add pack: invalid first, then valid ---
  await evalJs(`document.querySelector('[data-tab="packages"]').click()`);
  await sleep(200);
  check('manage lists 3 packs', (await evalJs(`document.querySelectorAll('#manageList .pack-card').length`)) === 3);
  await evalJs(`(function(){
    document.getElementById('pfName').value = '';
    document.getElementById('pfData').value = '0';
    document.getElementById('pfValidity').value = '30';
    document.getElementById('pfPrice').value = '100';
    document.getElementById('pfSaveBtn').click();
  })()`);
  await sleep(200);
  check('invalid pack shows error', (await evalJs(`document.getElementById('pfError').classList.contains('hidden')`)) === false);
  check('invalid pack not added', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).packages.length`)) === 3);
  await evalJs(`(function(){
    document.getElementById('pfName').value = 'Test 25 GB / 30 days';
    document.getElementById('pfData').value = '25';
    document.getElementById('pfValidity').value = '30';
    document.getElementById('pfPrice').value = '350';
    document.getElementById('pfSaveBtn').click();
  })()`);
  await sleep(250);
  check('valid pack added (4 total)', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).packages.length`)) === 4);
  check('manage lists 4 packs', (await evalJs(`document.querySelectorAll('#manageList .pack-card').length`)) === 4);

  // --- pause the 25 GB pack: compare (active only) drops to 3 ---
  await evalJs(`(function(){
    const cards = document.querySelectorAll('#manageList .pack-card');
    for (const c of cards) if (c.textContent.includes('Test 25 GB')) { c.querySelector('[data-act="pause"]').click(); break; }
  })()`);
  await sleep(250);
  await evalJs(`document.querySelector('[data-tab="compare"]').click()`);
  await sleep(200);
  check('paused pack hidden from compare', (await evalJs(`document.querySelectorAll('#compareList .pack-card').length`)) === 3);

  // --- my pack: track the 15 GB GP pack from today, used 5 GB -> 29 days left, 10 GB left ---
  await evalJs(`document.querySelector('[data-tab="mypack"]').click()`);
  await sleep(200);
  const todayISO = await evalJs(`new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0')`);
  await evalJs(`(function(){
    const sel = document.getElementById('trPackSelect');
    for (const o of sel.options) if (o.textContent.includes('15 GB')) { sel.value = o.value; break; }
    document.getElementById('trStartDate').value = ${JSON.stringify(todayISO)};
    document.getElementById('trUsedNew').value = '5';
    document.getElementById('trStartBtn').click();
  })()`);
  await sleep(250);
  check('tracked card shows after start', (await evalJs(`document.getElementById('trackedCard').classList.contains('hidden')`)) === false);
  check('tracked status is Active', (await evalJs(`document.getElementById('trStatus').textContent`)) === 'Active');
  check('29 days left (30-day pack started today)', (await evalJs(`document.getElementById('trDays').textContent`)).includes('29'),
    await evalJs(`document.getElementById('trDays').textContent`));
  check('10 GB left after 5 used', (await evalJs(`document.getElementById('trLeft').textContent`)).includes('10'),
    await evalJs(`document.getElementById('trLeft').textContent`));
  check('progress bar is 33%', (await evalJs(`document.getElementById('trBar').style.width`)) === '33%');
  // update used to 10 -> 5 GB left
  await evalJs(`(function(){ document.getElementById('trUsedInput').value = '10'; document.getElementById('trUpdateBtn').click(); })()`);
  await sleep(200);
  check('updating used to 10 leaves 5 GB', (await evalJs(`document.getElementById('trLeft').textContent`)).includes('5'),
    await evalJs(`document.getElementById('trLeft').textContent`));
  // used beyond pack size is rejected
  await evalJs(`(function(){ document.getElementById('trUsedInput').value = '99'; document.getElementById('trUpdateBtn').click(); })()`);
  await sleep(200);
  check('used > pack size shows error', (await evalJs(`document.getElementById('trError').classList.contains('hidden')`)) === false);
  await evalJs(`document.getElementById('trStopBtn').click()`);
  await sleep(200);
  check('stop tracking hides card', (await evalJs(`document.getElementById('trackedCard').classList.contains('hidden')`)) === true);

  // --- language toggle: BN title + Bengali digits ---
  await evalJs(`document.getElementById('langBtn').click()`);
  await sleep(250);
  check('BN toggle changes title', (await evalJs(`document.querySelector('h1').textContent`)) === 'ইন্টারনেট প্যাকেজ বিডি',
    await evalJs(`document.querySelector('h1').textContent`));
  check('BN digits appear in stats total', /[০-৯]/.test(await evalJs(`document.getElementById('statTotal').textContent`)),
    await evalJs(`document.getElementById('statTotal').textContent`));
  check('lang persists in localStorage', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).lang`)) === 'bn');
  await evalJs(`document.getElementById('langBtn').click()`);
  await sleep(200);
  check('toggle back to English', (await evalJs(`document.querySelector('h1').textContent`)) === 'Internet Package BD');

  // --- reload persistence: 4 packs survive reload ---
  await sendS('Page.navigate', { url: fileUrl });
  await sleep(1000);
  check('4 packs survive reload', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).packages.length`)) === 4);
  check('no horizontal overflow after reload', (await evalJs('document.documentElement.scrollWidth')) <= WIDTH + 1);

  // --- erase-all: wrong word does nothing, DELETE wipes ---
  await evalJs(`document.querySelector('[data-tab="packages"]').click()`);
  await sleep(200);
  await evalJs(`document.getElementById('eraseBtn').click()`);
  await sleep(150);
  await evalJs(`(function(){ document.getElementById('eraseInput').value = 'delete'; document.getElementById('eraseConfirmBtn').click(); })()`);
  await sleep(200);
  check('wrong erase word keeps data', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).packages.length`)) === 4);
  await evalJs(`(function(){ document.getElementById('eraseInput').value = 'DELETE'; document.getElementById('eraseConfirmBtn').click(); })()`);
  await sleep(250);
  check('DELETE erases all packs', (await evalJs(`JSON.parse(localStorage.getItem('internet-package-bd-v1')).packages.length`)) === 0);
  check('compare empty state returns', (await evalJs(`document.getElementById('compareEmpty').classList.contains('hidden')`)) === false);

  // --- error / network hygiene ---
  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('zero page exceptions', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero non-file network requests', extRequests.length === 0, extRequests.join(', '));

  console.log(`\n${checks - failures.length}/${checks} checks passed${failures.length ? ', FAILURES:\n- ' + failures.join('\n- ') : ''}`);

  browserWs.close();
  chrome.kill();
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error('SMOKE CRASH:', e); chrome.kill(); process.exit(1); });
