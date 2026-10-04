/* Captures des cinq pages d'origine, une par une et à petite fenêtre :
   sous rendu logiciel, ces scènes de plein écran sont très lentes.
   Usage : node origine.js <page> [largeur] [hauteur] */
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const page0 = process.argv[2] || 'arbre.html';
const W = parseInt(process.argv[3] || '820', 10), H = parseInt(process.argv[4] || '540', 10);
const SORTIE = '/home/user/arbres-3d/docs/captures/origine-' + page0.replace('.html', '') + '.png';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--hide-scrollbars', '--disable-http-cache', '--disk-cache-size=1'],
    headless: true, defaultViewport: { width: W, height: H }
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(String(e).slice(0, 200)));
  await page.goto('http://localhost:8000/' + page0 + '?t=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 120000 });
  console.log('chargée, attente de la construction…');
  await new Promise(r => setTimeout(r, 20000));
  const image = await Promise.race([
    page.screenshot({ path: SORTIE, timeout: 120000 }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('capture trop lente')), 180000))
  ]);
  console.log('📷 ' + SORTIE + ' (' + (image ? image.length : 0) + ' octets)');
  console.log(erreurs.length ? '⚠ erreurs : ' + erreurs.join(' | ') : '✓ aucune erreur de page');
  await browser.close();
})().catch(e => { console.error('ÉCHEC ' + page0 + ' : ' + e.message); process.exit(1); });
