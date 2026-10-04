/* Test de fumée : exécute arbres-core.js, arbres-ui.js et jardin.js hors
   navigateur (faux DOM, faux WebGL) et vérifie que tout se construit sans
   erreur. Usage : node test/smoke.js [--tout] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* ------------------------------------------------------------ faux DOM --- */
function fakeGradient() { return { addColorStop() { } }; }
function fakeCtx(canvas) {
  const ctx = {
    canvas, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineJoin: 'round', lineCap: 'round',
    globalAlpha: 1, globalCompositeOperation: 'source-over', font: '', textAlign: 'left',
    shadowBlur: 0, shadowColor: '#000',
    createLinearGradient: fakeGradient, createRadialGradient: fakeGradient, createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() { }, drawImage() { }, measureText: () => ({ width: 10 })
  };
  for (const m of ['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke',
    'save', 'restore', 'translate', 'rotate', 'scale', 'clip', 'setTransform', 'transform',
    'fillText', 'strokeText', 'setLineDash']) ctx[m] = () => { };
  return ctx;
}
function fakeCanvas() {
  const c = { width: 300, height: 150, style: {}, nodeType: 1, clientWidth: 1200, clientHeight: 800 };
  c.getContext = () => fakeCtx(c);
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 });
  c.addEventListener = () => { };
  c.removeEventListener = () => { };
  c.setAttribute = () => { };
  c.setPointerCapture = () => { };
  c.appendChild = () => { };
  c.toDataURL = () => 'data:,';
  return c;
}
function fakeElement(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), style: { setProperty() { } }, dataset: {}, children: [],
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    hidden: false, textContent: '', innerHTML: '', clientWidth: 1200, clientHeight: 800,
    appendChild(c) { this.children.push(c); return c; }, replaceWith() { }, remove() { },
    setAttribute() { }, getAttribute: () => null, addEventListener() { }, removeEventListener() { },
    querySelectorAll: () => [], querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
    focus() { }, onclick: null
  };
  return el;
}
const documentStub = {
  createElement: tag => (tag === 'canvas' ? fakeCanvas() : fakeElement(tag)),
  createElementNS: () => fakeCanvas(),
  body: fakeElement('body'),
  documentElement: fakeElement('html'),
  head: fakeElement('head'),
  addEventListener() { }, removeEventListener() { },
  getElementById: () => fakeElement('div'),
  querySelector: () => null,
  querySelectorAll: () => []
};
let frames = [];
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN, isFinite,
  parseFloat, parseInt, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array,
  Float32Array, Float64Array, Map, Set, Promise, WeakMap, Symbol, URLSearchParams,
  setTimeout: (cb) => { return 0; }, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
  document: documentStub, navigator: { userAgent: 'node' }, devicePixelRatio: 1,
  performance: { now: () => Date.now() },
  requestAnimationFrame: cb => { frames.push(cb); return frames.length; },
  cancelAnimationFrame() { },
  matchMedia: () => ({ matches: false, addEventListener() { } }),
  addEventListener() { }, removeEventListener() { },
  innerWidth: 1280, innerHeight: 800, location: { search: '', href: 'http://localhost/' },
  history: { replaceState() { } },
  URLSearchParams
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const THREE = require(path.join(ROOT, 'three.min.js'));
sandbox.THREE = THREE;

// --- faux moteur de rendu (pas de WebGL en Node)
let rendus = 0;
class FauxRenderer {
  constructor() {
    this.domElement = fakeCanvas();
    this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8, isWebGL2: true };
    this.outputEncoding = 0; this.toneMapping = 0; this.toneMappingExposure = 1;
    this._pr = 1;
  }
  setPixelRatio(v) { this._pr = v; }
  getPixelRatio() { return this._pr; }
  setSize() { }
  render() { rendus++; }
  dispose() { }
}
THREE.WebGLRenderer = FauxRenderer;

const fichiers = ['arbres-core.js', 'arbres-ui.js', 'jardin.js'];
for (const f of fichiers) {
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  } catch (e) {
    console.error('✗ erreur de chargement dans', f, '\n', e.stack);
    process.exit(1);
  }
}
const A = sandbox.window.ARBRES, U = sandbox.window.ARBRES_UI, J = sandbox.window.JARDIN;
if (!A || !U || !J) { console.error('✗ modules non exportés'); process.exit(1); }

/* ----------------------------------------------------------- vérifications */
let erreurs = 0, avertissements = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { erreurs++; console.error('  ✗ ' + msg); }
};
const attendu = (fn, msg) => {
  try { const v = fn(); console.log('  ✓ ' + msg + (v === undefined ? '' : ' — ' + v)); return v; }
  catch (e) { erreurs++; console.error('  ✗ ' + msg + ' : ' + e.message + '\n' + (e.stack || '').split('\n')[1]); }
};

console.log('\n1. Catalogue');
const especes = A.liste();
ok(especes.length >= 15, 'au moins 15 essences (' + especes.length + ')');
for (const e of especes) {
  ok(!!e.nom && !!e.latin && !!e.famille && !!e.description && !!e.icone, e.nom + ' : fiche complète');
  ok(!!U.ICONES[e.icone], e.nom + ' : icône « ' + e.icone + ' » dessinée');
}

console.log('\n2. Construction de chaque essence (qualité 1)');
const stats = [];
for (const e of especes) {
  attendu(() => {
    const g = A.buildTree(e.id, { seed: 4321, qualite: 1, saison: 'ete' });
    let tris = 0, inst = 0, meshes = 0;
    g.traverse(o => {
      if (o.isMesh) {
        meshes++;
        if (o.isInstancedMesh) { inst += o.count; if (o.geometry.index) tris += o.geometry.index.count / 3 * o.count; }
        else if (o.geometry.index) tris += o.geometry.index.count / 3;
        else if (o.geometry.attributes.position) tris += o.geometry.attributes.position.count / 3;
      }
    });
    if (!meshes) throw new Error('aucun maillage');
    if (!isFinite(tris) || tris <= 0) throw new Error('géométrie vide');
    stats.push({ id: e.id, meshes, inst, tris: Math.round(tris) });
    return meshes + ' maillages, ' + inst + ' instances, ' + Math.round(tris) + ' facettes';
  }, e.nom);
}
const total = stats.reduce((s, x) => s + x.tris, 0);
console.log('  → total ' + (total / 1000).toFixed(0) + ' k facettes pour un exemplaire de chaque');
ok(stats.every(s => s.tris < 700000), 'aucune essence ne dépasse 700 k facettes');

console.log('\n3. Saisons');
for (const s of ['printemps', 'ete', 'automne', 'hiver']) {
  attendu(() => {
    const g = A.buildTree('cerisier', { seed: 7, qualite: .7, saison: s });
    let n = 0; g.traverse(o => { if (o.isMesh) n++; });
    return n + ' maillages';
  }, 'cerisier en ' + s);
}

console.log('\n4. Moteur de scène (faux WebGL)');
const moteur = attendu(() => U.creerMoteur({
  ambiance: 'jour', saison: 'ete', qualite: .6, cible: [0, 4, 0], distance: 40,
  conteneur: documentStub.body, tailleSol: 200, touffes: 40, cailloux: 20
}), 'scène créée');

console.log('\n5. Jardin (plan complet)');
const t0 = Date.now();
const jardin = attendu(() => J.construire(moteur, {
  qualite: .5, detail: .6, budget: 100000,
  onFini: () => { }
}), 'jardin lancé');
let iterations = 0;
// on déroule les étapes de plantation planifiées avec requestAnimationFrame
while (frames.length && iterations < 4000) {
  const lot = frames.splice(0, frames.length);
  for (const f of lot) { iterations++; try { f(0); } catch (e) { erreurs++; console.error('  ✗ erreur de plantation :', e.message, '\n', (e.stack || '').split('\n')[1]); } }
}
ok(iterations > 0, 'plantation incrémentale : ' + iterations + ' étapes');
if (!moteur) { console.error('✗ moteur absent : arrêt'); process.exit(1); }
ok(moteur.arbres.children.length === jardin.plan.length,
  jardin.plan.length + ' arbres plantés (obtenu ' + moteur.arbres.children.length + ')');
// on exporte le plan effectif pour le dessin du plan (test/plan.py)
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'plan.json'), JSON.stringify(
  jardin.plan.map(p => ({ id: p.id, x: p.x, z: p.z, e: p.e, vedette: !!p.vedette, lisiere: !!p.lisiere }))));
let trisJardin = 0, instJardin = 0;
moteur.arbres.traverse(o => {
  if (o.isMesh && o.isInstancedMesh) {
    instJardin += o.count;
    if (o.geometry.index) trisJardin += o.geometry.index.count / 3 * o.count;
  } else if (o.isMesh && o.geometry.index) trisJardin += o.geometry.index.count / 3;
});
console.log('  → jardin : ' + (trisJardin / 1e6).toFixed(2) + ' M facettes, ' + (instJardin / 1000).toFixed(1) + ' k feuilles, construit en ' + (Date.now() - t0) + ' ms');
ok(trisJardin < 6e6, 'budget de facettes raisonnable pour un navigateur (' + (trisJardin/1e6).toFixed(2) + ' M)');
ok(Date.now() - t0 < 9000, 'jardin construit en moins de 9 s (' + (Date.now() - t0) + ' ms)');

console.log('\n6. Décor');
let nbDecor = 0;
jardin.decor.traverse(o => { if (o.isMesh) nbDecor++; });
ok(nbDecor > 8, 'éléments de décor : ' + nbDecor + ' maillages (allée, eau, rochers, haies, massifs)');

console.log('\n6bis. Reconstruction (changement de saison / de détail)');
const avant = moteur.arbres.children.length;
// on simule ce que fait la page : retirer tous les arbres puis replanter
for (const g of moteur.arbres.children.slice()) moteur.arbres.remove(g);
frames.length = 0;
const jardin2 = J.construire(moteur, { qualite: .4, budget: 100000 });
let k2 = 0;
while (frames.length && k2 < 4000) { const lot = frames.splice(0, frames.length); k2++; for (const f of lot) f(0); }
ok(moteur.arbres.children.length === jardin2.plan.length,
  'replantation complète (' + moteur.arbres.children.length + ' sujets)');
ok(moteur.scene.children.filter(o => o === jardin2.decor).length === 1, 'décor unique');

console.log('\n7. Ambiances et interactions');
for (const a of Object.keys(U.AMBIANCES)) {
  attendu(() => moteur.setAmbiance(a), 'ambiance ' + a);
}
attendu(() => { for (let k = 0; k < 3 && frames.length; k++) { const lot = frames.splice(0, frames.length); for (const f of lot) f(0); } }, 'boucle de rendu (quelques images)');
ok(rendus > 0, 'rendu appelé ' + rendus + ' fois (faux moteur)');
attendu(() => J.arbreSousPointeur(moteur, 600, 400), 'sélection au pointeur');

console.log('\n8. Cohérence des données du jardin');
const inconnues = J.PLAN.filter(p => !A.ESPECES[p.id]);
ok(inconnues.length === 0, 'toutes les essences plantées existent');
const essencesJardin = new Set(jardin.plan.map(p => p.id));
ok(essencesJardin.size >= 12, essencesJardin.size + ' essences différentes au jardin');
const trop = jardin.plan.filter(p => Math.hypot(p.x, p.z) > 70);
ok(trop.length === 0, 'aucune plantation hors du terrain');

console.log('\n' + (erreurs ? '✗ ' + erreurs + ' problème(s)' : '✓ tous les tests passent'));
if (erreurs) process.exit(1);
