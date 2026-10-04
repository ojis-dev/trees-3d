/* =============================================================================
   jardin.js — Le jardin : plan, plantation, décor
   -----------------------------------------------------------------------------
   Un parc d'environ 60 m de côté, organisé en scènes paysagères :
     · la grande pelouse centrale et son chêne centenaire,
     · l'allée de gravier qui serpente du premier plan vers le fond,
     · la pièce d'eau au saule pleureur,
     · le bosquet de conifères et sa lisière,
     · le coin japonais (érable, rochers, fougères, cheveux d'ange),
     · le verger et le carré des fleurs (cerisiers, lilas, hortensias),
     · les haies taillées qui dessinent les chambres du jardin.

   Les essences sont plantées par ordre d'importance : les premiers arbres
   étant les plus détaillés, chaque plantation successive est plus légère.
   ========================================================================== */
window.JARDIN = (function () {
  'use strict';
  const A = window.ARBRES;

  /* --- plan de plantation ------------------------------------------------
     x, z en mètres, e = échelle, q = qualité de construction (0→1.5)       */
  const PLAN = [
    /* --- arbres majeurs, au premier plan du regard ---------------------- */
    { id: 'chene', x: -7, z: -2, e: 1.12, q: 1.05, rot: 0.4, vedette: true, note: 'Le chêne centenaire, cœur du jardin' },
    { id: 'hetre', x: 9, z: -16, e: 1.05, q: .95, rot: 2.1, vedette: true, note: 'Hêtre pourpre, l’ombrage du fond' },
    { id: 'tilleul', x: -14, z: -18, e: 1.02, q: .9, rot: 4.0 },
    { id: 'bouleau', x: -24, z: 4, e: 1.0, q: .85, rot: .8, vedette: true, note: 'Groupe de bouleaux argentés' },
    { id: 'bouleau', x: -21.5, z: 6.5, e: .88, q: .8, rot: 2.6 },
    { id: 'bouleau', x: -25.5, z: 8, e: .78, q: .8, rot: 5.1 },
    { id: 'saule', x: 19, z: -9, e: 1.05, q: .95, rot: 1.2, vedette: true, note: 'Le saule de la pièce d’eau' },
    { id: 'cerisier', x: 22, z: 10, e: 1.0, q: .9, rot: 3.3, vedette: true, note: 'Le cerisier du printemps' },
    { id: 'erable', x: -17, z: 12, e: 1.05, q: .95, rot: .9, vedette: true, note: 'Coin japonais : érable, rochers, fougères' },
    { id: 'pommier', x: 13, z: 16, e: 1.0, q: .85, rot: 1.7 },
    { id: 'pommier', x: 17.5, z: 18, e: .9, q: .8, rot: 4.4 },
    { id: 'pommier', x: 9.5, z: 19.5, e: .95, q: .8, rot: 2.9 },
    { id: 'olivier', x: 25, z: -16, e: 1.05, q: .9, rot: 5.6, vedette: true, note: 'Terrasse méditerranéenne : olivier et cheveux d’ange' },
    { id: 'olivier', x: 28, z: -12.5, e: .82, q: .8, rot: 1.1 },
    { id: 'hetre', x: -30, z: -12, e: .95, q: .75, rot: 3.8 },
    { id: 'tilleul', x: 2, z: -28, e: 1.0, q: .8, rot: 5.5 },

    /* --- conifères : la lisière du nord ---------------------------------- */
    { id: 'epicea', x: -34, z: -26, e: 1.0, q: .85, rot: .5, vedette: true, note: 'Le bosquet de conifères' },
    { id: 'epicea', x: -28, z: -32, e: .82, q: .7, rot: 2.2 },
    { id: 'epicea', x: -38, z: -18, e: .9, q: .7, rot: 4.7 },
    { id: 'pin', x: -40, z: -34, e: 1.0, q: .8, rot: 1.9, vedette: true, note: 'Le pin parasol, silhouette du nord' },
    { id: 'pin', x: -45, z: -27, e: .85, q: .7, rot: 3.6 },
    { id: 'cypres', x: 30, z: -30, e: 1.05, q: .85, rot: .3 },
    { id: 'cypres', x: 33, z: -26, e: .95, q: .8, rot: 2.8 },
    { id: 'cypres', x: 27.5, z: -33, e: .88, q: .7, rot: 4.1 },
    { id: 'cypres', x: 36, z: -31.5, e: 1.0, q: .75, rot: 5.9 },

    /* --- arbres de second plan ------------------------------------------- */
    { id: 'bouleau', x: 34, z: 6, e: .9, q: .7, rot: 1.5 },
    { id: 'hetre', x: -44, z: 6, e: .9, q: .65, rot: 2.4 },
    { id: 'tilleul', x: 42, z: -14, e: .95, q: .65, rot: 3.1 },
    { id: 'chene', x: 44, z: 12, e: .85, q: .6, rot: 5.2 },
    { id: 'erable', x: -42, z: 22, e: .9, q: .6, rot: 2.0 },
    { id: 'epicea', x: -50, z: -8, e: .95, q: .6, rot: .9 },
    { id: 'saule', x: 34, z: -20, e: .8, q: .6, rot: 3.4 },

    /* --- arbustes : lilas, hortensias, haies vives ----------------------- */
    { id: 'lilas', x: -3.5, z: 13, e: 1.05, q: .8, rot: .6 },
    { id: 'lilas', x: 2, z: 15.5, e: .9, q: .7, rot: 2.3 },
    { id: 'lilas', x: -9, z: 16, e: .95, q: .7, rot: 3.9 },
    { id: 'lilas', x: 20, z: -1, e: .85, q: .7, rot: 5.4 },
    { id: 'hortensia', x: -20.5, z: 14.5, e: 1.0, q: .7, rot: 1.1 },
    { id: 'hortensia', x: -18.5, z: 16.5, e: .85, q: .65, rot: 2.7 },
    { id: 'hortensia', x: -22.5, z: 17, e: .9, q: .65, rot: 4.3 },
    { id: 'hortensia', x: -22, z: 12.5, e: .8, q: .6, rot: 0.2 },
    { id: 'hortensia', x: 25.5, z: 13, e: .9, q: .6, rot: 3.7 },
    { id: 'hortensia', x: -16, z: 6.5, e: .8, q: .6, rot: 5.0 },
    { id: 'lilas', x: -14.5, z: 4.5, e: .75, q: .6, rot: .3 },

    /* --- sous-bois : fougères et graminées ------------------------------- */
    { id: 'fougere', x: -14, z: 8, e: 1.2, q: .7, rot: 0 },
    { id: 'fougere', x: -15.5, z: 9.6, e: 1.0, q: .7, rot: 1.4 },
    { id: 'fougere', x: -12.5, z: 10.4, e: 1.15, q: .7, rot: 2.9 },
    { id: 'fougere', x: -18.5, z: 9, e: .9, q: .65, rot: 4.2 },
    { id: 'fougere', x: -42, z: 20, e: 1.3, q: .6, rot: 0.7 },
    { id: 'fougere', x: -40, z: 22, e: 1.1, q: .6, rot: 3.3 },
    { id: 'fougere', x: 12, z: -14, e: 1.1, q: .6, rot: 5.1 },
    { id: 'fougere', x: 14.5, z: -12, e: .95, q: .6, rot: 1.9 },
    { id: 'fougere', x: -36, z: -14, e: 1.2, q: .55, rot: 2.6 },
    { id: 'fougere', x: -38.5, z: -11.5, e: 1.0, q: .55, rot: 4.8 },
    { id: 'fougere', x: 30, z: -6, e: 1.1, q: .55, rot: 0.9 },
    { id: 'fougere', x: 31.5, z: -8.5, e: .9, q: .55, rot: 3.0 },
    { id: 'fougere', x: 1.5, z: -22, e: 1.25, q: .55, rot: 1.6 },
    { id: 'fougere', x: -1.5, z: -23.5, e: 1.0, q: .55, rot: 5.7 },
    { id: 'stipa', x: 24, z: -18.5, e: 1.15, q: .6, rot: 0 },
    { id: 'stipa', x: 26.5, z: -19.5, e: 1.0, q: .6, rot: 1.2 },
    { id: 'stipa', x: 23, z: -21, e: .9, q: .55, rot: 2.4 },
    { id: 'stipa', x: 27.5, z: -17.5, e: 1.05, q: .55, rot: 3.6 },
    { id: 'stipa', x: -11, z: 18, e: 1.1, q: .55, rot: 4.8 },
    { id: 'stipa', x: -8, z: 19.5, e: .95, q: .5, rot: 5.9 },
    { id: 'stipa', x: -13, z: 20.5, e: 1.05, q: .5, rot: 0.6 },
    { id: 'stipa', x: 20, z: 4, e: 1.0, q: .5, rot: 1.8 },
    { id: 'stipa', x: 22.5, z: 2.5, e: .9, q: .5, rot: 3.1 },
    { id: 'stipa', x: 17.5, z: 2, e: 1.05, q: .5, rot: 4.5 },
    { id: 'stipa', x: -26, z: 12, e: 1.1, q: .5, rot: 5.7 },
    { id: 'stipa', x: -28.5, z: 10, e: .95, q: .45, rot: 0.8 },
    { id: 'stipa', x: 38, z: -4, e: 1.05, q: .45, rot: 2.1 },
    { id: 'stipa', x: 36, z: -6.5, e: .9, q: .45, rot: 3.4 },
    { id: 'stipa', x: 6, z: 22, e: 1.0, q: .45, rot: 4.7 },
    { id: 'stipa', x: 3.5, z: 23.5, e: .95, q: .4, rot: 5.8 }
  ];

  /* --- lisière boisée : ferme l'horizon sans alourdir la scène ---------
     Générée autour du jardin, elle donne l'échelle et la profondeur ; les
     sujets sont volontairement traités en détail minimal.                  */
  function planLisiere(rng) {
    const melange = [
      ['chene', 1.0], ['hetre', .95], ['bouleau', .9], ['tilleul', .9], ['erable', .8],
      ['epicea', 1.05], ['pin', 1.0], ['cypres', .9], ['saule', .85], ['pommier', .8],
      ['lilas', .7], ['fougere', .8], ['stipa', .7], ['hortensia', .7]
    ];
    const out = [];
    const n = 34;
    for (let i = 0; i < n; i++) {
      const az = i / n * Math.PI * 2 + rng.range(-.10, .10);
      // plus dense au nord (z négatif), plus aérée au sud
      const nord = Math.cos(az) < 0 ? 1 : 0;
      const r = 50 + rng.range(0, 16) + nord * 4;
      const x = Math.sin(az) * r, z = -Math.cos(az) * r;
      const choix = melange[Math.floor(rng() * melange.length)];
      out.push({
        id: choix[0], x: +x.toFixed(1), z: +z.toFixed(1),
        e: +(choix[1] * rng.range(.75, 1.15)).toFixed(2),
        q: rng.range(.3, .45), rot: rng() * Math.PI * 2, lisiere: true
      });
    }
    // quelques sujets isolés dans la grande pelouse de l'ouest
    for (const p of [[-33, 14, 'erable', .95], [-36, 26, 'chene', .9], [-30, 30, 'sorbier', 0], [-46, 14, 'bouleau', .85]]) {
      if (!A.ESPECES[p[2]]) continue;
      out.push({ id: p[2], x: p[0], z: p[1], e: p[3], q: .4, rot: rng() * Math.PI * 2, isole: true });
    }
    return out;
  }

  /* --- bordures de buis taillées ---------------------------------------- */
  const HAIES = [
    { de: [-4, 22], a: [8, 22], l: 1.15, h: 1.05 },
    { de: [-24, 24], a: [-10, 24], l: 1.0, h: .95 },
    { de: [16, -24], a: [30, -24], l: 1.1, h: 1.15 },
    { de: [32, 18], a: [32, 8], l: 1.0, h: 1.0 },
    { de: [-44, 0], a: [-44, -12], l: 1.2, h: 1.3 }
  ];

  /* --- rochers ----------------------------------------------------------- */
  function planRochers() {
    const r = A.RNG(97531);
    const liste = [];
    for (let i = 0; i < 9; i++) {           // coin japonais
      const a = i / 9 * Math.PI * 2;
      liste.push({
        x: -17 + Math.cos(a) * (2.2 + r() * 1.4), z: 12 + Math.sin(a) * (1.8 + r() * 1.2),
        y: .25, rx: .8 + r() * .9, ry: .5 + r() * .7, rz: .7 + r() * .8, seed: r() * 10, detail: 2
      });
    }
    for (let i = 0; i < 14; i++) {          // berges de l'étang
      const a = i / 14 * Math.PI * 2 + .4;
      liste.push({
        x: 19 + Math.cos(a) * (4.4 + r() * .8), z: -9 + Math.sin(a) * (3.2 + r() * .6),
        y: .2, rx: .5 + r() * .8, ry: .35 + r() * .5, rz: .5 + r() * .7, seed: r() * 10
      });
    }
    for (let i = 0; i < 11; i++) {          // pierres dispersées
    const a = r() * Math.PI * 2, d = 12 + r() * 32;
      liste.push({
        x: Math.cos(a) * d, z: Math.sin(a) * d, y: .1,
        rx: .35 + r() * .6, ry: .25 + r() * .45, rz: .3 + r() * .55, seed: r() * 10, detail: 1
      });
    }
    return liste;
  }

  const ALLEE = [
    [1.5, 30], [0.5, 24], [-1.5, 17], [-2.5, 10], [-1, 3], [1.5, -3],
    [2.5, -10], [1, -17], [0, -24], [1, -31], [3, -37]
  ];

  /* --- construction ------------------------------------------------------ */
  function construire(moteur, opts) {
    opts = opts || {};
    MOTEUR = moteur;
    const rng = A.RNG(opts.seed || 777);
    const qualite = opts.qualite === undefined ? .75 : opts.qualite;
    const force = opts.force || 1;
    const detail = opts.detail === undefined ? 1 : opts.detail;

    const decor = new THREE.Group();
    decor.name = 'decor-jardin';
    moteur.scene.add(decor);

    // allée, eau, rochers, haies
    decor.add(window.ARBRES_UI.creerAllee(ALLEE, 2.6, qualite));
    const eau = window.ARBRES_UI.creerEau(19, -9, 5.2, 3.8,
      window.ARBRES_UI.AMBIANCES[moteur.ambiance] || window.ARBRES_UI.AMBIANCES.jour, qualite);
    decor.add(eau);
    decor.add(window.ARBRES_UI.creerRochers(planRochers(), A.RNG(13)));
    for (const h of HAIES) {
      decor.add(window.ARBRES_UI.creerHaie(h.de, h.a, h.l, h.h, rng));
    }
    // massifs de fleurs : plaques de couleur sous les arbustes
    decor.add(massifs(rng, qualite));

    // Plantation incrémentale : le jardin pousse sous les yeux. Le niveau de
    // détail suit l'éloignement — les sujets du premier plan sont les plus fins.
    const liste = PLAN.concat(planLisiere(A.RNG(opts.seed || 777) )).sort((a, b) => (b.q || 1) - (a.q || 1));
    let i = 0;
    const arbres = [];
    const etape = () => {
      const fin = performance.now() + (opts.budget === undefined ? 26 : opts.budget);
      while (i < liste.length && performance.now() < fin) {
        const p = liste[i++];
        const esp = A.ESPECES[p.id];
        const d = Math.hypot(p.x, p.z);
        const petit = esp.forme === 'rosette' || esp.forme === 'volume';
        // trois paliers de détail selon la distance et l'importance du sujet
        let palier;
        if (petit) palier = 'petit';
        else if (p.vedette || (d < 16 && (p.q || .8) >= .8)) palier = 'heros';
        else if (d < 34) palier = 'moyen';
        else palier = 'fond';
        const niveaux = esp.port && esp.port.levels
          ? esp.port.levels - (palier === 'heros' ? 1 : palier === 'moyen' ? 2 : 3) : undefined;
        const rgl = {
          heros: { q: .85, feuilles: .62, rameaux: 2, segments: [3, 4] },
          moyen: { q: .55, feuilles: .56, rameaux: 2, segments: [2, 3] },
          fond: { q: .4, feuilles: .46, rameaux: 1, segments: [2, 2] },
          petit: { q: .5, feuilles: .8, rameaux: 2, segments: [2, 3] }
        }[palier];
        const g = moteur.planter(p.id, {
          x: p.x, z: p.z, rotation: p.rot,
          qualite: rgl.q * qualite * force * (p.q || 1), echelle: p.e,
          niveaux: niveaux, rameaux: rgl.rameaux,
          rapide: palier === 'fond',
          segmentsFeuille: rgl.segments,
          feuilles: petit ? detail : rgl.feuilles * detail,
          densite: petit ? 1 : .9
        });
        g.userData.palier = palier;
        g.userData.vedette = !!p.vedette;
        g.userData.note = p.note || '';
        g.userData.plan = p;
        arbres.push(g);
      }
      if (opts.onProgres) opts.onProgres(Math.min(1, i / liste.length), i, liste.length, arbres[arbres.length - 1]);
      if (i < liste.length) return requestAnimationFrame(etape);
      if (opts.onFini) opts.onFini(arbres);
    };
    requestAnimationFrame(etape);
    return { decor, arbres, plan: liste, eau, total: liste.length };
  }

  // plaques de fleurs (massifs) : disques texturés posés au sol
  function massifs(rng, qualite) {
    const g = new THREE.Group();
    const N = Math.round(26 * qualite);
    const geo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    const familles = [
      { c: '#e8d24f', n: 'jaune', taille: .34 }, { c: '#e88fb0', n: 'rose', taille: .30 },
      { c: '#8f9ee0', n: 'bleu', taille: .32 }, { c: '#f0f0e0', n: 'blanc', taille: .26 }
    ];
    familles.forEach((f, k) => {
      const tex = A.memo('massif:' + f.n, () => A.finish(A.flowerCanvas({
        type: 'ombelle', couleur: f.c, clair: '#fffdf0', W: 256, H: 256, rayon: .4
      }, A.RNG(120 + k), 256, 256), 1, 1));
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .35, side: THREE.DoubleSide, roughness: .85 });
      const im = new THREE.InstancedMesh(geo, mat, Math.ceil(N / 4));
      const o = new THREE.Object3D();
      for (let i = 0; i < Math.ceil(N / 4); i++) {
        const a = rng() * Math.PI * 2, d = 8 + rng() * 30;
        o.position.set(Math.cos(a) * d, .05, Math.sin(a) * d);
        o.rotation.set(0, rng() * Math.PI, 0);
        o.scale.setScalar(.6 + rng() * 1.1);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      g.add(im);
    });
    return g;
  }

  let MOTEUR = null;

  /* --- sélection d'un arbre au pointeur -------------------------------
     Distance minimale entre le rayon de la caméra et le segment vertical
     qui représente chaque arbre : rapide, stable et suffisant pour viser. */
  function arbreSousPointeur(moteur, clientX, clientY) {
    const rect = moteur.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, moteur.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const v = new THREE.Vector3(), w0 = new THREE.Vector3(), q = new THREE.Vector3();
    let meilleur = null, meilleurD = Infinity;
    for (const t of moteur.arbres.children) {
      const id = t.userData.especeId;
      if (!id) continue;
      const esp = A.ESPECES[id];
      const ech = t.scale.x || 1;
      const h = (esp.hauteur || 6) * ech;
      v.set(0, h, 0);                                   // segment base → sommet
      w0.set(t.position.x - o.x, t.position.y - o.y, t.position.z - o.z);
      const b1 = d.dot(v), c1 = v.dot(v), d1 = d.dot(w0), e1 = v.dot(w0);
      const denom = c1 - b1 * b1;
      let sc = denom > 1e-6 ? (b1 * d1 - e1) / denom : 0;
      sc = A.clamp(sc, 0, 1);
      q.copy(w0).addScaledVector(v, sc);                 // point du segment le plus proche
      if (q.dot(d) < 0) continue;                        // derrière la caméra
      const dist = Math.hypot(
        q.y * d.z - q.z * d.y,
        q.z * d.x - q.x * d.z,
        q.x * d.y - q.y * d.x
      );                                                 // |q × d| avec d unitaire
      const seuil = Math.max(1.1, (esp.largeur || 4) * .5 * ech * .55);
      if (dist < seuil && dist < meilleurD) { meilleurD = dist; meilleur = t; }
    }
    return meilleur;
  }

  return {
    construire, arbreSousPointeur, PLAN, HAIES, ALLEE, planLisiere,
    /** essences présentes au jardin, dans l'ordre d'apparition */
    essences: () => {
      const vus = [];
      for (const p of PLAN) if (!vus.includes(p.id)) vus.push(p.id);
      return vus;
    }
  };
})();
