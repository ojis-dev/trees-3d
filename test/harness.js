/* Banc d'essai hors navigateur : charge three.js + arbres-core.js avec un faux
   DOM, construit les arbres, puis écrit la géométrie dans un fichier binaire
   que test/render.py transforme en images de contrôle. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------- faux DOM ----------
function fakeGradient() { return { addColorStop() { } }; }
function fakeCtx() {
  const ctx = {
    canvas: null, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineJoin: 'round', lineCap: 'round', globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '', textAlign: 'left', shadowBlur: 0, shadowColor: '#000',
    createLinearGradient: fakeGradient, createRadialGradient: fakeGradient,
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() { }, drawImage() { }, measureText: () => ({ width: 10 }),
  };
  const noop = ['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke',
    'save', 'restore', 'translate', 'rotate', 'scale', 'clip', 'setTransform', 'transform',
    'fillText', 'strokeText', 'setLineDash'];
  for (const m of noop) ctx[m] = () => { };
  return ctx;
}
function fakeCanvas() {
  const c = { width: 1, height: 1, style: {}, nodeType: 1 };
  const ctx = fakeCtx(); ctx.canvas = c;
  c.getContext = () => ctx;
  c.toDataURL = () => 'data:,';
  c.addEventListener = () => { };
  c.removeEventListener = () => { };
  c.setAttribute = () => { };
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  return c;
}
const documentStub = {
  createElement: tag => (tag === 'canvas' ? fakeCanvas() : { style: {}, setAttribute() { }, appendChild() { }, addEventListener() { } }),
  createElementNS: () => fakeCanvas(),
  body: { appendChild() { }, style: {} },
  documentElement: { style: { setProperty() { } } },
  addEventListener() { }, removeEventListener() { },
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
};

const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN, parseFloat, parseInt,
  Uint8Array, Uint16Array, Uint32Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray, Map, Set, Promise,
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: documentStub,
  window: {}, self: {}, navigator: { userAgent: 'node' }, devicePixelRatio: 1,
  performance: { now: () => Date.now() },
  requestAnimationFrame: cb => setTimeout(() => cb(0), 0),
  cancelAnimationFrame: () => { }, matchMedia: () => ({ matches: false, addEventListener() { } }),
  addEventListener() { }, removeEventListener() { },
  innerWidth: 1280, innerHeight: 720,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const THREE = require(path.join(ROOT, 'three.min.js'));
sandbox.THREE = THREE;

vm.runInContext(fs.readFileSync(path.join(ROOT, 'arbres-core.js'), 'utf8'), sandbox, { filename: 'arbres-core.js' });
const A = sandbox.window.ARBRES;
if (!A) { console.error('ARBRES non exporté'); process.exit(1); }

// ---------- géométrie ----------
const v = new THREE.Vector3();
function bakeGroup(group, out, typeOf, tintOf) {
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) {
      const geo = o.geometry;
      const pos = geo.attributes.position, col = geo.attributes.color, uv = geo.attributes.uv;
      const idx = geo.index ? geo.index.array : null;
      const nTri = (idx ? idx.length : pos.count) / 3;
      const im = new THREE.Matrix4(), mat = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, im);
        mat.multiplyMatrices(o.matrixWorld, im);
        let ic = null;
        if (o.instanceColor) ic = o.instanceColor.array;
        for (let t = 0; t < nTri; t++) {
          for (let k = 0; k < 3; k++) {
            const vi = idx ? idx[t * 3 + k] : t * 3 + k;
            v.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(mat);
            out.pos.push(v.x, v.y, v.z);
            let r = 0.6, g = 0.6, b = 0.6;
            if (ic) { r = ic[vi * 3]; g = ic[vi * 3 + 1]; b = ic[vi * 3 + 2]; }
            else if (col) { r = col.getX(vi); g = col.getY(vi); b = col.getZ(vi); }
            // teinte du matériau
            if (o.material && o.material.color) {
              r *= o.material.color.r; g *= o.material.color.g; b *= o.material.color.b;
            }
            const tf = tintOf ? tintOf(o) : null;
            if (tf) { r *= tf[0]; g *= tf[1]; b *= tf[2]; }
            out.col.push(r, g, b);
            out.uv.push(uv ? uv.getX(vi) : 0, uv ? uv.getY(vi) : 0);
          }
          out.type.push(typeOf ? typeOf(o) : 0);
        }
      }
    } else {
      const geo = o.geometry;
      const pos = geo.attributes.position, col = geo.attributes.color, uv = geo.attributes.uv;
      const idx = geo.index ? geo.index.array : null;
      const nTri = (idx ? idx.length : pos.count) / 3;
      for (let t = 0; t < nTri; t++) {
        for (let k = 0; k < 3; k++) {
          const vi = idx ? idx[t * 3 + k] : t * 3 + k;
          v.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(o.matrixWorld);
          out.pos.push(v.x, v.y, v.z);
          let r = .5, g = .5, b = .5;
          if (col) { r = col.getX(vi); g = col.getY(vi); b = col.getZ(vi); }
          if (o.material && o.material.color) { r *= o.material.color.r; g *= o.material.color.g; b *= o.material.color.b; }
          const tf = tintOf ? tintOf(o) : null;
          if (tf) { r *= tf[0]; g *= tf[1]; b *= tf[2]; }
          out.col.push(r, g, b);
          out.uv.push(uv ? uv.getX(vi) : 0, uv ? uv.getY(vi) : 0);
        }
        out.type.push(typeOf ? typeOf(o) : 0);
      }
    }
  });
}

function dumpGroup(name, group) {
  const meshes = group.userData.meshes || {};
  const out = { pos: [], col: [], type: [], uv: [] };
  const typeOf = o => {
    if (meshes.ecorce === o) return 0;
    if ((meshes.feuilles || []).indexOf(o) >= 0) return 1;
    if ((meshes.fleurs || []).indexOf(o) >= 0) return 2;
    if ((meshes.fruits || []).indexOf(o) >= 0) return 3;
    if ((meshes.aiguilles || []).indexOf(o) >= 0) return 4;
    return 0;
  };
  const esp = group.userData.espece || {};
  const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const tintEcorce = esp.ecorce ? hex2rgb(esp.ecorce.base) : null;
  const tintFeuille = esp.feuille ? hex2rgb(esp.feuille.couleur) : null;
  const tintFleur = esp.fleur ? hex2rgb((esp.fleur.couleurs ? esp.fleur.couleurs[0] : esp.fleur.couleur)) : null;
  const tintOf = o => {
    const t = typeOf(o);
    if (t === 0) return tintEcorce;
    if (t === 1) return tintFeuille;
    if (t === 2) return tintFleur;
    return null;
  };
  bakeGroup(group, out, typeOf, tintOf);
  const nTri = out.type.length;
  const uv = out.uv;
  const buf = Buffer.alloc(8 + nTri * (9 + 9 + 1) * 4 + uv.length * 4);
  let off = 0;
  buf.writeUInt32LE(0x54415242, off); off += 4;
  buf.writeUInt32LE(nTri, off); off += 4;
  const pos = out.pos, col = out.col, typ = out.type;
  for (let i = 0; i < nTri; i++) for (let k = 0; k < 3; k++) { buf.writeFloatLE(pos[i * 9 + k * 3], off); off += 4; }
  for (let i = 0; i < nTri; i++) for (let k = 0; k < 3; k++) { buf.writeFloatLE(pos[i * 9 + k * 3 + 1], off); off += 4; }
  for (let i = 0; i < nTri; i++) for (let k = 0; k < 3; k++) { buf.writeFloatLE(pos[i * 9 + k * 3 + 2], off); off += 4; }
  for (let i = 0; i < nTri; i++) for (let k = 0; k < 9; k++) { buf.writeFloatLE(col[i * 9 + k], off); off += 4; }
  for (let i = 0; i < nTri; i++) { buf.writeUInt8(typ[i], off); off += 1; }
  for (let i = 0; i < uv.length; i++) { buf.writeFloatLE(uv[i], off); off += 4; }
  fs.writeFileSync(path.join(__dirname, 'out', name + '.bin'), buf);
  // configuration de l'espèce : formes de feuilles/aiguilles pour le test de rendu
  const espInfo = esp;
  fs.writeFileSync(path.join(__dirname, 'out', name + '.json'), JSON.stringify({
    forme: espInfo.forme, feuille: espInfo.feuille, aiguilles: espInfo.aiguilles,
    feuilleLargeur: espInfo.feuilleLargeur, feuilleAllongee: espInfo.feuilleAllongee,
    hauteur: espInfo.hauteur, largeur: espInfo.largeur
  }));
  return { tris: nTri, bytes: buf.length };
}

fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const args = process.argv.slice(2);
const ids = args.length ? args : ['chene', 'hetre', 'bouleau', 'tilleul', 'erable', 'cerisier', 'pommier', 'olivier', 'saule', 'cypres', 'epicea', 'pin', 'lilas', 'hortensia', 'fougere', 'stipa', 'buis'];
const rapport = [];
for (const id of ids) {
  try {
    const t0 = Date.now();
    const g = A.buildTree(id, { seed: 12345, qualite: 1, saison: 'ete' });
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const info = dumpGroup(id, g);
    let feuilles = 0;
    g.traverse(o => { if (o.isInstancedMesh) feuilles += o.count; });
    rapport.push({ id, ms: Date.now() - t0, tris: info.tris, hauteur: +size.y.toFixed(2), largeur: +Math.max(size.x, size.z).toFixed(2), instances: feuilles, ko: Math.round(info.bytes / 1024) });
  } catch (e) {
    rapport.push({ id, erreur: e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n') });
  }
}
console.log(JSON.stringify(rapport, null, 1));
