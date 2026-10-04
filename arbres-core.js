/* =============================================================================
   arbres-core.js — Bibliothèque de végétation procédurale (Three.js r137)
   -----------------------------------------------------------------------------
   Tout est généré par le code : écorces, feuilles, aiguilles, fruits, fleurs.
   Aucune image externe, aucun réseau : le site fonctionne hors-ligne.

   Contenu :
     1.  Aléatoire reproductible (mulberry32)
     2.  Peinture procédurale des textures (canvas 2D)
     3.  Outils géométriques (tubes parallèles-transportés, fusion, AO)
     4.  Générateur d'arbre générique (feuillus, conifères, pleureurs…)
     5.  Catalogue d'espèces (formes, écorces, feuillages, fruits)
   ========================================================================== */
window.ARBRES = (function () {
  'use strict';

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0), DOWN = V(0, -1, 0);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  /* ===========================================================================
     1. ALÉATOIRE REPRODUCTIBLE
     ======================================================================== */
  function RNG(seed) {
    let s = seed >>> 0;
    const r = function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = a => a[Math.floor(r() * a.length) % a.length];
    r.chance = p => r() < p;
    r.sign = () => (r() < .5 ? -1 : 1);
    r.gauss = (m, sd) => {
      const u = 1 - r(), v = r();
      return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    r.dir = () => V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    r.hemi = () => V(r() * 2 - 1, r(), r() * 2 - 1).normalize();
    return r;
  }

  /* ===========================================================================
     2. TEXTURES PROCÉDURALES
     ======================================================================== */
  function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.lineJoin = g.lineCap = 'round';
    return { c, g, w, h };
  }

  function finish(canvas, repeatX, repeatY) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX || 1, repeatY || 1);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }
  function gray(canvas) { // même dessin, version non colorimétrique
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  const hexToRgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  const shade = (hex, f) => { // éclaircit (f>0) ou assombrit (f<0) une couleur hex
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round((n >> 16) * (1 + f)), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * (1 + f)), 0, 255);
    const b = clamp(Math.round((n & 255) * (1 + f)), 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  /* --- 2.1 Écorces ------------------------------------------------------- */
  // Chaque essence a sa signature : sillons profonds du chêne, plaques du pin,
  // lenticelles du bouleau, peau lisse du hêtre, écailles de l'épicéa…
  function barkTexture(cfg, rng) {
    const W = 512, H = 1024;
    const { c, g } = surface(W, H);
    const base = cfg.base, dark = cfg.dark, light = cfg.light;
    const P = cfg.pattern;
    const seedRng = rng;

    g.fillStyle = base; g.fillRect(0, 0, W, H);

    // taches de fond : casse la platitude avant tout autre dessin
    for (let i = 0; i < 420; i++) {
      g.fillStyle = hexToRgba(seedRng() < .5 ? dark : light, seedRng.range(.03, .11));
      g.beginPath();
      g.ellipse(seedRng() * W, seedRng() * H, seedRng.range(5, 46), seedRng.range(10, 120),
        seedRng() * .6 - .3, 0, TAU);
      g.fill();
    }

    // fonction utilitaire : trace un sillon vertical ondulant, répété en tuile
    const furrow = (x0, y0, y1, amp, freq, phase, width, color, alpha) => {
      g.strokeStyle = hexToRgba(color, alpha);
      g.lineWidth = width;
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        g.beginPath();
        for (let y = y0; y <= y1; y += 12) {
          const x = x0 + ox + amp * Math.sin(y * freq + phase) + (y - y0) * .03 * Math.sin(phase * 1.7);
          if (y === y0) g.moveTo(x, y + oy); else g.lineTo(x, y + oy);
        }
        g.stroke();
      }
    };
    const blob = (x, y, rx, ry, color, alpha) => {
      g.fillStyle = hexToRgba(color, alpha);
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    };

    if (P === 'sillons') {                      // chêne, saule, robinier
      for (let i = 0; i < 90; i++) {
        const x = seedRng() * W, y0 = seedRng() * H, len = seedRng.range(120, 560);
        const amp = seedRng.range(6, 22), freq = seedRng.range(.004, .013), ph = seedRng() * TAU;
        const w = seedRng.range(6, 20);
        furrow(x + w * .55, y0, y0 + len, amp, freq, ph, w * 1.5, light, cfg.relief || .3);
        furrow(x, y0, y0 + len, amp, freq, ph, w, dark, cfg.contrast || .8);
        furrow(x - w * .35, y0, y0 + len, amp, freq, ph, w * .3, '#000000', .25);
      }
      for (let i = 0; i < 900; i++) {           // fissures fines
        const x = seedRng() * W, y = seedRng() * H;
        g.strokeStyle = hexToRgba(dark, seedRng.range(.25, .55));
        g.lineWidth = seedRng.range(.8, 2.6);
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + seedRng.range(-8, 8), y + seedRng.range(12, 70)); g.stroke();
      }
    } else if (P === 'plaques') {               // pin, cèdre : écailles en puzzle
      for (let i = 0; i < 700; i++) {
        const x = seedRng() * W, y = seedRng() * H;
        const rx = seedRng.range(14, 40), ry = seedRng.range(10, 30);
        g.save(); g.translate(x, y); g.rotate(seedRng.range(-.5, .5));
        g.fillStyle = hexToRgba(dark, seedRng.range(.22, .5));
        g.beginPath(); g.moveTo(-rx, 0); g.quadraticCurveTo(-rx * .5, -ry, 0, -ry * .8);
        g.quadraticCurveTo(rx * .6, -ry, rx, 0); g.quadraticCurveTo(0, ry, -rx, 0); g.fill();
        g.strokeStyle = hexToRgba(light, seedRng.range(.2, .45)); g.lineWidth = seedRng.range(2, 5);
        g.beginPath(); g.moveTo(-rx * .9, -ry * .25); g.quadraticCurveTo(0, -ry * .9, rx * .85, -ry * .2); g.stroke();
        g.restore();
      }
    } else if (P === 'ecailles') {              // épicéa, sapin
      for (let i = 0; i < 1500; i++) {
        const x = seedRng() * W, y = seedRng() * H, r = seedRng.range(6, 16);
        g.fillStyle = hexToRgba(seedRng() < .5 ? dark : light, seedRng.range(.12, .38));
        g.beginPath(); g.ellipse(x, y, r, r * seedRng.range(.5, .8), seedRng.range(-.3, .3), 0, TAU); g.fill();
      }
      for (let i = 0; i < 220; i++) {
        const x = seedRng() * W, y = seedRng() * H;
        g.strokeStyle = hexToRgba(dark, seedRng.range(.2, .45)); g.lineWidth = seedRng.range(1.5, 3.5);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + seedRng.range(-10, 10), y + seedRng.range(14, 40)); g.stroke();
      }
    } else if (P === 'lenticelles') {           // bouleau, merisier
      for (let i = 0; i < 260; i++) {           // plaques sombres du bouleau
        const x = seedRng() * W, y = seedRng() * H;
        g.save(); g.translate(x, y); g.rotate(seedRng.range(-.15, .15));
        g.fillStyle = hexToRgba(dark, seedRng.range(.10, .38));
        g.beginPath(); g.ellipse(0, 0, seedRng.range(6, 26), seedRng.range(10, 60), 0, 0, TAU); g.fill();
        g.restore();
      }
      for (let i = 0; i < 900; i++) {           // lenticelles horizontales
        const x = seedRng() * W, y = seedRng() * H, w = seedRng.range(6, 40);
        g.strokeStyle = hexToRgba(dark, seedRng.range(.25, .7));
        g.lineWidth = seedRng.range(2, 6);
        g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y + seedRng.range(-2, 2), x + w / 2, y); g.stroke();
      }
      for (let i = 0; i < 500; i++) {
        g.fillStyle = hexToRgba(light, seedRng.range(.05, .18));
        g.beginPath(); g.ellipse(seedRng() * W, seedRng() * H, seedRng.range(8, 40), seedRng.range(6, 26), 0, 0, TAU); g.fill();
      }
    } else if (P === 'lisse') {                 // hêtre, charme, olivier jeune
      for (let i = 0; i < 700; i++) {
        g.fillStyle = hexToRgba(seedRng() < .5 ? dark : light, seedRng.range(.03, .12));
        g.beginPath();
        g.ellipse(seedRng() * W, seedRng() * H, seedRng.range(10, 70), seedRng.range(6, 30), seedRng() * TAU, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 120; i++) {           // fines rides horizontales
        const y = seedRng() * H, x = seedRng() * W, w = seedRng.range(40, 220);
        g.strokeStyle = hexToRgba(dark, seedRng.range(.06, .18)); g.lineWidth = seedRng.range(1.5, 4);
        g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + w * .3, y + seedRng.range(-8, 8), x + w * .6, y + seedRng.range(-8, 8), x + w, y);
        g.stroke();
      }
    } else if (P === 'torsade') {               // olivier, vigne : fibres torsadées
      for (let i = 0; i < 200; i++) {
        const x = seedRng() * W, y0 = seedRng() * H, len = seedRng.range(200, 800);
        const amp = seedRng.range(10, 30), freq = seedRng.range(.008, .02), ph = seedRng() * TAU;
        furrow(x, y0, y0 + len, amp, freq, ph, seedRng.range(5, 14),
          seedRng() < .5 ? dark : light, seedRng.range(.18, .45));
      }
    }

    // mousse, lichen, salissures : la patine du vivant
    if (cfg.moss) {
      for (let i = 0; i < 260; i++) {
        const y = Math.pow(seedRng(), 1.7) * H;         // surtout vers le bas
        g.fillStyle = 'rgba(' + (78 + seedRng() * 40 | 0) + ',' + (104 + seedRng() * 55 | 0) + ',' +
          (44 + seedRng() * 30 | 0) + ',' + (seedRng.range(.05, .22) * cfg.moss / .2) + ')';
        g.beginPath(); g.arc(seedRng() * W, y, seedRng.range(4, 26), 0, TAU); g.fill();
      }
    }
    if (cfg.lichen) {
      for (let i = 0; i < 160; i++) {
        g.fillStyle = 'rgba(196,204,178,' + seedRng.range(.05, .17) + ')';
        g.beginPath();
        g.ellipse(seedRng() * W, seedRng() * H, seedRng.range(4, 18), seedRng.range(3, 12), seedRng() * TAU, 0, TAU);
        g.fill();
      }
    }
    return c;
  }

  /* --- 2.2 Feuilles ------------------------------------------------------ */
  // Dessin d'une feuille : limbe, nervures, pétiole, brillances, morsures.
  function leafCanvas(cfg, rng, W, H, variant) {
    W = W || 320; H = H || 640;
    const { c, g } = surface(W, H);
    const cx = W / 2;
    const yBase = H * .955;          // attache du pétiole
    const yTip = H * .045;           // pointe
    const P = t => yBase - (yBase - yTip) * t;
    const form = cfg.forme;
    const serr = cfg.serration === undefined ? .0 : cfg.serration;
    const rng2 = rng;
    const vjit = variant === undefined ? 0 : (rng2() - .5) * .07;

    // demi-largeur normalisée en fonction de t (0 = pétiole, 1 = pointe)
    let half;
    if (form === 'ovale') {
      const p = cfg.profil || .68;
      half = t => Math.pow(Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), p)), .82);
    } else if (form === 'cordee') {         // tilleul, bouleau : cœur à la base
      half = t => {
        const u = clamp(t, 0, 1);
        return Math.pow(Math.sin(Math.PI * Math.pow(u, .55)), .85) * (1 - .28 * Math.exp(-u * 9));
      };
    } else if (form === 'lanceolee') {      // saule, olivier, lilas
      half = t => {
        const u = clamp(t, 0, 1);
        return Math.pow(Math.sin(Math.PI * Math.pow(u, 1.05)), .62) * (u < .06 ? .55 + u * 7 : 1);
      };
    } else if (form === 'lobee') {          // chêne : lobes arrondis
      const lobes = cfg.lobes || 5;
      half = t => {
        const u = clamp(t, 0, 1);
        const env = Math.pow(Math.sin(Math.PI * Math.pow(u, .62)), .5);
        let s = 0;
        for (let i = 0; i < lobes; i++) {
          const c0 = (i + .62) / (lobes + .35);
          s = Math.max(s, Math.exp(-Math.pow((u - c0) / (.30 / lobes + .06), 2)));
        }
        return env * (.52 + .62 * s) * (1 - .35 * Math.pow(u, 3));
      };
    } else if (form === 'palmee') {         // érable : 5 lobes palmés
      half = t => {
        const u = clamp(t, 0, 1);
        if (u < .12) return .30 * Math.sin(Math.PI * u / .12 * .5 + .35);
        return Math.pow(Math.sin(Math.PI * Math.pow(u, .95)), .45) * (1 - .1 * Math.sin(u * 12));
      };
    } else if (form === 'aiguille') {       // lame de graminée
      half = t => {
        const u = clamp(t, 0, 1);
        return .055 * Math.pow(1 - u * .75, .5) * (u < .05 ? .6 + u * 8 : 1);
      };
    } else half = t => Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), .8);

    const hw = t => W * .47 * half(t) * (1 + vjit * Math.sin(t * 3.1)) * (1 + serr * .06 * Math.sin(t * 26));

    const outline = () => {
      g.beginPath();
      g.moveTo(cx, P(0));
      for (let t = 0; t <= 1.0001; t += .006) g.lineTo(cx + hw(t), P(t));
      for (let t = 1; t >= -.0001; t -= .006) g.lineTo(cx - hw(t), P(t));
      g.closePath();
    };

    // --- remplissage : dégradé + taches
    outline();
    const grd = g.createLinearGradient(cx - W * .5, 0, cx + W * .5, 0);
    grd.addColorStop(0, shade(cfg.couleur, -.20));
    grd.addColorStop(.30, shade(cfg.couleur, .12));
    grd.addColorStop(.55, shade(cfg.couleur, .20));
    grd.addColorStop(1, shade(cfg.couleur, -.16));
    g.fillStyle = grd; g.fill();

    g.save(); outline(); g.clip();

    // dégradé vertical : plus sombre vers le pétiole (feuille d'ombre)
    const gv = g.createLinearGradient(0, yBase, 0, yTip);
    gv.addColorStop(0, hexToRgba(cfg.sombre || shade(cfg.couleur, -.5), .55));
    gv.addColorStop(.45, hexToRgba(cfg.couleur, .0));
    gv.addColorStop(1, hexToRgba(cfg.clair || shade(cfg.couleur, .35), .30));
    g.fillStyle = gv; g.fillRect(0, 0, W, H);

    // bord : liseré plus clair puis assombrissement du contour
    g.strokeStyle = hexToRgba(cfg.clair || shade(cfg.couleur, .3), .55);
    g.lineWidth = W * .09; outline(); g.stroke();
    g.strokeStyle = hexToRgba(cfg.sombre || shade(cfg.couleur, -.55), .75);
    g.lineWidth = W * .035; outline(); g.stroke();

    // mouchetures / marbrures naturelles
    for (let i = 0; i < 150; i++) {
      g.fillStyle = hexToRgba(rng2() < .5 ? (cfg.sombre || shade(cfg.couleur, -.4)) : (cfg.clair || shade(cfg.couleur, .3)),
        rng2.range(.03, .10));
      g.beginPath(); g.arc(rng2() * W, rng2() * H, rng2.range(4, 22), 0, TAU); g.fill();
    }
    if (cfg.duvet) {   // olivier, saule : pilosité argentée
      for (let i = 0; i < 900; i++) {
        g.strokeStyle = 'rgba(238,242,228,' + rng2.range(.05, .16) + ')';
        g.lineWidth = 1.4;
        const x = rng2() * W, y = rng2() * H, a = rng2() * TAU, l = rng2.range(4, 12);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    }
    if (cfg.marbrure) { // variétés panachées
      for (let i = 0; i < 26; i++) {
        g.fillStyle = hexToRgba(cfg.marbrure, rng2.range(.10, .30));
        g.beginPath();
        g.ellipse(rng2() * W, rng2() * H, rng2.range(14, 50), rng2.range(10, 40), rng2() * TAU, 0, TAU); g.fill();
      }
    }

    // nervure médiane + nervures latérales, avec ombre puis lumière
    const veinN = cfg.nervures === undefined ? 7 : cfg.nervures;
    for (let i = 0; i < veinN; i++) {
      const t = .08 + i * (.86 / veinN), te = Math.min(.985, t + .17 + .05 * rng2());
      const w = hw(te) * .94 * (.82 + .2 * rng2()), wid = (veinN - i) / veinN;
      for (const s of [-1, 1]) {
        for (const [col, lw, off] of [[cfg.sombre || shade(cfg.couleur, -.5), 7 * wid + 5, 2.5],
        [cfg.clair || shade(cfg.couleur, .45), 6 * wid, 0]]) {
          g.strokeStyle = hexToRgba(col, col === cfg.clair ? .5 : .42);
          g.lineWidth = Math.max(1.2, lw);
          g.beginPath(); g.moveTo(cx, P(t) + off);
          g.quadraticCurveTo(cx + s * w * .5, P(t + .04) + off, cx + s * w, P(te) + off);
          g.stroke();
        }
      }
    }
    // nervation fine
    g.lineWidth = 1.4;
    for (let i = 0; i < 1000; i++) {
      const x = rng2() * W, y = rng2() * H, a = rng2() * TAU, l = rng2.range(8, 26);
      g.strokeStyle = 'rgba(255,255,240,' + rng2.range(.05, .15) + ')';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // nervure centrale
    for (const [col, lw] of [[cfg.sombre || shade(cfg.couleur, -.6), W * .055],
    [cfg.clair || shade(cfg.couleur, .5), W * .028]]) {
      g.strokeStyle = hexToRgba(col, .65); g.lineWidth = lw;
      g.beginPath(); g.moveTo(cx, yBase + H * .04); g.lineTo(cx, yTip + H * .02); g.stroke();
    }

    // morsure d'insecte : trous et entailles — la perfection n'existe pas
    if (cfg.morsures !== false) {
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 5; i++) {
        const y = yBase - (yBase - yTip) * rng2.range(.15, .8);
        const x = cx + (rng2() < .5 ? -1 : 1) * hw(.5) * rng2.range(.4, .95);
        g.beginPath(); g.ellipse(x, y, rng2.range(3, 9), rng2.range(4, 12), rng2() * TAU, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    // reflet cireux (cerisier, houx, érable du Japon)
    if (cfg.brillance) {
      g.fillStyle = 'rgba(255,255,255,' + (cfg.brillance * .22) + ')';
      g.beginPath();
      g.ellipse(cx - W * .1, P(.35), W * .16, H * .09, -.3, 0, TAU); g.fill();
    }
    g.restore();

    // pétiole + saignée
    g.strokeStyle = cfg.petiole || shade(cfg.couleur, -.45); g.lineWidth = W * .028;
    g.beginPath(); g.moveTo(cx, yBase + H * .02); g.lineTo(cx, H * .997); g.stroke();
    return c;
  }

  /* --- 2.3 Rameaux d'aiguilles (conifères) ------------------------------- */
  // Un rameau complet : tige + aiguilles rayonnantes. Utilisé sur des plans
  // croisés, cela remplace avantageusement des milliers d'aiguilles isolées.
  function sprayCanvas(cfg, rng, W, H) {
    W = W || 512; H = H || 256;
    const { c, g } = surface(W, H);
    const x0 = W * .02, y0 = H * .5, x1 = W * .98;           // tige horizontale
    const coul = cfg.couleur, coul2 = cfg.sombre || shade(coul, -.35), coul3 = cfg.clair || shade(coul, .3);
    const mode = cfg.mode || 'pousse';

    // tige centrale
    g.strokeStyle = shade(coul, -.45); g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(x0, y0);
    g.quadraticCurveTo(W * .5, y0 + (cfg.courbe || 0) * H * .18, x1, y0 + (cfg.courbe || 0) * H * .34);
    g.stroke();

    const n = cfg.densite || 190;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rng(), .8);                          // plus dense vers la base
      const px = lerp(x0, x1, 1 - t);
      const py = y0 + (cfg.courbe || 0) * H * .34 * (1 - t) * (1 - t);
      const L = (cfg.longueur || .42) * H * (.45 + .75 * (1 - t)) * rng.range(.7, 1.15);
      let a;
      if (mode === 'pousse') a = (rng() < .5 ? -1 : 1) * (Math.PI * .5) + rng.range(-.75, .75) - .18;
      else if (mode === 'peigne') a = (rng() < .5 ? -1 : 1) * rng.range(.55, 1.25);
      else a = rng() * TAU;                                   // 'etoile' : cypres, genevrier
      const ex = px + Math.cos(a) * L, ey = py + Math.sin(a) * L;
      const grd = g.createLinearGradient(px, py, ex, ey);
      grd.addColorStop(0, hexToRgba(coul2, .95));
      grd.addColorStop(.55, hexToRgba(coul, .95));
      grd.addColorStop(1, hexToRgba(coul3, .85));
      g.strokeStyle = grd;
      g.lineWidth = cfg.epaisseur || 2.1;
      g.beginPath(); g.moveTo(px, py);
      g.quadraticCurveTo((px + ex) / 2 + rng.range(-6, 6), (py + ey) / 2 + rng.range(-6, 6), ex, ey);
      g.stroke();
      if (mode === 'etoile') {                                // petites étoiles d'aiguilles
        for (let k = 0; k < 3; k++) {
          const a2 = a + rng.range(-.9, .9), L2 = L * rng.range(.5, .85);
          g.strokeStyle = hexToRgba(rng() < .5 ? coul2 : coul, .7);
          g.lineWidth = (cfg.epaisseur || 2.1) * .75;
          g.beginPath(); g.moveTo(px, py);
          g.lineTo(px + Math.cos(a2) * L2, py + Math.sin(a2) * L2); g.stroke();
        }
      }
      if (rng() < .25) {                                      // reflet
        g.strokeStyle = 'rgba(255,255,240,.18)';
        g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(px, py - 1); g.lineTo(ex, ey - 1); g.stroke();
      }
    }
    return c;
  }

  /* --- 2.4 Gazon, terre, pierre, bois, fleurs ---------------------------- */
  function groundCanvas(cfg, rng) {
    const W = 1024, H = 1024;
    const { c, g } = surface(W, H);
    g.fillStyle = cfg.base || '#6f8b46'; g.fillRect(0, 0, W, H);
    // taches de tonte et de sécheresse
    for (let i = 0; i < 340; i++) {
      g.fillStyle = hexToRgba(rng() < .5 ? (cfg.sombre || '#4e6631') : (cfg.clair || '#96ad5e'), rng.range(.05, .22));
      g.beginPath();
      g.ellipse(rng() * W, rng() * H, rng.range(20, 190), rng.range(16, 130), rng() * TAU, 0, TAU); g.fill();
    }
    // brins
    for (let i = 0; i < 22000; i++) {
      const x = rng() * W, y = rng() * H, l = rng.range(3, 11), a = rng.range(-.9, .9);
      const v = rng();
      g.strokeStyle = v < .45 ? hexToRgba(cfg.sombre || '#40572a', rng.range(.15, .5))
        : v < .85 ? hexToRgba(cfg.base, rng.range(.2, .55))
          : hexToRgba(cfg.clair || '#a9bf6b', rng.range(.15, .45));
      g.lineWidth = rng.range(.7, 1.9);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
    }
    // pâquerettes semées
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(250,250,238,' + rng.range(.35, .8) + ')';
      const x = rng() * W, y = rng() * H, r = rng.range(1.6, 3.4);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return c;
  }

  function soilCanvas(rng) {
    const W = 512, H = 512;
    const { c, g } = surface(W, H);
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = hexToRgba(rng() < .5 ? '#33261c' : '#6b5540', rng.range(.05, .3));
      g.beginPath(); g.ellipse(rng() * W, rng() * H, rng.range(4, 34), rng.range(3, 22), rng() * TAU, 0, TAU); g.fill();
    }
    for (let i = 0; i < 2600; i++) {   // graviers et miettes
      g.fillStyle = hexToRgba(rng() < .5 ? '#8b7355' : '#241a12', rng.range(.10, .45));
      g.beginPath(); g.arc(rng() * W, rng() * H, rng.range(.6, 2.6), 0, TAU); g.fill();
    }
    return c;
  }

  function stoneCanvas(cfg, rng) {
    const W = 512, H = 512;
    const { c, g } = surface(W, H);
    g.fillStyle = cfg.base || '#8d8a83'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = hexToRgba(rng() < .5 ? (cfg.sombre || '#5d5b55') : (cfg.clair || '#b9b6ad'), rng.range(.05, .25));
      g.beginPath(); g.ellipse(rng() * W, rng() * H, rng.range(8, 70), rng.range(6, 45), rng() * TAU, 0, TAU); g.fill();
    }
    for (let i = 0; i < 180; i++) {   // fissures
      const x = rng() * W, y = rng() * H;
      g.strokeStyle = hexToRgba(cfg.sombre || '#3c3a36', rng.range(.2, .5)); g.lineWidth = rng.range(1.5, 4);
      g.beginPath(); g.moveTo(x, y);
      let px = x, py = y;
      for (let k = 0; k < 5; k++) { px += rng.range(-40, 40); py += rng.range(-40, 40); g.lineTo(px, py); }
      g.stroke();
    }
    if (cfg.mousse) for (let i = 0; i < 220; i++) {
      g.fillStyle = 'rgba(' + (74 + rng() * 40 | 0) + ',' + (102 + rng() * 50 | 0) + ',' + (46 + rng() * 26 | 0) + ',' + rng.range(.05, .25) + ')';
      g.beginPath(); g.arc(rng() * W, rng() * H, rng.range(3, 22), 0, TAU); g.fill();
    }
    return c;
  }

  function woodCanvas(rng, base) {
    const W = 512, H = 512, { c, g } = surface(W, H);
    g.fillStyle = base || '#8a6a45'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {   // veinage
      const y = rng() * H;
      g.strokeStyle = hexToRgba(rng() < .5 ? '#5b4327' : '#b0895c', rng.range(.08, .3));
      g.lineWidth = rng.range(1, 4);
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * .02 + i) * rng.range(1, 4));
      g.stroke();
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = hexToRgba(rng() < .5 ? '#4a3520' : '#c19a6b', rng.range(.03, .12));
      g.beginPath(); g.ellipse(rng() * W, rng() * H, rng.range(2, 20), rng.range(1, 5), 0, 0, TAU); g.fill();
    }
    return c;
  }

  function flowerCanvas(cfg, rng) {
    const W = cfg.W || 256, H = cfg.H || 256;
    const { c, g } = surface(W, H);
    const cx = W / 2, cy = cfg.cy || H * .42;
    const n = cfg.petales || 6, R = Math.min(W, H) * (cfg.rayon || .34);
    const rng2 = rng;
    if (cfg.type === 'panicule') {           // lilas, seringat : grappe de fleurons
      for (let i = 0; i < 130; i++) {
        const t = Math.pow(rng2(), .7);
        const y = H * (.05 + .8 * t), x = cx + Math.sin(i * 2.399) * W * .16 * (1 - t) * rng2.range(.3, 1.2);
        const r = W * rng2.range(.022, .052);
        g.fillStyle = hexToRgba(rng2() < .4 ? (cfg.clair || shade(cfg.couleur, .3)) : cfg.couleur, rng2.range(.7, 1));
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.beginPath(); g.arc(x - r * .25, y - r * .25, r * .32, 0, TAU); g.fill();
      }
      g.strokeStyle = shade(cfg.couleur, -.5); g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, H * .1); g.stroke();
      return c;
    }
    if (cfg.type === 'ombelle') {            // ombelles : achillée, carotte sauvage
      for (let i = 0; i < 70; i++) {
        const a = rng2() * TAU, rr = Math.sqrt(rng2()) * R * 1.5;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .55;
        g.fillStyle = hexToRgba(rng2() < .5 ? cfg.couleur : (cfg.clair || shade(cfg.couleur, .35)), rng2.range(.75, 1));
        g.beginPath(); g.arc(x, y, W * rng2.range(.012, .026), 0, TAU); g.fill();
      }
      return c;
    }
    // fleur rayonnante : pâquerette, tulipe, rose simplifiée
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + (cfg.phase || 0);
      g.save(); g.translate(cx, cy); g.rotate(a);
      const grd = g.createLinearGradient(0, -R * .2, 0, -R);
      grd.addColorStop(0, shade(cfg.couleur, -.25));
      grd.addColorStop(.6, cfg.couleur);
      grd.addColorStop(1, cfg.clair || shade(cfg.couleur, .35));
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(0, -R * .62, R * .34, R * .68, 0, 0, TAU); g.fill();
      g.restore();
    }
    for (let i = 0; i < n; i++) {            // seconde couronne décalée
      const a = (i + .5) / n * TAU + (cfg.phase || 0);
      g.save(); g.translate(cx, cy); g.rotate(a); g.globalAlpha = .85;
      g.fillStyle = shade(cfg.couleur, -.1);
      g.beginPath(); g.ellipse(0, -R * .5, R * .26, R * .5, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
    if (cfg.coeur !== false) {
      const gg = g.createRadialGradient(cx - R * .1, cy - R * .1, R * .05, cx, cy, R * .42);
      gg.addColorStop(0, cfg.coeurClair || '#ffe9a8');
      gg.addColorStop(1, cfg.coeur || '#e0a92c');
      g.fillStyle = gg;
      g.beginPath(); g.arc(cx, cy, R * (.30 + (cfg.coeurR || 0)), 0, TAU); g.fill();
      for (let i = 0; i < 26; i++) {   // étamines
        g.strokeStyle = 'rgba(255,240,190,.7)'; g.lineWidth = 1.6;
        const a = rng2() * TAU, l = R * rng2.range(.2, .4);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke();
      }
    }
    return c;
  }

  /* --- 2.4bis Frondes de fougère et touffes de graminées ------------------ */
  function frondCanvas(cfg, rng, W, H) {
    W = W || 256; H = H || 1024;
    const { c, g } = surface(W, H);
    const cx = W * .5;
    const coul = cfg.couleur, coulC = cfg.clair || shade(coul, .3), coulS = cfg.sombre || shade(coul, -.4);
    // rachis : tige courbée
    const curveX = t => cx + (t - .5) * W * .10 * (1 - t) * 2;
    for (const [col, lw] of [[coulS, 9], [shade(coul, .1), 5]]) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      for (let i = 0; i <= 30; i++) { const t = i / 30; const x = curveX(t), y = H - t * H * .96; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // folioles : paires de part et d'autre, décroissantes vers la pointe
    const n = cfg.pinnae || 26;
    for (let i = 0; i < n; i++) {
      const t = .04 + .93 * (i / n);
      const x = curveX(t), y = H - t * H * .96;
      const leaf = (W * .46) * Math.pow(1 - t, .75) * (t < .1 ? t / .1 : 1) * rng.range(.8, 1.05);
      const hh = (H / n) * rng.range(.34, .5);
      for (const sgn of [-1, 1]) {
        g.save(); g.translate(x, y);
        g.rotate(sgn * (.30 + rng.range(-.12, .12)));
        const grd = g.createLinearGradient(0, 0, sgn * leaf, 0);
        grd.addColorStop(0, coulS);
        grd.addColorStop(.6, coul);
        grd.addColorStop(1, coulC);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(0, -hh * .5);
        g.quadraticCurveTo(sgn * leaf * .55, -hh * 1.15, sgn * leaf, -hh * .12);
        g.quadraticCurveTo(sgn * leaf * .5, hh * .8, 0, hh * .5);
        g.closePath(); g.fill();
        // nervure de la foliole
        g.strokeStyle = 'rgba(255,255,235,.35)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(sgn * leaf * .85, -hh * .1); g.stroke();
        g.restore();
      }
      if (rng() < .12) {   // échancrure naturelle
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(x + rng.range(-1, 1) * leaf, y, hh * .5, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    // taches de senescence
    for (let i = 0; i < 60; i++) {
      g.fillStyle = hexToRgba(rng() < .5 ? '#b9a05a' : coulS, rng.range(.05, .18));
      g.beginPath(); g.arc(rng() * W, rng() * H, rng.range(3, 14), 0, TAU); g.fill();
    }
    return c;
  }

  function tuftCanvas(cfg, rng, W, H) {
    W = W || 512; H = H || 512;
    const { c, g } = surface(W, H);
    const coul = cfg.couleur, coulC = cfg.clair || shade(coul, .35), coulS = cfg.sombre || shade(coul, -.35);
    const n = cfg.brins || 90;
    for (let i = 0; i < n; i++) {
      const t = rng();
      const x0 = W * (.5 + (rng() - .5) * .22);
      const y0 = H * .99;
      const len = H * (.45 + .55 * rng());
      const bend = (rng() - .5) * W * .9;
      const w = W * rng.range(.004, .012);
      const col = rng() < .35 ? coulS : rng() < .75 ? coul : coulC;
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + bend * .35, y0 - len * .6, x0 + bend, y0 - len);
      g.stroke();
      // pointe éclairée
      g.strokeStyle = 'rgba(255,250,225,' + rng.range(.06, .2) + ')';
      g.lineWidth = w * .5;
      g.beginPath(); g.moveTo(x0 + bend * .7, y0 - len * .72); g.lineTo(x0 + bend, y0 - len); g.stroke();
    }
    if (cfg.epi) for (let i = 0; i < 22; i++) {   // épillets dorés
      const x = W * (.5 + (rng() - .5) * .7), y = H * (.08 + rng() * .3);
      g.fillStyle = hexToRgba('#e8d9a8', rng.range(.5, .9));
      g.beginPath(); g.ellipse(x, y, W * .012, H * .045, (rng() - .5) * .6, 0, TAU); g.fill();
    }
    return c;
  }

  function cloudCanvas(rng) {
    const W = 256, H = 128, { c, g } = surface(W, H);
    for (let i = 0; i < 46; i++) {
      const x = W * (.15 + .7 * rng()), y = H * (.35 + .4 * rng());
      const r = Math.min(W, H) * rng.range(.10, .28);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,.95)');
      grd.addColorStop(.55, 'rgba(252,252,255,.55)');
      grd.addColorStop(1, 'rgba(250,250,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return c;
  }

  // textures partagées (une seule instance par configuration)
  const cache = {};
  function memo(key, make) { return cache[key] || (cache[key] = make()); }

  function barkTex(species, rng) {
    return memo('bark:' + species.id, () => finish(barkTexture(species.ecorce, rng), species.ecorce.repeat || 1, species.ecorce.repeatV || 1));
  }
  function leafTex(species, rng) {
    return memo('leaf:' + species.id, () => finish(leafCanvas(species.feuille, rng), 1, 1));
  }
  function sprayTex(species, rng) {
    return memo('spray:' + species.id, () => finish(sprayCanvas(species.aiguilles, rng), 1, 1));
  }

  /* ===========================================================================
     3. OUTILS GÉOMÉTRIQUES
     ======================================================================== */
  // Fusion de plusieurs BufferGeometry (position/normal/uv/color/index)
  function mergeGeometries(list) {
    let vCount = 0, iCount = 0;
    for (const g of list) {
      vCount += g.attributes.position.count;
      iCount += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2), col = new Float32Array(vCount * 3);
    const idx = new Uint32Array(iCount);
    let vo = 0, io = 0;
    for (const g of list) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
      else col.fill(1, vo * 3, (vo + n) * 3);
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
      else { for (let i = 0; i < n; i++) idx[io + i] = i + vo; io += n; }
      vo += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  // Tube le long d'une courbe avec transport parallèle des repères (pas de
  // vrillage artificiel), flare de base, mousse, AO et capuchon arrondi.
  function tube(branch, opts, rng, acc) {
    const pts = branch.pts;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5);
    // longueur par la polyligne : getLength() échantillonne 200 fois la courbe,
    // ce qui coûte très cher sur des milliers de rameaux
    const len = polyLength(pts);
    const rings = branch.rings || clamp(Math.round(len * 2.0), 4, 26);
    const R = branch.radial || (branch.r0 > .30 ? 18 : branch.r0 > .14 ? 13 : branch.r0 > .06 ? 9 : 6);
    const r1 = branch.r1;
    const flare = branch.flare || 0;              // évasement du tronc au sol
    const flareH = branch.flareH || .9;
    const moss = opts.moss === undefined ? .18 : opts.moss;
    const ao = branch.ao === undefined ? .82 : branch.ao;

    let prevT = curve.getTangent(0).normalize();
    let n0 = Math.abs(prevT.y) < .92 ? new THREE.Vector3().crossVectors(UP, prevT).normalize()
      : new THREE.Vector3().crossVectors(V(1, 0, 0), prevT).normalize();
    let b0 = new THREE.Vector3().crossVectors(prevT, n0).normalize();
    const q = new THREE.Quaternion();
    let arclen = 0, last = curve.getPoint(0);
    const uOff = rng() * 4, vScale = 1 / (opts.barkScale || .55);
    const tint = branch.tint === undefined ? 1 : branch.tint;
    const mossColor = opts.mossColor || [.72, .95, .58];
    const bt = opts.branchTint;   // teinte propre au rameau (vert pour les conifères)

    const ringCount = rings + 1;
    const rows = [];
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      q.setFromUnitVectors(prevT, tan);
      n0.applyQuaternion(q).normalize(); b0.applyQuaternion(q).normalize();
      prevT.copy(tan);
      if (j > 0) arclen += p.distanceTo(last);
      last = p.clone();

      let r = lerp(branch.r0, r1, Math.pow(t, branch.taperPow || .92));
      if (flare) r *= 1 + flare * Math.pow(1 - t, 3.2) * (1 + .35 * Math.sin(6.2832 * t / flareH));
      if (branch.buttress) r *= 1 + branch.buttress * Math.sin(TAU * j / rings * 2) * .04;
      // irrégularité naturelle du tronc
      if (branch.wobble) r *= 1 + branch.wobble * Math.sin(t * 9.1 + branch.wobblePh * 6.2832);

      // AO : le cœur de la couronne est plus sombre
      const local = ao * (branch.root ? .9 : 1) * (1 - .1 * Math.sin(t * 5 + 2));
      const mossF = moss * clamp(1 - (p.y - (branch.y0 || 0)) / (opts.mossH || 1.4), 0, 1) * (1 - .5 * t);
      const rr = local * tint, mg = rr * (1 - mossF) + mossF * 1;
        const cr1 = bt ? bt[0] : 1, cg1 = bt ? bt[1] : 1, cb1 = bt ? bt[2] : 1;

      const cx = p.x, cy = p.y, cz = p.z;
      for (let k = 0; k <= R; k++) {
        const a = k / R * TAU;
        const cs = Math.cos(a), sn = Math.sin(a);
        const nx = n0.x * cs + b0.x * sn, ny = n0.y * cs + b0.y * sn, nz = n0.z * cs + b0.z * sn;
        acc.pos.push(cx + nx * r, cy + ny * r, cz + nz * r);
        acc.nor.push(nx, ny, nz);
        acc.uv.push(k / R * (branch.uvRepeat || 1) + uOff, arclen * vScale);
        // mousse : teinte verte là où l'écorce reste humide
        acc.col.push((mg * (1 - mossF) + mossF * mossColor[0]) * cr1,
          (mg * (1 - mossF) + mossF * mossColor[1]) * cg1,
          (mg * (1 - mossF) + mossF * mossColor[2]) * cb1);
      }
    }
    // faces
    const base = acc.pos.length / 3 - ringCount * (R + 1);
    for (let j = 0; j < rings; j++) for (let k = 0; k < R; k++) {
      const a = base + j * (R + 1) + k, b2 = a + 1, c2 = a + R + 1, d2 = c2 + 1;
      acc.idx.push(a, b2, c2, b2, d2, c2);
    }
    // capuchon (bourgeon terminal)
    if (branch.cap !== false) {
      const capRows = 3, tipBase = acc.pos.length / 3;
      const tip = curve.getPoint(1), tan = curve.getTangent(1).normalize();
      for (let j = 1; j <= capRows; j++) {
        const ph = j / (capRows + 1) * Math.PI * .5;
        const s = Math.cos(ph), hh = Math.sin(ph) * r1 * 1.35;
        for (let k = 0; k <= R; k++) {
          const a = k / R * TAU, cs = Math.cos(a), sn = Math.sin(a);
          const nx = n0.x * cs + b0.x * sn, ny = n0.y * cs + b0.y * sn, nz = n0.z * cs + b0.z * sn;
          const r = r1 * s;
          acc.pos.push(tip.x + nx * r + tan.x * hh, tip.y + ny * r + tan.y * hh, tip.z + nz * r + tan.z * hh);
          acc.nor.push(nx * .7 + tan.x * .7, ny * .7 + tan.y * .7, nz * .7 + tan.z * .7);
          acc.uv.push(k / R * (branch.uvRepeat || 1) + uOff, (arclen + hh) * vScale);
          acc.col.push(ao * tint, ao * tint, ao * tint);
        }
      }
      const prevRing = base + rings * (R + 1);
      for (let k = 0; k < R; k++) acc.idx.push(prevRing + k, prevRing + k + 1, tipBase + k);
      for (let j = 0; j < capRows - 1; j++) for (let k = 0; k < R; k++) {
        const a = tipBase + j * (R + 1) + k, b2 = a + 1, c2 = a + R + 1, d2 = c2 + 1;
        acc.idx.push(a, b2, c2, b2, d2, c2);
      }
      for (let k = 0; k < R; k++) {
        const a = tipBase + (capRows - 1) * (R + 1) + k, b2 = a + 1, apex = acc.pos.length / 3;
      }
      // pointe : on referme le dernier anneau par un éventail
      const lastRing = tipBase + (capRows - 1) * (R + 1);
      const apex = acc.pos.length / 3;
      acc.pos.push(tip.x + tan.x * r1 * 1.6, tip.y + tan.y * r1 * 1.6, tip.z + tan.z * r1 * 1.6);
      acc.nor.push(tan.x, tan.y, tan.z); acc.uv.push(uOff, (arclen + r1) * vScale);
      acc.col.push(ao * tint, ao * tint, ao * tint);
      for (let k = 0; k < R; k++) acc.idx.push(lastRing + k, lastRing + k + 1, apex);
    }
  }

  /* ===========================================================================
     4. GÉNÉRATEUR D'ARBRE
     ======================================================================== */
  // Longueur cumulée approximative pour placer des éléments le long d'une polyligne
  function polyLength(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]);
    return l;
  }
  function polyAt(pts, t) {
    const l = polyLength(pts), target = l * clamp(t, 0, 1);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].distanceTo(pts[i - 1]);
      if (acc + d >= target) {
        const k = d > 1e-6 ? (target - acc) / d : 0;
        const p = pts[i - 1].clone().lerp(pts[i], k);
        const dir = pts[i].clone().sub(pts[i - 1]).normalize();
        return { p, dir };
      }
      acc += d;
    }
    const n = pts.length - 1;
    return { p: pts[n].clone(), dir: pts[n].clone().sub(pts[n - 1]).normalize() };
  }

  // --- 4.1 Charpente : squelette récursif sous enveloppe de couronne -------
  // L'arbre pousse vers la lumière mais reste contenu dans une enveloppe
  // ellipsoïdale : les branches qui atteignent la surface se couchent pour la
  // suivre. C'est ce qui donne une silhouette pleine et naturelle, au lieu de
  // longs rameaux filants.
  function skeleton(S, rng, opts) {
    const branches = [], twigs = [];
    const maxDepth = S.levels;
    const H = S.hauteur || 10;
    const cour = S.couronne || { rx: (S.largeur || 6) * .34, ry: H * .40, cy: H * .58 };
    const q0 = p => {
      const dx = p.x / cour.rx, dy = (p.y - cour.cy) / cour.ry, dz = p.z / cour.rx;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    const grad = p => V(p.x / (cour.rx * cour.rx), (p.y - cour.cy) / (cour.ry * cour.ry),
      p.z / (cour.rx * cour.rx)).normalize();
    // distance, dans une direction donnée, avant de sortir de l'enveloppe
    const reach = (p, d) => {
      const ox = p.x / cour.rx, oy = (p.y - cour.cy) / cour.ry, oz = p.z / cour.rx;
      const dx = d.x / cour.rx, dy = d.y / cour.ry, dz = d.z / cour.rx;
      const A = dx * dx + dy * dy + dz * dz;
      const B = 2 * (ox * dx + oy * dy + oz * dz);
      const C = ox * ox + oy * oy + oz * oz - 1;
      const disc = B * B - 4 * A * C;
      if (disc <= 0) return 0;
      return (-B + Math.sqrt(disc)) / (2 * A);
    };
    const taille = S.hauteur || 10;

    function bendAdd(dir, depth, t, rng2) {
      const b = V(0, 0, 0);
      b.addScaledVector(UP, (S.photo || 0) * (1 - t * .5) * (depth === 0 ? .35 : 1));
      b.addScaledVector(DOWN, (S.gravity || 0) * Math.pow(t, .7) * (S.droopAt && depth >= S.droopAt ? 3.4 : 1));
      b.addScaledVector(rng2.dir(), (S.gnarl || 0) * (.3 + depth * .1));
      return b;
    }

    function grow(p0, dir0, len, r0, depth, azim) {
      // remplissage de l'espace : la branche s'étend jusqu'à la surface de
      // l'enveloppe, sans jamais dépasser la longueur demandée
      if (depth > 0) {
        const rm = reach(p0, dir0) * (depth === 1 ? .92 : .82);
        len = Math.min(len, Math.max(.22, rm));
      }
      const segs = clamp(Math.round(len * (depth === 0 ? 2.2 : 1.8)), 3, 14);
      const pts = [p0.clone()];
      let p = p0.clone(), d = dir0.clone().normalize();
      let qPrev = q0(p0), sortie = 0;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        d.addScaledVector(bendAdd(d, depth, t, rng), .32 * (1 + .5 * (1 - t)) / (1 + depth * .3)).normalize();
        // enveloppe de couronne : les branches sont attirées vers la surface
        // (ni trop au cœur, ni au-delà) — comme un espalier naturel
        const q = q0(p);
        const nrm = grad(p);
        const delta = clamp(q - .88, -.75, .75);
        d.addScaledVector(nrm, -delta * .6 * Math.pow(.9, depth));
        d.y -= .16 * delta * Math.pow(.92, depth);
        d.normalize();
        p = p.clone().addScaledVector(d, len / segs);
        const qn = q0(p);
        // sortie franche et persistante : on arrête (le bourgeon avorte)
        if (depth > 0 && qn > 1.14 && qn >= qPrev) sortie++; else sortie = 0;
        if (sortie >= 3) break;
        qPrev = qn;
        pts.push(p.clone());
      }
      if (pts.length < 2) return;
      // on rogne net ce qui dépasse franchement la couronne
      let coupe = pts.length;
      for (let i = pts.length - 1; i >= 2; i--) {
        if (q0(pts[i]) > 1.18) coupe = i; else break;
      }
      if (coupe < pts.length) pts.length = Math.max(2, coupe);
      const r1 = r0 * (depth === 0 ? (S.trunkTaper || S.taper) : (S.taperEtrangle || S.taper)) * rng.range(.95, 1.05);
      const bout = pts[pts.length - 1];
      const isTwig = depth >= (S.twigDepth === undefined ? maxDepth - 1 : S.twigDepth);
      const light = clamp(.30 + .45 * clamp(q0(bout), 0, 1.2) + .35 * (bout.y / taille), .15, 1.15);
      const rapide = !!S.rapide;
      const b = {
        pts, r0, r1, depth, twig: isTwig,
        rings: depth === 0 ? clamp(Math.round(polyLength(pts) * 2.2), 6, rapide ? 14 : 26)
          : clamp(Math.round(polyLength(pts) * (rapide ? 1 : 1.6)), 2, rapide ? 6 : 12),
        radial: rapide ? (r0 > .2 ? 9 : r0 > .08 ? 6 : 4)
          : (r0 > .28 ? 18 : r0 > .13 ? 13 : r0 > .055 ? 9 : 6),
        uvRepeat: clamp(Math.round(r0 * 9), 1, 4),
        ao: clamp(.50 + .50 * (1 - depth / (maxDepth + 1.5)) * (isTwig ? .8 : 1), .3, 1),
        tint: rng.range(.9, 1.08),
        light,
        moss: (S.moss === undefined ? .18 : S.moss) * (depth === 0 ? 1 : .22 * Math.pow(.75, depth)),
        cap: !rapide || depth <= 2
      };
      if (depth === 0) {
        b.trunk = true; b.flare = S.flare === undefined ? .7 : S.flare;
        b.taperPow = 1.35; b.wobble = S.wobble || .05; b.wobblePh = rng();
      }
      branches.push(b);

      // jeunes pousses : rameaux courts et fins qui portent le feuillage
      if (depth >= maxDepth - 1) {
        const nb = rapide ? Math.min(1, S.twigSplits || 2) : (S.twigSplits || 2);
        for (let i = 0; i < nb; i++) {
          const at = polyAt(pts, .45 + .5 * (nb === 1 ? 1 : i / (nb - 1)));
          const dirT = at.dir.clone().addScaledVector(rng.dir(), .85).addScaledVector(UP, .18).normalize();
          const tl = len * rng.range(.30, .62);
          const tp = [at.p.clone()];
          let pp = at.p.clone(), dd = dirT.clone();
          for (let k = 1; k <= 3; k++) {
            dd.addScaledVector(bendAdd(dd, depth + 1, k / 3, rng), .55).normalize();
            pp = pp.clone().addScaledVector(dd, tl / 3);
            tp.push(pp.clone());
          }
          twigs.push({
            pts: tp, r0: Math.max(.007, r1 * .55), r1: Math.max(.003, r1 * .2),
            depth: depth + 1, twig: true, rings: 3, radial: 4, uvRepeat: 1,
            ao: .42, tint: rng.range(.92, 1.06), light: clamp(light + .12, 0, 1.15),
            moss: 0, cap: true
          });
        }
      }
      if (depth >= maxDepth) return;

      // Ramification : nombre, angles, positions
      const stereo = S.stereo || 'spiral';
      let n = S.branching[depth] !== undefined ? S.branching[depth]
        : (depth < 2 ? 3 : 2);
      if (rapide) n = Math.max(1, n - 1);
      const budget = S.lenRatio || .74;
      const golden = 2.39996;
      for (let i = 0; i < n; i++) {
        const frac = n === 1 ? .95 : .42 + .56 * (i / (n - 1)) + rng.range(-.05, .05);
        const at = polyAt(pts, frac);
        let az;
        if (stereo === 'opposite') az = azim + (i % 2) * Math.PI + Math.PI * .5 * Math.floor(i / 2) + rng.range(-.2, .2);
        else if (stereo === 'whorl') az = azim + i / n * TAU + rng.range(-.15, .15);
        else az = azim + i * golden + rng.range(-.3, .3);
        const upRef = Math.abs(at.dir.y) > .95 ? V(1, 0, 0) : UP;
        const perp = new THREE.Vector3().crossVectors(at.dir, upRef).normalize();
        const axis = perp.clone().applyAxisAngle(at.dir, az).normalize();
        const ang = S.angle(depth, rng) * (S.leader && i === 0 ? .4 : 1) * (1 - .25 * clamp(q0(at.p), 0, 1));
        const nd = at.dir.clone().applyAxisAngle(axis, ang);
        nd.addScaledVector(UP, (S.lateralUp === undefined ? .12 : S.lateralUp) * (1 - clamp(q0(at.p), 0, 1) * .5));
        nd.normalize();
        const nr = Math.max(.006, r1 * (S.radiusRatio || .68) * Math.pow(.93, i) * rng.range(.9, 1.1));
        // Longueur : chaque génération mesure une fraction de la couronne
        // (auto-similarité), bornée par l'espace restant jusqu'à la surface de
        // l'enveloppe. C'est ainsi que le volume se remplit sans trous.
        const ech = Math.max(cour.rx, cour.ry) * (S.couronneLen === undefined ? .62 : S.couronneLen);
        const cible = ech * Math.pow(S.ratioLongueur === undefined ? .72 : S.ratioLongueur, depth - 1)
          * rng.range(.82, 1.2) * (n > 2 ? .82 : 1);
        const rm = reach(at.p, nd) * (S.reachFactor === undefined ? .78 : S.reachFactor);
        const nl = Math.max(.18, Math.min(cible, rm));
        grow(at.p, nd, nl, nr, depth + 1, az + golden);
      }
      // prolongement (pousse terminale) : l'arbre garde son axe dominant
      if (S.leader && depth < maxDepth) {
        const at = polyAt(pts, 1);
        const nd = at.dir.clone().addScaledVector(UP, .25).addScaledVector(rng.dir(), .18).normalize();
        grow(at.p, nd, Math.max(.2, len * .7), Math.max(.006, r1 * .8), depth + 1, azim + 1.1);
      }
    }

    const stems = S.stems || 1;
    for (let s = 0; s < stems; s++) {
      const a = s / stems * TAU + rng.range(-.3, .3);
      const d = V(Math.cos(a) * (S.stemSpread || .18), 1, Math.sin(a) * (S.stemSpread || .18)).normalize();
      const r = (S.trunkR || .3) * (stems > 1 ? .62 : 1) * rng.range(.92, 1.08);
      grow(V(Math.cos(a) * .12, 0, Math.sin(a) * .12), d,
        (S.trunkLen === undefined ? H * .3 : S.trunkLen) * rng.range(.92, 1.1), r, 0, a);
    }

    // racines-contreforts
    if (S.racines !== false) {
      const nR = S.nbRacines || 6;
      for (let i = 0; i < nR; i++) {
        const a = i / nR * TAU + rng.range(-.5, .5);
        const R0 = (S.trunkR || .3);
        const origin = V(Math.cos(a) * R0 * .35, R0 * .55, Math.sin(a) * R0 * .35);
        const L = R0 * rng.range(1.3, 2.2);
        const pts = [origin.clone()];
        let p = origin.clone(), d = V(Math.cos(a), -.9, Math.sin(a)).normalize();
        for (let k = 1; k <= 2; k++) {
          d.addScaledVector(rng.dir(), .18).addScaledVector(DOWN, .5).normalize();
          p = p.clone().addScaledVector(d, L / 2);
          pts.push(p.clone());
        }
        branches.push({
          pts, r0: R0 * rng.range(.42, .62), r1: R0 * .05,
          depth: 1, root: true, rings: 4, radial: 7, uvRepeat: 2, ao: .72,
          tint: rng.range(.9, 1.05), moss: (S.moss || .18) * 1.8, cap: false, taperPow: .55
        });
      }
    }
    return { branches, twigs };
  }

  // --- 4.2 Fructification / floraison -------------------------------------
  function fruitGeometry(kind, rng) {
    const g = [];
    if (kind === 'gland') {
      const body = new THREE.SphereGeometry(1, 10, 8);
      body.scale(1, 1.25, 1);
      body.translate(0, -1.15, 0);
      paintGeo(body, rng, .78, .62, .40);
      g.push(body);
      const cap = new THREE.SphereGeometry(1.12, 10, 6, 0, TAU, 0, Math.PI * .5);
      cap.translate(0, -1.0, 0);
      paintGeo(cap, rng, .40, .30, .20);
      g.push(cap);
    } else if (kind === 'pomme') {
      const body = new THREE.SphereGeometry(1, 12, 10);
      body.scale(1, .92, 1);
      paintGeo(body, rng, 1, 1, 1);
      g.push(body);
      const stem = new THREE.CylinderGeometry(.06, .08, .5, 5);
      stem.translate(0, 1.0, 0);
      paintGeo(stem, rng, .45, .32, .18);
      g.push(stem);
    } else if (kind === 'olive') {
      const body = new THREE.SphereGeometry(1, 10, 8);
      body.scale(.85, 1.2, .85);
      paintGeo(body, rng, 1, 1, 1);
      g.push(body);
    } else if (kind === 'cone') {         // cône de conifère, pendentif
      const body = new THREE.ConeGeometry(1, 2.1, 9, 5);
      body.rotateX(Math.PI);
      body.translate(0, -1.1, 0);
      paintGeo(body, rng, .62, .45, .30);
      g.push(body);
      const stalk = new THREE.CylinderGeometry(.1, .14, .4, 5);
      stalk.translate(0, .18, 0);
      paintGeo(stalk, rng, .40, .30, .20);
      g.push(stalk);
    } else if (kind === 'samare') {       // fruit ailé de l'érable
      const wing = new THREE.PlaneGeometry(1, 2.4, 2, 6);
      wing.translate(0, 1.2, 0);
      paintGeo(wing, rng, .86, .70, .42);
      g.push(wing);
      const seed = new THREE.SphereGeometry(.28, 8, 6);
      paintGeo(seed, rng, .70, .58, .38);
      g.push(seed);
    } else if (kind === 'baie') {
      const body = new THREE.SphereGeometry(1, 9, 7);
      paintGeo(body, rng, 1, 1, 1);
      g.push(body);
    }
    const merged = mergeGeometries(g);
    return merged;
  }
  function paintGeo(geo, rng, r, gg, b) {
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const f = .78 + .3 * rng();
      col[i * 3] = r * f; col[i * 3 + 1] = gg * f; col[i * 3 + 2] = b * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    return geo;
  }

  // --- 4.3 Feuillage -------------------------------------------------------
  function leafPlaneGeometry(cfg, rng) {
    // plan courbé (gouttière + léger enroulement du limbe)
    const segX = cfg && cfg.segments ? cfg.segments[0] : 3;
    const segY = cfg && cfg.segments ? cfg.segments[1] : 4;
    const g = new THREE.PlaneGeometry(1, 1, segX, segY);
    g.translate(0, .5, 0);
    const p = g.attributes.position;
    const curl = cfg.curl === undefined ? .16 : cfg.curl;
    const twist = cfg.torsion === undefined ? .1 : cfg.torsion;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, -curl * x * x * 2.2 + twist * (x * y) * 1.6 + (cfg.pointe ? -cfg.pointe * Math.pow(y, 3) * .5 : 0));
      p.setX(i, x * (1 - .06 * y));
    }
    g.computeVertexNormals();
    return g;
  }

  /* ===========================================================================
     5. CATALOGUE DES ESPÈCES
     ---------------------------------------------------------------------------
     hauteur (m), port, écorce, feuillage, fruits/floraison : chaque essence
     possède sa silhouette propre pour composer un jardin varié.
     ======================================================================== */
  const ESPECES = {

    /* --------------------------------------------------------------- CHÊNE */
    chene: {
      id: 'chene', nom: 'Chêne', latin: 'Quercus robur', emoji: '🌳',
      famille: 'Feuillu majestueux', description:
        'Tronc massif, branches tortueuses, houppier large et lumineux. L’arbre roi du jardin, celui qui donne l’échelle.',
      couleurUI: '#6f8b3e', hauteur: 11.5, largeur: 9.5, sol: 'gazon',
      ecorce: { pattern: 'sillons', base: '#6a5843', dark: '#2b2117', light: '#9b8a70', moss: .3, lichen: .22, repeat: 1, repeatV: 1 },
      feuille: { forme: 'lobee', lobes: 5, couleur: '#4a7526', sombre: '#2c4a15', clair: '#7fa847', nervures: 6, serration: 0, curl: .1, pointe: .1 },
      feuilleTaille: .115, densiteFeuilles: 1.0, feuillesCible: 11000,
      fruit: { type: 'gland', n: 90, taille: .055, couleur: '#b2803c' },
      port: {
        couronne: { rx: 5.4, ry: 5.2, cy: 6.3 }, levels: 8, trunkLen: 2.6, trunkR: 0.26, trunkTaper: .8, angle: (d, r) => .5 + r() * .5,
        lenRatio: .80, radiusRatio: .70, taper: .78, photo: .30, gravity: .22, gnarl: .30,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 2, 2], twigDepth: 5, twigSplits: 2,
        flare: .62, wobble: .07, moss: .3, nbRacines: 7, lateralUp: .16, stems: 1
      },
      forme: 'feuillu'
    },

    /* --------------------------------------------------------------- HÊTRE */
    hetre: {
      id: 'hetre', nom: 'Hêtre', latin: 'Fagus sylvatica', emoji: '🌳',
      famille: 'Feuillu de sous-bois', description:
        'Écorce lisse comme une peau, houppier dense et régulier, feuillage cuivré en automne.',
      couleurUI: '#8a9a5b', hauteur: 12.5, largeur: 8, sol: 'humus',
      ecorce: { pattern: 'lisse', base: '#8d9089', dark: '#4d4f4a', light: '#c3c6bd', moss: .2, lichen: .3 },
      feuille: { forme: 'ovale', profil: .66, couleur: '#3f6b25', sombre: '#26461a', clair: '#6f9a3c', serration: .8, nervures: 8, curl: .14, pointe: .06 },
      feuilleTaille: .085, densiteFeuilles: 1.35, feuillesCible: 9000,
      fruit: { type: 'baie', n: 60, taille: .022, couleur: '#8a6a3a' },
      port: {
        couronne: { rx: 4.9, ry: 5.6, cy: 6.9 }, levels: 8, trunkLen: 3.0, trunkR: 0.21, trunkTaper: .86, angle: (d, r) => .42 + r() * .38,
        lenRatio: .81, radiusRatio: .70, taper: .8, photo: .34, gravity: .12, gnarl: .16,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 2, 2], twigDepth: 5, twigSplits: 2,
        flare: .4, wobble: .03, moss: .18, nbRacines: 5, lateralUp: .2
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------- BOULEAU */
    bouleau: {
      id: 'bouleau', nom: 'Bouleau', latin: 'Betula pendula', emoji: '🌿',
      famille: 'Feuillu léger', description:
        'Cime aérienne, fines ramilles retombantes et écorce blanche zébrée de lenticelles : la lumière traverse.',
      couleurUI: '#a8c07a', hauteur: 10.5, largeur: 5.5, sol: 'gazon',
      ecorce: { pattern: 'lenticelles', base: '#e6e2d6', dark: '#3a3630', light: '#ffffff', moss: .1, lichen: .22 },
      feuille: { forme: 'cordee', couleur: '#5f8f35', sombre: '#3a5c20', clair: '#9dc45f', serration: 1, nervures: 8, curl: .12, pointe: .08 },
      feuilleTaille: .062, densiteFeuilles: 1.5, feuillesCible: 12500,
      fruit: { type: 'baie', n: 40, taille: .012, couleur: '#9aa66a' },
      port: {
        couronne: { rx: 3.1, ry: 4.6, cy: 5.9 }, levels: 8, trunkLen: 2.6, trunkR: 0.125, trunkTaper: .9, angle: (d, r) => .34 + r() * .4,
        lenRatio: .82, radiusRatio: .66, taper: .82, photo: .3, gravity: .30, gnarl: .2,
        stereo: 'spiral', branching: [3, 3, 2, 2, 2, 2, 2], twigDepth: 5, twigSplits: 3,
        flare: .3, wobble: .05, moss: .12, nbRacines: 5, lateralUp: .1, droopAt: 4
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------- TILLEUL */
    tilleul: {
      id: 'tilleul', nom: 'Tilleul', latin: 'Tilia cordata', emoji: '🌳',
      famille: 'Feuillu d’ombrage', description:
        'Feuilles en cœur, houppier en dôme très dense et floraison parfumée en début d’été.',
      couleurUI: '#7fa04a', hauteur: 12, largeur: 8.5, sol: 'gazon',
      ecorce: { pattern: 'sillons', base: '#5f5a4a', dark: '#2f2b21', light: '#8d8672', moss: .24, lichen: .2, contrast: .6 },
      feuille: { forme: 'cordee', couleur: '#487a2a', sombre: '#2c4f18', clair: '#79a844', serration: 1, nervures: 7, curl: .18, pointe: .05 },
      feuilleTaille: .078, densiteFeuilles: 1.4, feuillesCible: 9800,
      fleur: { type: 'panicule', n: 60, taille: .26, couleur: '#e8dfa0', clair: '#f6f0c8', automneSeulement: false },
      port: {
        couronne: { rx: 4.8, ry: 5.3, cy: 6.7 }, levels: 8, trunkLen: 2.8, trunkR: 0.21, trunkTaper: .84, angle: (d, r) => .5 + r() * .45,
        lenRatio: .80, radiusRatio: .72, taper: .78, photo: .3, gravity: .16, gnarl: .2,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 2, 2], twigDepth: 5, twigSplits: 2,
        flare: .48, wobble: .05, moss: .24, nbRacines: 6, lateralUp: .18
      },
      forme: 'feuillu'
    },

    /* --------------------------------------------------- ÉRABLE DU JAPON */
    erable: {
      id: 'erable', nom: 'Érable du Japon', latin: 'Acer palmatum', emoji: '🍁',
      famille: 'Petit arbre graphique', description:
        'Port en vase, plusieurs troncs, feuilles palmées pourpres qui s’embrasent à l’automne.',
      couleurUI: '#a8402f', hauteur: 5.6, largeur: 5.2, sol: 'terre',
      ecorce: { pattern: 'lisse', base: '#6d6357', dark: '#3c342c', light: '#a89c88', moss: .34, lichen: .26 },
      feuille: { forme: 'palmee', couleur: '#8e3a2c', sombre: '#5a1f18', clair: '#c9704a', serration: 1, nervures: 5, brillance: .5, curl: .2, pointe: .12 },
      feuilleTaille: .072, densiteFeuilles: 1.5, feuillesCible: 7000,
      fruit: { type: 'samare', n: 90, taille: .028, couleur: '#b06a3c' },
      port: {
        couronne: { rx: 3.1, ry: 2.3, cy: 3.3 }, levels: 7, trunkLen: 1.0, trunkR: 0.095, trunkTaper: .92, angle: (d, r) => .55 + r() * .5,
        lenRatio: .78, radiusRatio: .74, taper: .74, photo: .26, gravity: .2, gnarl: .3,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 1], twigDepth: 4, twigSplits: 2,
        flare: .5, wobble: .1, moss: .34, nbRacines: 7, lateralUp: .14, stems: 3, stemSpread: .5
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------ CERISIER */
    cerisier: {
      id: 'cerisier', nom: 'Cerisier en fleurs', latin: 'Prunus serrulata', emoji: '🌸',
      famille: 'Arbre de floraison', description:
        'Charpente en vase, floraison rose blanc au printemps, feuillage bronze puis vert, feuilles rouges à l’automne.',
      couleurUI: '#e39ab4', hauteur: 7.2, largeur: 7, sol: 'gazon',
      ecorce: { pattern: 'lenticelles', base: '#7a6a58', dark: '#3d332a', light: '#a99578', moss: .18, lichen: .24, repeat: 1 },
      feuille: { forme: 'ovale', profil: .72, couleur: '#4f7f2c', sombre: '#2f5119', clair: '#86ad4c', serration: 1, nervures: 8, brillance: .45, curl: .12, pointe: .06 },
      feuilleTaille: .075, densiteFeuilles: 1.35, feuillesCible: 11000,
      fleur: { n: 2200, taille: .085, couleurs: ['#ffffff', '#fff2f7', '#ffe4ee', '#ffd3e4'], pistil: '#f4b6c8' },
      fruit: { type: 'baie', n: 120, taille: .016, couleur: '#8e2536' },
      port: {
        couronne: { rx: 3.9, ry: 3.0, cy: 4.2 }, levels: 7, trunkLen: 1.2, trunkR: 0.16, trunkTaper: .9, angle: (d, r) => .58 + r() * .45,
        lenRatio: .79, radiusRatio: .72, taper: .76, photo: .24, gravity: .1, gnarl: .26,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 1], twigDepth: 4, twigSplits: 3,
        flare: .5, wobble: .08, moss: .18, nbRacines: 6, lateralUp: .2
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------ POMMIER */
    pommier: {
      id: 'pommier', nom: 'Pommier', latin: 'Malus domestica', emoji: '🍎',
      famille: 'Arbre fruitier', description:
        'Tronc court et noueux, ramure tordue par les années, pommes et fleurs : l’arbre du verger.',
      couleurUI: '#c0553f', hauteur: 4.6, largeur: 5.4, sol: 'gazon',
      ecorce: { pattern: 'sillons', base: '#655241', dark: '#2e241a', light: '#8f7c62', moss: .3, lichen: .34, contrast: .7 },
      feuille: { forme: 'ovale', profil: .74, couleur: '#4b7a2b', sombre: '#2c4d17', clair: '#7fa848', serration: 1, nervures: 8, curl: .16, pointe: .05 },
      feuilleTaille: .08, densiteFeuilles: 1.3, feuillesCible: 5000,
      fleur: { n: 260, taille: .07, couleurs: ['#fffaf4', '#ffeef0', '#ffdde4'], pistil: '#f7c9a0' },
      fruit: { type: 'pomme', n: 42, taille: .075, couleur: '#c33b2c' },
      port: {
        couronne: { rx: 3.0, ry: 2.0, cy: 2.6 }, levels: 7, trunkLen: .9, trunkR: 0.14, trunkTaper: .9, angle: (d, r) => .7 + r() * .6,
        lenRatio: .76, radiusRatio: .72, taper: .74, photo: .22, gravity: .3, gnarl: .38,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 1], twigDepth: 4, twigSplits: 3,
        flare: .62, wobble: .12, moss: .3, nbRacines: 7, lateralUp: .12
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------ OLIVIER */
    olivier: {
      id: 'olivier', nom: 'Olivier', latin: 'Olea europaea', emoji: '🫒',
      famille: 'Méditerranéen', description:
        'Tronc noueux et torsadé, feuillage argenté persistant : la lumière du Sud dans le jardin.',
      couleurUI: '#8f9a74', hauteur: 5.4, largeur: 5, sol: 'terre',
      ecorce: { pattern: 'torsade', base: '#8b8377', dark: '#4b443a', light: '#c3bcac', moss: .22, lichen: .34 },
      feuille: { forme: 'lanceolee', couleur: '#6f8a52', sombre: '#41552f', clair: '#c3d3a6', duvet: 1, nervures: 6, curl: .3, pointe: .04 },
      feuilleTaille: .05, densiteFeuilles: 1.7, feuillesCible: 11500,
      fruit: { type: 'olive', n: 160, taille: .018, couleur: '#4a4a22' },
      port: {
        couronne: { rx: 3.1, ry: 2.5, cy: 3.1 }, levels: 7, trunkLen: .8, trunkR: 0.15, trunkTaper: .95, angle: (d, r) => .7 + r() * .65,
        lenRatio: .78, radiusRatio: .74, taper: .76, photo: .24, gravity: .24, gnarl: .42,
        stereo: 'spiral', branching: [3, 3, 2, 2, 2, 1], twigDepth: 5, twigSplits: 3,
        flare: .6, wobble: .16, moss: .22, nbRacines: 8, lateralUp: .1, stems: 2, stemSpread: .4
      },
      forme: 'feuillu'
    },

    /* ------------------------------------------------------------- SAULE */
    saule: {
      id: 'saule', nom: 'Saule pleureur', latin: 'Salix babylonica', emoji: '🌿',
      famille: 'Arbre pleureur', description:
        'Branches en cascade jusqu’au sol, feuilles fines qui frissonnent : l’arbre de la pièce d’eau.',
      couleurUI: '#8ab55e', hauteur: 8.4, largeur: 8.5, sol: 'berge',
      ecorce: { pattern: 'sillons', base: '#6a6049', dark: '#332c1e', light: '#96896b', moss: .4, lichen: .2, contrast: .65 },
      feuille: { forme: 'lanceolee', couleur: '#7ea84a', sombre: '#4d7226', clair: '#b6d47a', duvet: .4, nervures: 9, curl: .3, pointe: .1, torsion: .25 },
      feuilleTaille: .07, densiteFeuilles: 1.6, feuillesCible: 10000,
      port: {
        couronne: { rx: 4.5, ry: 3.8, cy: 4.6 }, levels: 7, trunkLen: 1.3, trunkR: 0.19, trunkTaper: .88, angle: (d, r) => .45 + r() * .4,
        lenRatio: .84, radiusRatio: .68, taper: .8, photo: .2, gravity: .55, gnarl: .22,
        stereo: 'spiral', branching: [3, 4, 3, 2, 2, 1], twigDepth: 4, twigSplits: 3,
        flare: .55, wobble: .09, moss: .4, nbRacines: 7, lateralUp: .22, droopAt: 3
      },
      forme: 'pleureur'
    },

    /* ----------------------------------------------------------- CYPRÈS */
    cypres: {
      id: 'cypres', nom: 'Cyprès', latin: 'Cupressus sempervirens', emoji: '🌲',
      famille: 'Conifère colonnaire', description:
        'Flèche végétale sombre : il structure le jardin, marque les allées et coupe le vent.',
      couleurUI: '#3d5b34', hauteur: 8.5, largeur: 2.0, sol: 'terre',
      ecorce: { pattern: 'sillons', base: '#6b6154', dark: '#332d24', light: '#94897a', moss: .16, lichen: .26, contrast: .5 },
      aiguilles: { couleur: '#37552f', sombre: '#1f3320', clair: '#5f8047', densite: 340, longueur: .18, epaisseur: 3.2, mode: 'etoile', masse: .44, finesse: .46 },
      fruit: { type: 'cone', n: 60, taille: .022, couleur: '#6b5a3c' },
      port: { formeConifere: 'colonne', hauteur: 8.5, largeur: 2.0, nbVerticilles: 32, densiteSprays: 1.0, troncR: .17 },
      forme: 'conifere'
    },

    /* ---------------------------------------------------------- ÉPICÉA */
    epicea: {
      id: 'epicea', nom: 'Épicéa', latin: 'Picea abies', emoji: '🌲',
      famille: 'Conifère de futaie', description:
        'Silhouette conique régulière, rameaux retombants, cônes pendants : la forêt qui monte au ciel.',
      couleurUI: '#2f5b3a', hauteur: 14, largeur: 5, sol: 'humus',
      ecorce: { pattern: 'ecailles', base: '#6d5340', dark: '#33241a', light: '#9b7c5d', moss: .2, lichen: .3 },
      aiguilles: { couleur: '#2f5a34', sombre: '#1b3a22', clair: '#54803f', densite: 400, longueur: .20, epaisseur: 3.0, mode: 'pousse', courbe: -.55, masse: .42, finesse: .34 },
      fruit: { type: 'cone', n: 90, taille: .05, couleur: '#7a5a38' },
      port: { formeConifere: 'cone', hauteur: 14, largeur: 5, nbVerticilles: 22, densiteSprays: 1.15, troncR: .26, droop: .35 },
      forme: 'conifere'
    },

    /* ------------------------------------------------------------- PIN */
    pin: {
      id: 'pin', nom: 'Pin sylvestre', latin: 'Pinus sylvestris', emoji: '🌲',
      famille: 'Conifère parasol', description:
        'Tronc nu couleur cannelle, houppier en parasol : le pin des landes et des jardins secs.',
      couleurUI: '#8a6a45', hauteur: 12.5, largeur: 7.5, sol: 'humus',
      ecorce: { pattern: 'plaques', base: '#9a6a44', dark: '#4a3122', light: '#d8a06a', moss: .18, lichen: .3, relief: .4, contrast: .7 },
      aiguilles: { couleur: '#4b6b33', sombre: '#2c451f', clair: '#77934a', densite: 340, longueur: .26, epaisseur: 2.8, mode: 'pousse', courbe: -.3, masse: .34, finesse: .30 },
      fruit: { type: 'cone', n: 70, taille: .045, couleur: '#6d5236' },
      port: { formeConifere: 'parasol', hauteur: 12.5, largeur: 7.5, nbVerticilles: 14, densiteSprays: .8, troncR: .30, troncNu: 7.0, droop: .1 },
      forme: 'conifere'
    },

    /* ------------------------------------------------------------ LILAS */
    lilas: {
      id: 'lilas', nom: 'Lilas', latin: 'Syringa vulgaris', emoji: '💜',
      famille: 'Arbuste de floraison', description:
        'Arbuste touffu à multiples troncs, grappes parfumées au printemps : le volume bas du massif.',
      couleurUI: '#9a7ab8', hauteur: 3.2, largeur: 3.4, sol: 'terre',
      ecorce: { pattern: 'lisse', base: '#77695a', dark: '#403730', light: '#a89a8a', moss: .26, lichen: .18 },
      feuille: { forme: 'cordee', couleur: '#4a7530', sombre: '#2c4a1c', clair: '#7ba549', nervures: 7, curl: .14 },
      feuilleTaille: .07, densiteFeuilles: 1.6, feuillesCible: 1800,
      fleur: { type: 'panicule', n: 190, taille: .22, couleur: '#b18ccd', clair: '#e0cdf0', pistil: '#f4ecff', coeur: '#8f6bb0' },
      port: {
        couronne: { rx: 1.9, ry: 1.25, cy: 1.95 }, levels: 6, trunkLen: .8, trunkR: 0.055, trunkTaper: .92, angle: (d, r) => .6 + r() * .55,
        lenRatio: .78, radiusRatio: .72, taper: .74, photo: .34, gravity: .18, gnarl: .3,
        stereo: 'spiral', branching: [3, 3, 2, 2, 2], twigDepth: 4, twigSplits: 3,
        flare: .3, wobble: .1, moss: .26, nbRacines: 8, lateralUp: .26, stems: 5, stemSpread: .8
      },
      forme: 'arbuste'
    },

    /* ----------------------------------------------------------- HORTENSIA */
    hortensia: {
      id: 'hortensia', nom: 'Hortensia', latin: 'Hydrangea macrophylla', emoji: '💠',
      famille: 'Arbuste de massif', description:
        'Boule de feuilles et grosses ombelles bleues : parfaites pour habiller les pieds de mur et les massifs.',
      couleurUI: '#6f95cf', hauteur: 1.5, largeur: 1.8, sol: 'terre',
      ecorce: { pattern: 'lisse', base: '#8a7c68', dark: '#4a4038', light: '#bdb09c', moss: .2, lichen: .1 },
      feuille: { forme: 'ovale', profil: .6, couleur: '#3f7031', sombre: '#26491d', clair: '#689a45', nervures: 9, serration: 1, brillance: .3, curl: .2 },
      feuilleTaille: .10, densiteFeuilles: 1.9, feuillesCible: 420,
      fleur: { type: 'ombelle', n: 40, taille: .34, couleur: '#7fa4dd', clair: '#cfe0f5', coeur: false },
      port: {
        couronne: { rx: .95, ry: .62, cy: .88 }, levels: 5, trunkLen: .4, trunkR: 0.028, trunkTaper: .95, angle: (d, r) => .75 + r() * .5,
        lenRatio: .76, radiusRatio: .74, taper: .76, photo: .3, gravity: .34, gnarl: .28,
        stereo: 'whorl', branching: [3, 3, 2, 2], twigDepth: 3, twigSplits: 2,
        flare: .2, wobble: .1, moss: .2, nbRacines: 6, lateralUp: .1, stems: 6, stemSpread: 1.0
      },
      forme: 'arbuste'
    },

    /* ------------------------------------------------------------- FOUGÈRE */
    fougere: {
      id: 'fougere', nom: 'Fougère', latin: 'Dryopteris filix-mas', emoji: '🌿',
      famille: 'Sous-bois', description:
        'Frondes arquées en rosette : structure le pied des arbres et les coins d’ombre humide.',
      couleurUI: '#3f6b3a', hauteur: 1.05, largeur: 1.6, sol: 'humus',
      feuille: { forme: 'fronde', couleur: '#3f6b32', sombre: '#22401e', clair: '#7aa855', pinnae: 30, nervures: 12 },
      feuilleTaille: .55, densiteFeuilles: 1.0, feuilleLargeur: .34,
      port: { rosetteFeuilles: 14, hauteur: 1.05, largeur: 1.6 },
      forme: 'rosette'
    },

    /* ---------------------------------------------------- GRAMINÉE DÉCORATIVE */
    stipa: {
      id: 'stipa', nom: 'Cheveux d’ange', latin: 'Stipa tenuissima', emoji: '🌾',
      famille: 'Graminée', description:
        'Touffe blonde qui ondule au moindre souffle : elle adoucit les bordures et les pieds de massif.',
      couleurUI: '#c9b06a', hauteur: 1.0, largeur: 1.1, sol: 'terre',
      feuille: { forme: 'touffe', couleur: '#c8b877', sombre: '#94854a', clair: '#eee1b0', brins: 110, epi: true },
      feuilleTaille: .8, densiteFeuilles: 1.0, feuilleLargeur: .62,
      port: { rosetteFeuilles: 46, hauteur: 1.0, largeur: 1.1, arche: 1.2 },
      forme: 'rosette'
    },

    /* --------------------------------------------------------- MASSIF DE BUIS */
    buis: {
      id: 'buis', nom: 'Buis taillé', latin: 'Buxus sempervirens', emoji: '🧱',
      famille: 'Haie et topiaire', description:
        'Volume net taillé au cordeau : il dessine les bordures, les allées et les parterres.',
      couleurUI: '#4a6b34', hauteur: 1.0, largeur: 1.0,
      forme: 'volume'
    }
  };

  /* ===========================================================================
     6. CONSTRUCTION D'UN ARBRE
     ======================================================================== */
  function buildTree(id, opts) {
    opts = opts || {};
    const S = ESPECES[id];
    if (!S) throw new Error('Espèce inconnue : ' + id);
    // « port » effectif : la distance permet d'alléger les sujets lointains
    const PORT = S.port ? Object.assign({}, S.port) : S.port;
    if (PORT && opts.niveaux) PORT.levels = Math.max(3, Math.round(opts.niveaux));
    if (PORT && opts.rameaux !== undefined) PORT.twigSplits = Math.max(1, Math.round(opts.rameaux));
    if (PORT) PORT.rapide = !!opts.rapide;
    const rng = RNG(opts.seed === undefined ? (id.length * 7919 + 13) : opts.seed);
    const qual = opts.qualite === undefined ? 1 : opts.qualite;   // 0.4 (loin) → 1.6 (héros)
    const season = opts.saison || 'ete';
    const group = new THREE.Group();
    const meshes = { feuilles: [], fruits: [], fleurs: [], aiguilles: [] };

    const acc = { pos: [], nor: [], uv: [], col: [], idx: [] };

    // Profil du houppier d'un conifère : colonne (cyprès), cône (épicéa),
    // parasol (pin) — c'est ce qui distingue les silhouettes.
    const profCone = (P, t) => {
      if (P.formeConifere === 'colonne') return Math.pow(clamp(1 - t * .96, 0, 1), .62);      // flèche
      if (P.formeConifere === 'parasol') return Math.pow(clamp(Math.sin(Math.PI * (.10 + .58 * t)), 0, 1), .48);
      return Math.pow(clamp(1 - t, 0, 1), .62) * (1 + .35 * Math.sin(Math.PI * t));            // cône plein
    };

    /* --- conifères : structure en verticilles --- */
    if (S.forme === 'conifere') {
      const P = S.port, rngN = rng;
      const H = P.hauteur, L = P.largeur;
      const nu = P.troncNu || 0;
      const sommet = nu + (H * .97 - nu);          // hauteur du dernier verticille
      const trunk = [V(0, 0, 0)];
      const nbSeg = 26;
      let d = V(0, 1, 0);
      for (let i = 1; i <= nbSeg; i++) {
        d.addScaledVector(rngN.dir(), .04 * (1 - i / nbSeg * .6)).normalize();
        trunk.push(trunk[i - 1].clone().addScaledVector(d, (sommet * 1.02) / nbSeg));
      }
      const trunkR = P.troncR;
      const trunkBranch = {
        pts: trunk, r0: trunkR * 1.15, r1: trunkR * .18, depth: 0, trunk: true, rings: 24, radial: 12,
        uvRepeat: 3, ao: .8, tint: 1, moss: .16, flare: .62, taperPow: .95, cap: true
      };
      tube(trunkBranch, { moss: .18, barkScale: .5, mossH: 1.2 }, rng, acc);

      const sprayGeom = [];
      const nbV = P.nbVerticilles;
      for (let i = 0; i < nbV; i++) {
        const t = i / (nbV - 1);
        const y = nu + (H * .97 - nu) * t;
        const prof = profCone(P, t);
        const rayon = L * .5 * clamp(prof, .06, 1.15);
        const nbBranches = Math.round(lerp(5, 10, clamp(1 - t, 0, 1)) * (P.densiteSprays || 1) * 1.2) + 2;
        for (let b = 0; b < nbBranches; b++) {
          const a = b / nbBranches * TAU + i * 1.7 + rng.range(-.3, .3);
          const droop = (P.droop || .2) * rng.range(.6, 1.4);
          const len = rayon * rng.range(.78, 1.06);
          if (len < .12) continue;
          const pts = [V(0, y, 0)];
          let p = V(0, y, 0), dd = V(Math.cos(a), .12 - droop * .2, Math.sin(a)).normalize();
          const nseg = 3;
          for (let k = 1; k <= nseg; k++) {
            const tt = k / nseg;
            dd.addScaledVector(DOWN, droop * tt * .35).addScaledVector(rng.dir(), .12).normalize();
            p = p.clone().addScaledVector(dd, len / nseg);
            pts.push(p.clone());
          }
          // rameau ligneux (fin, visible au cœur de la ramure)
          tube({
            pts, r0: Math.max(.008, rayon * .045), r1: Math.max(.004, rayon * .012),
            depth: 1, rings: 3, radial: 5, uvRepeat: 1, ao: .6, tint: rng.range(.7, .85), moss: 0, cap: false
          }, { moss: 0, barkScale: .5, branchTint: [.62, .78, .48] }, rng, acc);

          // une carte longe le rameau sur toute sa longueur (pousse continue),
          // doublée d'une seconde croisée : l'aiguille se lit « en masse »
          const cardLen = len * 1.08;
          const atMid = polyAt(pts, .5);
          const axe = atMid.dir.clone().normalize();
          for (let s = 0; s < 2; s++) {
            const roll = rng() * TAU + s * Math.PI * .5;
            const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), axe);
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(axe, roll));
            const mm = new THREE.Matrix4().compose(atMid.p, q,
              V(cardLen, cardLen * (S.aiguilles.finesse || .34), cardLen));
            sprayGeom.push(mm.clone());
          }
          if (len > .8) {   // fragment supplémentaire : casse la régularité
            const at2 = polyAt(pts, rng.range(.2, .4));
            const axe2 = at2.dir.clone().normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), axe2);
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(axe2, rng() * TAU));
            sprayGeom.push(new THREE.Matrix4().compose(at2.p, q, V(cardLen * .6, cardLen * .25, cardLen * .6)));
          }
        }
      }
      // flèche terminale : pousses d'aiguilles dressées (bourgeon apical)
      const apexY = sommet;
      for (let i = 0; i < 4; i++) {
        const a = rng() * TAU, ln = L * rng.range(.14, .26);
        const dirV = V(Math.cos(a) * .22, 1, Math.sin(a) * .22).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dirV);
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(dirV, rng() * TAU));
        const mm = new THREE.Matrix4().compose(V(Math.cos(a) * .02, apexY - ln * .35, Math.sin(a) * .02),
          q, V(ln * 1.5, ln * .5, ln * 1.5));
        sprayGeom.push(mm);
      }

      // cônes
      if (S.fruit) {
        const fg = fruitGeometry(S.fruit.type, rng);
        const n = Math.round(S.fruit.n * qual);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(S.fruit.couleur), vertexColors: true, roughness: .7, metalness: 0, side: THREE.DoubleSide });
        const im = new THREE.InstancedMesh(fg, mat, n);
        im.castShadow = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion();
        for (let i = 0; i < n; i++) {
          const t = rng.range(.25, .95);
          const y = nu + (H * .95 - nu) * t;
          const prof = profCone(P, t);
          const a = rng() * TAU, r = L * .5 * clamp(prof, .06, 1) * rng.range(.3, .9);
          m.compose(V(Math.cos(a) * r, y, Math.sin(a) * r), q.setFromAxisAngle(V(1, 0, 0), Math.PI), V(S.fruit.taille, S.fruit.taille, S.fruit.taille));
          im.setMatrixAt(i, m);
        }
        group.add(im); meshes.fruits.push(im);
      }
      // instances de plaques d'aiguilles
      if (sprayGeom.length) {
        const tex = memo('spray:' + S.id, () => finish(sprayCanvas(S.aiguilles, RNG(4711)), 1, 1));
        const geo = crossPlanes();
        const mat = new THREE.MeshStandardMaterial({
          map: tex, alphaTest: .42, side: THREE.DoubleSide, roughness: .8, metalness: 0,
          color: new THREE.Color(feuilleCouleur(S, season).base)
        });
        const im = new THREE.InstancedMesh(geo, mat, sprayGeom.length);
        sprayGeom.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = true;
        im.customDepthMaterial = depthFor(mat);
        group.add(im); meshes.aiguilles.push(im);
      }
    }

    /* --- feuillus, arbustes, pleureurs --- */
    if (S.forme === 'feuillu' || S.forme === 'pleureur' || S.forme === 'arbuste') {
      const { branches, twigs } = skeleton(PORT, rng, opts);
      const all = branches.concat(twigs);
      // Calibrage : le squelette brut est étiré pour remplir exactement son
      // enveloppe de couronne, puis la hauteur totale est ajustée à la valeur
      // annoncée pour l'espèce. Les rayons suivent une moyenne géométrique des
      // deux facteurs, ce qui conserve des proportions crédibles.
      const cour = PORT.couronne;
      let maxR = 1e-3, maxY = 1e-3;
      for (const b of all) for (const p of b.pts) {
        maxR = Math.max(maxR, Math.hypot(p.x, p.z));
        maxY = Math.max(maxY, p.y);
      }
      const kr = clamp(cour.rx * .97 / maxR, .80, 1.6);
      const kv = clamp((cour.cy + cour.ry * .98) / maxY, .70, 1.45);
      const krad = Math.sqrt(kr * kv);
      let y2 = 1e-3;
      for (const b of all) for (const p of b.pts) { p.x *= kr; p.z *= kr; p.y *= kv; if (p.y > y2) y2 = p.y; }
      const kh = clamp((S.hauteur * (opts.echelle || 1)) / y2, .85, 1.18);
      // référence de rayon : le tronc doit mesurer exactement trunkR
      let r0Ref = 0, nRef = 0;
      for (const b of all) if (b.depth === 0 && !b.root) { r0Ref += b.r0; nRef++; }
      const f = nRef ? (PORT.trunkR || .3) / (r0Ref / nRef) : 1;
      for (const b of all) {
        for (const p of b.pts) p.y *= kh;
        if (b.root) continue;
        b.r0 *= f; b.r1 *= f;
      }
      for (const b of all) {
        tube(b, {
          moss: b.moss, mossH: S.hauteur * .18, barkScale: .5, mossColor: [.66, .92, .54]
        }, rng, acc);
      }

      // feuilles
      const coul = feuilleCouleur(S, season);
      const leafArgs = leafInstances(S, PORT, all, rng, opts, season, coul);
      const geo = leafPlaneGeometry(opts.segmentsFeuille ? { segments: opts.segmentsFeuille } : S.feuille, rng);
      const tex = memo('leaf:' + S.id, () => finish(leafCanvas(S.feuille, RNG(99 + S.id.length), 320, 640), 1, 1));
      const mat = new THREE.MeshStandardMaterial({
        map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .74, metalness: 0,
        color: 0xffffff
      });
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, leafArgs.length));
      im.count = leafArgs.length;
      im.castShadow = true; im.receiveShadow = true;
      im.customDepthMaterial = depthFor(mat);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = V(1, 1, 1);
      leafArgs.forEach((l, i) => {
        q.setFromUnitVectors(UP, l.dir);
        q2.setFromAxisAngle(UP, l.roll);
        q.multiply(q2);
        m.compose(l.p, q, sc.set(l.s, l.s, l.s));
        im.setMatrixAt(i, m);
        im.setColorAt(i, l.c);
      });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      group.add(im); meshes.feuilles.push(im);

      // fleurs (cerisier, pommier, tilleul, lilas, hortensia)
      if (S.fleur) {
        const fg = flowerInstances(S, PORT, all, rng, qual, season);
        if (fg.length) {
          const ftex = memo('flower:' + S.id, () => finish(flowerCanvas({
            type: S.fleur.type || 'rayon', couleur: S.fleur.couleurs ? S.fleur.couleurs[0] : S.fleur.couleur,
            clair: S.fleur.clair || (S.fleur.couleurs ? S.fleur.couleurs[1] : '#ffffff'),
            coeur: S.fleur.pistil || '#e8c46a', petales: 5, W: 256, H: 256, rayon: .38
          }, RNG(313), 256, 256), 1, 1));
          const geoF = new THREE.PlaneGeometry(1, 1);
          const matF = new THREE.MeshStandardMaterial({ map: ftex, alphaTest: .4, side: THREE.DoubleSide, roughness: .6, metalness: 0 });
          const imF = new THREE.InstancedMesh(geoF, matF, fg.length);
          const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), qq2 = new THREE.Quaternion(), ss = V(1, 1, 1);
          fg.forEach((f, i) => {
            qq.setFromUnitVectors(UP, f.dir); qq2.setFromAxisAngle(UP, f.roll); qq.multiply(qq2);
            mm.compose(f.p, qq, ss.set(f.s, f.s, f.s));
            imF.setMatrixAt(i, mm);
            imF.setColorAt(i, f.c);
          });
          group.add(imF); meshes.fleurs.push(imF);
        }
      }

      // fruits
      if (S.fruit && (season === 'ete' || season === 'automne')) {
        const fg = fruitGeometry(S.fruit.type, rng);
        const n = Math.max(1, Math.round(S.fruit.n * qual * (season === 'automne' ? 1.35 : .8)));
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(S.fruit.couleur), vertexColors: true, roughness: .62, metalness: 0, side: THREE.DoubleSide
        });
        const im = new THREE.InstancedMesh(fg, mat, n);
        im.castShadow = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion();
        const cand = all.filter(b => b.depth >= (PORT.levels - 3) && !b.root);
        for (let i = 0; i < n; i++) {
          const b = cand.length ? cand[Math.floor(rng() * cand.length)] : all[0];
          const at = polyAt(b.pts, rng.range(.3, 1));
          const off = rng.dir().multiplyScalar((b.r1 || .05) * 2.2 + .06);
          m.compose(at.p.clone().add(off), q.setFromUnitVectors(UP, DOWN.clone().addScaledVector(rng.dir(), .5).normalize()),
            V(S.fruit.taille, S.fruit.taille, S.fruit.taille));
          im.setMatrixAt(i, m);
        }
        group.add(im); meshes.fruits.push(im);
      }
    }

    /* --- rosettes de frondes (fougère, graminée) --- */
    if (S.forme === 'rosette') {
      const P = S.port;
      const n = Math.round(P.rosetteFeuilles * qual);
      const coul = feuilleCouleur(S, season);
      const tex = memo('rosette:' + S.id, () => {
        const f = S.feuille;
        if (f.forme === 'fronde') return finish(frondCanvas(f, RNG(77 + seedOf(S.id)), 256, 1024), 1, 1);
        if (f.forme === 'touffe') return finish(tuftCanvas(f, RNG(77 + seedOf(S.id)), 512, 512), 1, 1);
        return finish(leafCanvas(f, RNG(77), 256, 1024), 1, 1);
      });
      const geo = new THREE.PlaneGeometry(1, 1, 3, 8);
      geo.translate(0, .5, 0);
      // la lame s'arque vers l'extérieur
      (function () {
        const pp = geo.attributes.position;
        for (let i = 0; i < pp.count; i++) {
          const y = pp.getY(i), x = pp.getX(i);
          pp.setZ(i, pp.getZ(i) - (P.arche === undefined ? .8 : P.arche) * y * y * .45 + x * x * .1);
        }
        geo.computeVertexNormals();
      })();
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .42, side: THREE.DoubleSide, roughness: .8, metalness: 0 });
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.castShadow = true;
      im.customDepthMaterial = depthFor(mat);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
      const arch = P.arche === undefined ? .8 : P.arche;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rng.range(-.3, .3);
        const tilt = rng.range(.35, 1.15) * (Math.PI / 2.4);
        const dir = V(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)).normalize();
        const s = P.hauteur * rng.range(.75, 1.15);
        q.setFromUnitVectors(UP, dir);
        q2.setFromAxisAngle(dir, rng.range(-.5, .5)); q.multiply(q2);
        const p = V(Math.cos(a) * .06, 0, Math.sin(a) * .06);
        m.compose(p, q, V(s * (S.feuilleLargeur || .3), s, s));
        im.setMatrixAt(i, m);
        im.setColorAt(i, coul.base.clone().offsetHSL(rng.range(-.02, .02), rng.range(-.05, .05), rng.range(-.06, .06)));
      }
      group.add(im); meshes.feuilles.push(im);
    }

    /* --- volumes taillés (buis) : géométrie bruitée --- */
    if (S.forme === 'volume') {
      const geo = new THREE.IcosahedronGeometry(.52, 3);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + rng.gauss(0, .05);
        const n2 = 1 + .06 * Math.sin(x * 9) * Math.cos(z * 7);
        p.setXYZ(i, x * n * n2 * 1.04, Math.max(-.48, y * n * .92 * n2) + .48, z * n * n2 * .98);
      }
      geo.computeVertexNormals();
      const tex = memo('leaf:buis', () => finish(leafCanvas({
        forme: 'ovale', profil: .7, couleur: '#3f6b2c', sombre: '#24451c', clair: '#679a42', nervures: 6
      }, RNG(12), 96, 96), 6, 6));
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .86, metalness: 0, color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh); meshes.feuilles.push(mesh);
    }

    /* --- écorce : maillage fusionné --- */
    if (acc.pos.length) {
      const barkGeo = new THREE.BufferGeometry();
      barkGeo.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
      barkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
      barkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
      barkGeo.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
      barkGeo.setIndex(new THREE.Uint32BufferAttribute(acc.idx, 1));
      const bcfg = S.ecorce || { pattern: 'lisse', base: '#7a7060', dark: '#403830', light: '#a89c88' };
      const btex = memo('bark:' + S.id, () => finish(barkTexture(bcfg, RNG(seedOf(S.id) + 5)), 1, 1));
      const barkMat = new THREE.MeshStandardMaterial({
        map: btex, bumpMap: btex, bumpScale: .045, roughness: .93, metalness: 0,
        vertexColors: true
      });
      const bark = new THREE.Mesh(barkGeo, barkMat);
      bark.castShadow = true; bark.receiveShadow = true;
      bark.name = 'ecorce';
      group.add(bark);
      meshes.ecorce = bark;
    }
    group.userData.espece = S;
    group.userData.meshes = meshes;
    group.userData.hauteur = S.hauteur;
    return group;
  }

  function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // plans croisés (aiguilles) : deux quads en X pour donner du volume
  function crossPlanes() {
    const a = new THREE.PlaneGeometry(1, .34);
    const b = a.clone(); b.rotateY(Math.PI / 2); b.rotateX(Math.PI / 2);
    const c = a.clone(); c.rotateZ(Math.PI / 2);
    return mergeGeometries([a, b, c]).translate(0, 0, 0);
  }

  function depthFor(mat) {
    const d = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest
    });
    return d;
  }

  /* --- couleurs de feuillage selon la saison ----------------------------- */
  function feuilleCouleur(S, season) {
    const f = S.feuille || { couleur: '#4a7526' };
    const base = new THREE.Color(f.couleur);
    const pal = {
      printemps: { hue: .02, sat: .12, lig: .16, teintes: [.90, 1.05, 1.15] },
      ete: { hue: 0, sat: .02, lig: .04, teintes: [.78, 1.0, 1.12] },
      automne: { hue: -.09, sat: .16, lig: -.05, teintes: [1.0, 1.25, 1.6] },
      hiver: { hue: 0, sat: -.05, lig: .02, teintes: [1, 1, 1] }
    }[season] || { hue: 0, sat: .02, lig: .04, teintes: [.8, 1, 1.1] };
    const c = base.clone().offsetHSL(pal.hue, pal.sat * .35, pal.lig * .5);
    if (season === 'automne') { c.offsetHSL(-.04, .1, .06); }
    return { base: c, teintes: pal.teintes };
  }

  /* --- génération des instances de feuilles ----------------------------- */
  function leafInstances(S, PORT, branches, rng, opts, season, coul) {
    const out = [];
    const taille = (S.feuilleTaille || .15) * (opts.echelleFeuille || 1);
    const densite = (S.densiteFeuilles || 1) * (opts.densite === undefined ? 1 : opts.densite);
    const hiver = season === 'hiver' && S.feuille && S.feuille.persistant !== true && S.forme !== 'arbuste';
    if (hiver && !S.feuille.persistant) return out;
    const tailleMax = S.hauteur || 10;
    const cr0 = (PORT && PORT.couronne) || { rx: (S.largeur || 6) * .34, ry: tailleMax * .4, cy: tailleMax * .58 };
    const qOf = p => {
      const dx = p.x / cr0.rx, dy = (p.y - cr0.cy) / cr0.ry, dz = p.z / cr0.rx;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    // cible globale : la longueur totale de ramure décide de la densité
    const cible = (S.feuillesCible || 5000) * densite * (opts.qualite === undefined ? 1 : opts.qualite) * (opts.feuilles === undefined ? 1 : opts.feuilles);
    let poidsTotal = 0;
    const sac = [];
    for (const b of branches) {
      if (b.root) continue;
      if (!b.twig && b.depth < (PORT.levels - 4)) continue;
      const len = polyLength(b.pts);
      const w = len * (b.twig ? 6.5 : 1);
      poidsTotal += w;
      sac.push([b, w]);
    }
    if (!poidsTotal) return out;
    for (const [b, w] of sac) {
      const len = polyLength(b.pts);
      const n = Math.max(1, Math.round(cible * w / poidsTotal));
      for (let i = 0; i < n; i++) {
        const t = rng.range(.05, 1);
        const at = polyAt(b.pts, t);
        // les feuilles se massent en périphérie de la couronne (lumière), mais
        // le cœur reste habillé : un arbre n'est pas creux
        if (rng() > .58 + .42 * clamp(qOf(at.p), 0, 1.1)) continue;
        // orientation : vers l'extérieur et vers le haut (phototropisme)
        const out3 = at.p.clone().setY(0).normalize();
        const dir = at.dir.clone().multiplyScalar(.40)
          .addScaledVector(out3, .50)
          .addScaledVector(UP, .45 + rng.range(-.25, .2))
          .addScaledVector(rng.dir(), .38).normalize();
        const size = taille * rng.range(.78, 1.25) * (b.depth >= PORT.levels ? 1.06 : .92);
        // lumière reçue : la périphérie de la couronne est baignée de soleil
        const q = qOf(at.p);
        const light = clamp(.26 + .58 * clamp(q, 0, 1.15) + .3 * (at.p.y / tailleMax), .14, 1.2);
        const teinte = coul.teintes;
        const c = coul.base.clone()
          .offsetHSL(rng.range(-.025, .025) * teinte[2], rng.range(-.06, .06), rng.range(-.05, .05) + (light - .6) * .16);
        c.multiplyScalar(lerp(.62, 1.18, clamp(light, 0, 1)));
        out.push({
          p: at.p.clone().addScaledVector(rng.dir(), len * .04 + taille * .3),
          dir, roll: rng() * TAU, s: size, c
        });
      }
    }
    // brassage pour que les instances voisines varient
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* --- fleurs ------------------------------------------------------------ */
  function flowerInstances(S, PORT, branches, rng, qual, season) {
    const out = [];
    if (!S.fleur) return out;
    const n = Math.round((S.fleur.n || 200) * qual * (season === 'printemps' ? 1 : season === 'ete' ? .55 : .12));
    const couleurs = (S.fleur.couleurs || [S.fleur.couleur]).map(c => new THREE.Color(c));
    const cand = branches.filter(b => b.depth >= Math.max(1, PORT.levels - 3) && !b.root);
    const liste = cand.length ? cand : branches;
    for (let i = 0; i < n; i++) {
      const b = liste[Math.floor(rng() * liste.length)];
      const at = polyAt(b.pts, rng.range(.12, 1));
      const taille = (S.fleur.taille || .1) * rng.range(.75, 1.25) * (S.forme === 'arbuste' ? 1 : 1);
      const out3 = at.p.clone().setY(0).normalize();
      const dir = rng.dir().multiplyScalar(.6).addScaledVector(out3, .3).addScaledVector(UP, .4).normalize();
      out.push({
        p: at.p.clone().addScaledVector(rng.dir(), .04), dir, roll: rng() * TAU, s: taille,
        c: couleurs[Math.floor(rng() * couleurs.length)].clone().offsetHSL(0, 0, rng.range(-.05, .05))
      });
    }
    return out;
  }

  /* ===========================================================================
     7. EXPORTS
     ======================================================================== */
  const API = {
    version: '2.0',
    RNG, ESPECES, buildTree, mergeGeometries, tube, leafCanvas, barkTexture, sprayCanvas,
    flowerCanvas, groundCanvas, soilCanvas, stoneCanvas, woodCanvas, cloudCanvas,
    frondCanvas, tuftCanvas,
    memo, finish, gray, paintGeo, fruitGeometry, crossPlanes, depthFor,
    feuilleCouleur, polyAt, polyLength, clamp, lerp, smooth, shade, hexToRgba,
    TEX: { leafTex, barkTex, sprayTex },
    _skeleton: skeleton, _seedOf: seedOf,
    liste: () => Object.keys(ESPECES).map(k => ESPECES[k]),
    parForme: f => Object.keys(ESPECES).filter(k => ESPECES[k].forme === f).map(k => ESPECES[k])
  };
  return API;
})();
