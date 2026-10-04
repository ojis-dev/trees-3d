/* Test des pages : exécute le script embarqué de chaque page HTML dans un
   faux DOM (avec faux WebGL) pour détecter les erreurs de runtime.
   Usage : node test/pages.js */
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
  const c = { width: 300, height: 150, style: { setProperty() { } }, nodeType: 1, clientWidth: 1000, clientHeight: 700 };
  c.getContext = () => fakeCtx(c);
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 });
  c.addEventListener = () => { }; c.removeEventListener = () => { };
  c.setAttribute = () => { }; c.setPointerCapture = () => { }; c.appendChild = () => { };
  c.parentElement = { clientWidth: 1000, clientHeight: 700 };
  return c;
}
function fakeElement(tag) {
  const classes = new Set();
  const el = {
    tagName: (tag || 'div').toUpperCase(), style: { setProperty() { } }, dataset: {}, children: [],
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c),
      toggle: (c, v) => { v === false ? classes.delete(c) : classes.add(c); },
      contains: c => classes.has(c)
    },
    hidden: false, textContent: '', innerHTML: '', clientWidth: 1000, clientHeight: 700,
    value: '', checked: false, disabled: false,
    appendChild(c) { this.children.push(c); return c; }, replaceWith() { }, remove() { },
    setAttribute() { }, getAttribute: () => null, addEventListener() { }, removeEventListener() { },
    querySelectorAll: () => [], querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    focus() { }, blur() { }, click() { }, onclick: null
  };
  return el;
}
let frames = [];
function creerSandbox(url) {
  const elements = new Map();
  const documentStub = {
    createElement: tag => (tag === 'canvas' ? fakeCanvas() : fakeElement(tag)),
    createElementNS: () => fakeCanvas(),
    body: fakeElement('body'),
    documentElement: fakeElement('html'),
    head: fakeElement('head'),
    addEventListener() { }, removeEventListener() { },
    getElementById: id => {
      if (!elements.has(id)) elements.set(id, fakeElement('div'));
      return elements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const sb = {
    console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN, isFinite,
    parseFloat, parseInt, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array, Map, Set, Promise, WeakMap, Symbol, URLSearchParams, RegExp,
    setTimeout: (cb) => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    document: documentStub, navigator: { userAgent: 'node' }, devicePixelRatio: 1,
    performance: { now: () => Date.now() },
    requestAnimationFrame: cb => { frames.push(cb); return frames.length; },
    cancelAnimationFrame() { }, matchMedia: () => ({ matches: false, addEventListener() { } }),
    addEventListener() { }, removeEventListener() { },
    innerWidth: 1280, innerHeight: 800,
    location: { search: url.split('?')[1] ? '?' + url.split('?')[1] : '', href: 'http://localhost/' + url, replace() { }, assign() { } },
    history: { replaceState() { } },
    __document: documentStub
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.createContext(sb);
  const THREE = require(path.join(ROOT, 'three.min.js'));
  class FauxRenderer {
    constructor() {
      this.domElement = fakeCanvas();
      this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
      this.capabilities = { getMaxAnisotropy: () => 8, isWebGL2: true };
      this.outputEncoding = 0; this.toneMapping = 0; this.toneMappingExposure = 1; this._pr = 1;
    }
    setPixelRatio(v) { this._pr = v; }
    getPixelRatio() { return this._pr; }
    setSize() { }
    render() { }
    dispose() { }
  }
  THREE.WebGLRenderer = FauxRenderer;
  sb.THREE = THREE;
  return sb;
}

/* --------------------------------------------------------------- tests --- */
const pages = ['index.html', 'espece.html?espece=erable', 'espece.html?espece=saule', 'galerie.html', 'arbre.html'];
let erreurs = 0;
const aFaire = [];
const aRetirer = [];

for (const spec of pages) {
  const [fichier, requete] = spec.split('?');
  const html = fs.readFileSync(path.join(ROOT, fichier), 'utf8');
  // scripts externes d'abord
  const externes = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])
    .filter(f => f !== 'three.min.js');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const sb = creerSandbox(spec);
  let echec = null;
  try {
    for (const f of externes) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
    for (let i = 0; i < inline.length; i++) {
      vm.runInContext(inline[i], sb, { filename: fichier + ' (script inline ' + (i + 1) + ')' });
    }
    // on déroule les images planifiées (plantation, boucle de rendu)
    for (let k = 0; k < 60 && frames.length; k++) {
      const lot = frames.splice(0, frames.length);
      for (const cb of lot) cb(k * 16);
    }
  } catch (e) {
    echec = e;
  }
  if (echec) {
    erreurs++;
    console.error('✗ ' + spec + ' : ' + String(echec.message).slice(0, 200));
    const lignes = (echec.stack || '').split('\n').slice(1, 4)
      .map(l => l.length > 160 ? l.slice(0, 160) + '…' : l).join('\n   ');
    console.error('   ' + lignes);
  } else {
    console.log('✓ ' + spec + ' — ' + externes.length + ' module(s), ' + inline.length + ' script(s) inline');
  }
}

console.log('\n' + (erreurs ? '✗ ' + erreurs + ' page(s) en erreur' : '✓ toutes les pages s’exécutent sans erreur'));
if (erreurs) process.exit(1);
