/* Captures de contrôle dans un vrai navigateur (Chromium + WebGL).
   Usage : node test/navigateur/captures.js [dossier-de-sortie]
   Nécessite : npm i puppeteer-core @sparticuz/chromium, et le site servi
   sur http://localhost:8000 (python3 -m http.server 8000).
   Le rendu logiciel de Chromium est lent : on plante dans une petite fenêtre,
   puis on repasse en 1280×800 juste avant la photo. */
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = 'http://localhost:8000/';
const SORTIE = process.argv[2] || '/home/user/arbres-3d/docs/captures/';

const cibles = require('./scenes.js');

async function attendrePret(page, max) {
  const t0 = Date.now();
  let dernier = '';
  while ((Date.now() - t0) / 1000 < max) {
    const etat = await page.evaluate(() => {
      const ch = document.getElementById('chargement');
      const det = document.getElementById('chargement-detail') || document.getElementById('ch-detail');
      const jauge = document.querySelector('.jauge-remplie');
      const g = window.__jardin;
      return {
        fini: (ch ? ch.hidden === true : !!window.__galerie),
        progression: (ch ? (det ? det.textContent : '') : '') + (jauge ? ' ' + (jauge.style.width || '') : ''),
        arbres: g && g.arbre && g.arbre.arbres ? g.arbre.arbres.length : null
      };
    });
    if (etat.fini) return { ok: true, secondes: (Date.now() - t0) / 1000, arbres: etat.arbres };
    if (etat.progression && etat.progression !== dernier) {
      dernier = etat.progression;
      console.log('   … ' + dernier + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return { ok: false, secondes: (Date.now() - t0) / 1000 };
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-lcd-text',
      '--disable-http-cache', '--disk-cache-size=1'],
    headless: true,
    defaultViewport: { width: 760, height: 480 }
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('pageerror', e => console.log('   ⚠ erreur de page : ' + String(e).slice(0, 200)));
  page.on('requestfailed', r => console.log('   ⚠ requête échouée : ' + r.url()));

  for (const c of cibles) {
    console.log('\n=== ' + c.nom + ' : ' + c.url);
    await page.goto(BASE + c.url + (c.url.includes('?') ? '&' : '?') + 't=' + Date.now(),
      { waitUntil: 'domcontentloaded', timeout: 120000 });
    // les pages d'origine n'ont ni écran de chargement ni objet exposé : on
    // leur laisse simplement le temps de construire et de faire tourner la scène
    const r = c.delai
      ? { ok: true, secondes: (await new Promise(x => setTimeout(x, c.delai)), c.delai / 1000) }
      : await attendrePret(page, c.max || 900);
    console.log('   prêt=' + r.ok + ' en ' + r.secondes.toFixed(0) + ' s' +
      (r.arbres != null ? ' | arbres=' + r.arbres : ''));
    if (c.actions) {
      for (const a of c.actions) {
        console.log('   ▸ ' + a.quoi);
        if (a.clic) await page.evaluate(sel => {
          const b = [...document.querySelectorAll('.bouton-outil')]
            .find(x => x.textContent.trim().toLowerCase().includes(sel.toLowerCase()));
          if (b) b.click();
          return !!b;
        }, a.clic);
        await new Promise(x => setTimeout(x, a.attente || 3000));
      }
    }
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await new Promise(x => setTimeout(x, c.attentePhoto || 6000));
    const etat = await page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const gl = cv && (cv.getContext('webgl2') || cv.getContext('webgl'));
      const texte = (document.getElementById('compteur') || {}).textContent;
      const fiche = document.getElementById('fiche');
      return {
        canvas: cv ? cv.width + '×' + cv.height : null,
        webgl: gl ? gl.getParameter(gl.VERSION) : null,
        compteur: texte || null,
        ficheVisible: fiche ? fiche.hidden === false : null
      };
    });
    console.log('   ' + JSON.stringify(etat));
    await page.screenshot({ path: SORTIE + c.nom + '.png' });
    console.log('   📷 ' + c.nom + '.png');
  }
  await browser.close();
  console.log('\nTERMINÉ');
})().catch(e => { console.error('ÉCHEC :', e.message); process.exit(1); });
