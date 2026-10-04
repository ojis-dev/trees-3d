/* =============================================================================
   arbres-ui.js — Moteur de scène partagé : ciel, lumière, sol, caméra, vent
   -----------------------------------------------------------------------------
   Fournit à toutes les pages du site :
     · un ciel dégradé avec soleil dessiné par shader,
     · quatre ambiances (aube, jour, coucher, nuit) et quatre saisons,
     · un terrain herbeux avec ses détails (mottes, cailloux, pâquerettes,
       feuilles mortes en automne), eau, allées de gravier, rochers, haies,
     · une caméra orbitale douce (glisser, molette, pincement, clavier),
     · un vent cohérent appliqué à tous les végétaux,
     · une boucle de rendu avec ombres et performance adaptative.
   ========================================================================== */
window.ARBRES_UI = (function () {
  'use strict';
  const A = window.ARBRES;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const TAU = Math.PI * 2;
  const clamp = A.clamp, lerp = A.lerp;

  /* ===========================================================================
     0 bis. ICÔNES VECTORIELLES
     ---------------------------------------------------------------------------
     Aucune police d'émoji n'est requise : chaque icône est un tracé SVG écrit
     ici même, à la couleur du texte (currentColor). Le rendu est donc identique
     sur tous les systèmes, et rien ne dépend du réseau.
     ======================================================================== */
  const ICONES = {
    arbre: '<circle cx="12" cy="9" r="6"/><circle cx="8.4" cy="12.4" r="3.6"/><circle cx="15.6" cy="12.4" r="3.6"/><rect x="10.9" y="13" width="2.2" height="8" rx="1.1"/>',
    arbreOvale: '<ellipse cx="12" cy="9.6" rx="5.4" ry="6.6"/><rect x="10.9" y="14.8" width="2.2" height="6.2" rx="1.1"/><path d="M8.4 21h7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    bouleau: '<ellipse cx="12" cy="8.8" rx="4.1" ry="5.8"/><rect x="11.2" y="13.4" width="1.6" height="7.6" rx=".8"/><rect x="9.2" y="15.6" width="2.2" height="1" rx=".5"/><rect x="12.6" y="17.8" width="2.2" height="1" rx=".5"/>',
    erable: '<path d="M12 2.6l2 3.2 3.8-1-1 3.5 3.5 2.2-3.9 1.5 1.2 3.8-3.7-2.1-1.9 4.4-1.9-4.4-3.7 2.1 1.2-3.8-3.9-1.5 3.5-2.2-1-3.5 3.8 1z"/><rect x="11.2" y="17.4" width="1.6" height="4.2" rx=".8"/>',
    feuille: '<path d="M12 2.6c4.1 3 6.2 6.5 6.2 10.1 0 3.6-2.8 6.3-6.2 6.3V2.6z"/><path d="M12 2.6c-4.1 3-6.2 6.5-6.2 10.1 0 3.6 2.8 6.3 6.2 6.3V2.6z" opacity=".62"/><rect x="11.2" y="18.4" width="1.6" height="3.2" rx=".8"/>',
    fleur: '<circle cx="12" cy="7.2" r="3.2"/><circle cx="16.6" cy="10.5" r="3.2"/><circle cx="14.8" cy="15.8" r="3.2"/><circle cx="9.2" cy="15.8" r="3.2"/><circle cx="7.4" cy="10.5" r="3.2"/><circle cx="12" cy="11.5" r="2" opacity=".45"/>',
    grappe: '<circle cx="12" cy="3.4" r="1.8"/><circle cx="9.9" cy="7.2" r="1.8"/><circle cx="14.1" cy="7.2" r="1.8"/><circle cx="12" cy="7.2" r="1.8"/><circle cx="8.2" cy="11.1" r="1.8"/><circle cx="11.1" cy="11.1" r="1.8"/><circle cx="14.9" cy="11.1" r="1.8"/><circle cx="10" cy="15" r="1.8"/><circle cx="14" cy="15" r="1.8"/><circle cx="12" cy="18.9" r="1.8"/><path d="M12 21v1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    ombelle: '<circle cx="12" cy="12" r="9.2" opacity=".22"/><circle cx="12" cy="6.6" r="2.3"/><circle cx="17.4" cy="10.4" r="2.3"/><circle cx="15.3" cy="16.6" r="2.3"/><circle cx="8.7" cy="16.6" r="2.3"/><circle cx="6.6" cy="10.4" r="2.3"/><circle cx="12" cy="12" r="2.5" opacity=".5"/>',
    pomme: '<path d="M12 8.5c1.2-1 2.4-1.5 3.5-1.5 2.7 0 4.7 2.4 4.7 5.6 0 3.9-2.8 7.4-5.3 7.4-.9 0-1.7-.5-2.9-.5s-2 .5-2.9.5C6.6 20 3.8 16.5 3.8 12.6 3.8 9.4 5.8 7 8.5 7c1.1 0 2.3.5 3.5 1.5z"/><path d="M12 7.4c0-2 1.3-3.5 3.2-3.8.1 2-1.3 3.5-3.2 3.8z"/>',
    olive: '<path d="M3 14.4C7.6 13.4 11.4 10.8 14.2 6.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="7.2" cy="17" r="2.7"/><circle cx="11.4" cy="13.6" r="2.7"/><circle cx="15.2" cy="9.4" r="2.7"/><ellipse cx="18.8" cy="4.6" rx="1.4" ry="2.6" transform="rotate(38 18.8 4.6)"/>',
    saule: '<rect x="11.2" y="4" width="1.6" height="18" rx=".8"/><ellipse cx="12" cy="6.6" rx="6.4" ry="4.4"/><path d="M6.2 8.4c-.4 4-.6 7.4-.4 10.6M8.6 9.6c-.3 3.6-.4 6.6-.2 9M12 10.4v10M15.4 9.6c.3 3.6.4 6.6.2 9M17.8 8.4c.4 4 .6 7.4.4 10.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    conifere: '<path d="M12 2.2l3.3 5.2H8.7z"/><path d="M12 6.6l4.3 6.4H7.7z"/><path d="M12 11.4l5.3 7.4H6.7z"/><rect x="11.1" y="18.4" width="1.8" height="3.4" rx=".7"/>',
    fougere: '<path d="M12.6 21.4C12 14.4 13.6 8.4 19.4 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.4 17.8c2.7-.2 4.6-1.5 5.8-3.6M12.8 14.2c2.9-.2 4.9-1.5 6.3-3.8M12.6 10.6c2.9-.2 5-1.6 6.5-3.9M14.2 20.2c1.9-.3 3.4-1.1 4.5-2.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    graminee: '<path d="M4.6 21c1.3-6.6 2-11.2 3.6-15.2M9.4 21c.5-7 .8-11.6 2-16M14 21c-.7-6.2-.5-10.6.7-14.4M18.6 21c-1.8-5.8-2.7-9.6-3-13.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M17.6 7.6c1.3-.6 2.2-1.7 2.6-3.2M18.2 8c1.5.2 2.7-.3 3.4-1.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
    boule: '<circle cx="12" cy="8.4" r="5.9"/><rect x="11.1" y="14" width="1.8" height="6" rx=".9"/><path d="M7 21.2h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    aube: '<path d="M3.2 16h17.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 4.6a5.6 5.6 0 0 1 5.6 5.6V16H6.4v-5.8A5.6 5.6 0 0 1 12 4.6z"/><path d="M12 1.2v1.9M7 3.3l1.3 1.3M17 3.3l-1.3 1.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    jour: '<circle cx="12" cy="12" r="4.6"/><path d="M12 2.4v2.6M12 19v2.6M2.4 12H5M19 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    coucher: '<path d="M2.6 17.4h18.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="11.6" r="5.4"/><path d="M4.4 4.6l1.8 1.8M19.6 4.6l-1.8 1.8M12 1.4v2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    nuit: '<path d="M20.2 14.8A8.8 8.8 0 0 1 9.2 3.8 9 9 0 1 0 20.2 14.8z"/><path d="M17 3.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    automne: '<g transform="rotate(20 12 12)"><path d="M12 3c3.8 2.9 5.8 6.2 5.8 9.6 0 3.4-2.6 6-5.8 6s-5.8-2.6-5.8-6C6.2 9.2 8.2 5.9 12 3z"/></g><circle cx="5.8" cy="19.4" r="1.4"/><circle cx="9.4" cy="21.2" r="1"/>',
    hiver: '<path d="M12 2.6v18.8M4.4 7.2l15.2 9.6M19.6 7.2L4.4 16.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="2"/>',
    rapide: '<path d="M13.8 2.4L5.2 13.4h5.2l-1 8.2 8.6-11.2h-5.4z"/>',
    diamant: '<path d="M7.6 3.6h8.8L20.6 9 12 20.4 3.4 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.6 9h16.8M9.6 3.8 7.6 9l4.4 10.8L16.4 9l-2-5.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    vent: '<path d="M2.8 8.6h11.4a3.1 3.1 0 1 0-3.1-3.1M2.8 15.4h8.6a3.1 3.1 0 1 1-3.1 3.1M2.8 12h14.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    oiseaux: '<path d="M2.4 14c2.4 0 4.2-1.4 5.4-4.2 1.2 2.8 3 4.2 5.4 4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M13.8 19.2c1.7 0 3-1 3.8-3 .8 2 2.1 3 3.8 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    tour: '<rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.2 9.2l5.4 2.8-5.4 2.8z"/>',
    repos: '<rect x="6" y="6" width="12" height="12" rx="2.8"/>',
    rotation: '<path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M18.8 2.6v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    pause: '<rect x="7" y="5" width="3.6" height="14" rx="1.3"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.3"/>',
    nouveau: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.6" cy="8.6" r="1.7"/><circle cx="15.4" cy="15.4" r="1.7"/><circle cx="12" cy="12" r="1.7"/>',
    souris: '<rect x="7" y="2.8" width="10" height="18.4" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 6.4v3.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    loupe: '<circle cx="10.6" cy="10.6" r="6.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.6 15.6l4.8 4.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
    pointeur: '<path d="M5.6 2.8l12.4 8.7-5.5.9 3.2 6.4-2.7 1.3-3.1-6.5-4.3 3.7z"/>',
    clavier: '<rect x="2.4" y="6" width="19.2" height="12" rx="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 9.6h1.4M10 9.6h1.4M14 9.6h1.4M17.8 9.6h1.2M6 13h.9M9.4 13h1.4M12.8 13h1.4M16.2 13h2.8M7.4 16h9.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    lecture: '<path d="M7.4 4.6l12 7.4-12 7.4z"/>',
    fermer: '<path d="M5.8 5.8l12.4 12.4M18.2 5.8L5.8 18.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };

  /** Icône vectorielle : renvoie le balisage SVG d'un tracé connu. */
  function icone(nom, taille) {
    const trace = ICONES[nom] || ICONES.feuille;
    const t = taille || '1em';
    return '<svg class="ico" viewBox="0 0 24 24" width="' + t + '" height="' + t +
      '" fill="currentColor" aria-hidden="true" focusable="false">' + trace + '</svg>';
  }


  /* ===========================================================================
     1. AMBIANCES ET SAISONS
     ======================================================================== */
  const AMBIANCES = {
    aube: {
      nom: 'Aube', icone: 'aube',
      soleil: { az: -0.62, elev: 0.17, couleur: 0xffd0a0, intensite: 1.5 },
      hemisphere: { ciel: 0xbfd4e8, sol: 0x4c5a42, intensite: 0.7 },
      ciel: { top: 0x2f4a7a, horizon: 0xf0b98a, bas: 0x6a6a5c },
      brume: { couleur: 0xd9c8b4, near: 30, far: 190 },
      exposition: 1.02, ombresDouces: true
    },
    jour: {
      nom: 'Plein jour', icone: 'jour',
      soleil: { az: 0.65, elev: 0.78, couleur: 0xfff2d8, intensite: 1.55 },
      hemisphere: { ciel: 0xdff0ff, sol: 0x5c6b4a, intensite: 0.85 },
      ciel: { top: 0x3d78c8, horizon: 0xc9e2f2, bas: 0x8fa07a },
      brume: { couleur: 0xcfe2ee, near: 45, far: 260 },
      exposition: 1.0
    },
    coucher: {
      nom: 'Coucher', icone: 'coucher',
      soleil: { az: 0.95, elev: 0.21, couleur: 0xff9a4e, intensite: 1.7 },
      hemisphere: { ciel: 0x8fa6cc, sol: 0x53422f, intensite: 0.6 },
      ciel: { top: 0x2a3f6b, horizon: 0xff9c5a, bas: 0x5a4636 },
      brume: { couleur: 0xe0a271, near: 25, far: 170 },
      exposition: 1.05
    },
    nuit: {
      nom: 'Nuit', icone: 'nuit',
      soleil: { az: -0.9, elev: 0.55, couleur: 0x9fb6ff, intensite: 0.55 },
      hemisphere: { ciel: 0x2b3c66, sol: 0x1d2418, intensite: 0.45 },
      ciel: { top: 0x090f22, horizon: 0x1d2b46, bas: 0x10160f },
      brume: { couleur: 0x1b2740, near: 20, far: 150 },
      exposition: 1.15, etoiles: true
    }
  };
  const SAISONS = {
    printemps: { nom: 'Printemps', icone: 'fleur', herbe: '#7fa54e', herbeSombre: '#4e6c2e' },
    ete: { nom: 'Été', icone: 'feuille', herbe: '#6f8f3f', herbeSombre: '#46602a' },
    automne: { nom: 'Automne', icone: 'automne', herbe: '#8d8b46', herbeSombre: '#5d5a2c' },
    hiver: { nom: 'Hiver', icone: 'hiver', herbe: '#8c9584', herbeSombre: '#5c6555' }
  };

  /* ===========================================================================
     2. CIEL
     ======================================================================== */
  const VERT_CIEL = `
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_Position.z = gl_Position.w * 0.999999;
    }`;
  const FRAG_CIEL = `
    varying vec3 vDir;
    uniform vec3 cTop, cHorizon, cBas, soleilDir, soleilCol;
    uniform float soleilTaille, halo, etoiles;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y, -1.0, 1.0);
      vec3 col = mix(cHorizon, cTop, pow(clamp(h, 0.0, 1.0), 0.62));
      col = mix(col, cBas, clamp(-h * 2.6, 0.0, 1.0));
      float s = max(dot(d, normalize(soleilDir)), 0.0);
      col += soleilCol * (pow(s, 1200.0) * 6.0 + pow(s, 9.0) * halo);
      if (etoiles > 0.5) {
        vec3 g = floor(d * 320.0);
        float n = hash(g);
        float e = smoothstep(0.9975, 1.0, n) * clamp(d.y * 3.0, 0.0, 1.0);
        col += vec3(e) * 1.4;
      }
      gl_FragColor = vec4(col, 1.0);
    }`;

  function creerCiel(ambiance, scene) {
    const geo = new THREE.SphereGeometry(600, 32, 20);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT_CIEL, fragmentShader: FRAG_CIEL, side: THREE.BackSide, depthWrite: false,
      uniforms: {
        cTop: { value: new THREE.Color(ambiance.ciel.top) },
        cHorizon: { value: new THREE.Color(ambiance.ciel.horizon) },
        cBas: { value: new THREE.Color(ambiance.ciel.bas) },
        soleilDir: { value: V(0, 1, 0) },
        soleilCol: { value: new THREE.Color(ambiance.soleil.couleur) },
        soleilTaille: { value: 1 },
        halo: { value: ambiance === AMBIANCES.nuit ? .25 : .55 },
        etoiles: { value: ambiance.etoiles ? 1 : 0 }
      }
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    scene.add(mesh);
    return mesh;
  }

  /* ===========================================================================
     3. TERRAIN ET DÉTAILS
     ======================================================================== */
  /* Hauteur du sol : la même formule sert à déformer le terrain ET à poser
     exactement dessus les arbres, l'allée, les rochers et les massifs. */
  function hauteurTerrain(x, z, reliefSol, zonesPlates, ondulation) {
    const ly = -z;                                   // le plan est tourné de -90°
    const o = ondulation || {};
    const amp = o.amplitude === undefined ? 1 : o.amplitude;
    const debut = o.debut === undefined ? 6 : o.debut;
    const fin = o.fin === undefined ? 26 : o.fin;
    const d = Math.hypot(x, ly);
    const bosse = Math.sin(x * .055) * Math.cos(ly * .048) * .55 +
      Math.sin(x * .013 + ly * .011) * 1.4;
    let h = bosse * amp * clamp((d - debut) / fin, 0, 1);
    if (reliefSol) h += reliefSol(x, ly);
    if (zonesPlates) for (const zn of zonesPlates) {
      const dd = Math.hypot(x - zn[0], z - zn[1]);
      const k = clamp((dd - zn[2] * .4) / (zn[2] * .6), 0, 1);
      h *= k * k * (3 - 2 * k);
    }
    return h;
  }

  function creerTerrain(opts, ambiance, saison, rng) {
    const q = opts.qualite === undefined ? 1 : opts.qualite;
    const S = SAISONS[saison] || SAISONS.ete;
    const group = new THREE.Group();
    const taille = opts.taille || 260;

    // la même toile est répétée plus ou moins selon la taille de la scène :
    // un sol de 340 m n'a pas intérêt à étirer 30 tuiles sur 11 m chacune
    const cvs = A.memo('sol-canevas:' + saison, () => A.groundCanvas({
      base: S.herbe, sombre: S.herbeSombre, clair: '#a8bf6c'
    }, A.RNG(4242)));
    const repet = Math.max(14, Math.round(taille / 4.2));
    const tex = A.finish(cvs, repet, repet);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .95, metalness: 0 });

    // une seule nappe de terrain, finement maillée : plus de facettes visibles
    const seg = Math.max(48, Math.min(220, Math.round(taille / 1.6)));
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(taille, taille, seg, seg), mat);
    const p = sol.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setZ(i, hauteurTerrain(p.getX(i), -p.getY(i), opts.reliefSol, opts.zonesPlates, opts.ondulation));
    }
    sol.geometry.computeVertexNormals();
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    group.add(sol);

    // touffes d'herbe hautes (bordures) : cartes croisées instanciées
    const nTouffes = Math.round((opts.touffes === undefined ? 900 : opts.touffes) * q);
    if (nTouffes) {
      const tTex = A.memo('herbe-touffe', () => A.finish(A.tuftCanvas({
        couleur: '#7d9a4a', sombre: '#4a6229', clair: '#b7cf7a', brins: 70
      }, A.RNG(88), 256, 256), 1, 1));
      const geo = A.crossPlanes();
      const m = new THREE.MeshStandardMaterial({ map: tTex, alphaTest: .45, side: THREE.DoubleSide, roughness: .9, metalness: 0 });
      const im = new THREE.InstancedMesh(geo, m, nTouffes);
      im.castShadow = false;
      const o = new THREE.Object3D();
      for (let i = 0; i < nTouffes; i++) {
        const a = rng() * TAU, r = opts.rayonDetail ? rng() * opts.rayonDetail : 8 + Math.sqrt(rng()) * (taille * .32);
        const x = Math.cos(a) * r + (opts.decalage ? opts.decalage.x : 0);
        const z = Math.sin(a) * r + (opts.decalage ? opts.decalage.z : 0);
        const s = .5 + rng() * 1.1;
        o.position.set(x, 0, z);
        o.rotation.y = rng() * TAU;
        o.scale.set(s, s * (.7 + rng() * .8), s);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, new THREE.Color(saison === 'hiver' ? '#8a9070' : saison === 'automne' ? '#a89a4e' : '#84a24a')
          .offsetHSL(0, rng() * .1 - .05, rng() * .16 - .08));
      }
      group.add(im);
    }

    // cailloux
    const nCailloux = Math.round((opts.cailloux === undefined ? 130 : opts.cailloux) * q);
    if (nCailloux) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const pp = geo.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const f = .75 + rng() * .5;
        pp.setXYZ(i, pp.getX(i) * f, pp.getY(i) * f * .7, pp.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const tex = A.memo('pierre', () => A.finish(A.stoneCanvas({ base: '#8f8b80', sombre: '#5b574e', clair: '#c2bdb0', mousse: true }, A.RNG(9)), 2, 2));
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: .92, metalness: 0, vertexColors: false });
      const im = new THREE.InstancedMesh(geo, m, nCailloux);
      im.castShadow = true; im.receiveShadow = true;
      const o = new THREE.Object3D();
      for (let i = 0; i < nCailloux; i++) {
        const a = rng() * TAU, r = 4 + Math.sqrt(rng()) * (taille * .3);
        o.position.set(Math.cos(a) * r, -.06 + rng() * .05, Math.sin(a) * r);
        o.rotation.set(rng() * TAU, rng() * TAU, rng() * TAU);
        const s = .1 + Math.pow(rng(), 2.2) * .55;
        o.scale.set(s * (1 + rng() * .6), s * (.5 + rng() * .5), s);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      group.add(im);
    }

    // pâquerettes au printemps et en été, feuilles mortes en automne
    if (saison === 'printemps' || saison === 'ete') {
      const n = Math.round(420 * q);
      const tex = A.memo('paquerette', () => A.finish(A.flowerCanvas({ type: 'rayon', couleur: '#ffffff', clair: '#fffdf4', coeur: '#e8c23c', petales: 9, rayon: .42, W: 128, H: 128 }, A.RNG(5), 128, 128), 1, 1));
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .4, side: THREE.DoubleSide, roughness: .8 });
      const im = new THREE.InstancedMesh(geo, m, n);
      const o = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = 5 + Math.sqrt(rng()) * (taille * .26);
        o.position.set(Math.cos(a) * r, .035 + rng() * .04, Math.sin(a) * r);
        o.rotation.set(0, rng() * TAU, 0);
        o.scale.setScalar(.07 + rng() * .05);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      group.add(im);
    }
    if (saison === 'automne' || saison === 'hiver') {
      const n = Math.round(700 * q);
      const tex = A.memo('feuille-morte', () => A.finish(A.leafCanvas({
        forme: 'lobee', lobes: 5, couleur: '#a8622a', sombre: '#6d3a16', clair: '#d59a4e', nervures: 5
      }, A.RNG(17), 192, 384), 1, 1));
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .4, side: THREE.DoubleSide, roughness: .9 });
      const im = new THREE.InstancedMesh(geo, m, n);
      const o = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = Math.sqrt(rng()) * (taille * .3);
        o.position.set(Math.cos(a) * r, .03, Math.sin(a) * r);
        o.rotation.set(0, rng() * TAU, 0);
        o.scale.setScalar(.1 + rng() * .1);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, new THREE.Color(saison === 'hiver' ? '#7b6a4a' : '#b0702c').offsetHSL(rng() * .04, rng() * .1, rng() * .16 - .08));
      }
      group.add(im);
    }
    return group;
  }

  /* --- pièce d'eau ------------------------------------------------------- */
  function creerEau(x, z, rx, rz, ambiance, qualite) {
    const g = new THREE.Group();
    const forme = new THREE.Shape();
    const n = 42;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU;
      const r = 1 + .12 * Math.sin(a * 3.1) + .07 * Math.cos(a * 5.3);
      const px = Math.cos(a) * rx * r, py = Math.sin(a) * rz * r;
      i === 0 ? forme.moveTo(px, py) : forme.lineTo(px, py);
    }
    const geo = new THREE.ShapeGeometry(forme, 24);
    geo.rotateX(-Math.PI / 2);
    const nuit = ambiance === AMBIANCES.nuit;
    const mat = new THREE.MeshStandardMaterial({
      color: nuit ? 0x16283a : 0x35626e,
      roughness: .06, metalness: 0, transparent: true, opacity: .86,
      emissive: new THREE.Color(ambiance.ciel.horizon).multiplyScalar(nuit ? .10 : .22),
      emissiveIntensity: 1
    });
    const eau = new THREE.Mesh(geo, mat);
    eau.position.set(x, .04, z);
    g.add(eau);

    // ceinture de roseaux et de pierres
    const rng = A.RNG(1234);
    const tex = A.memo('herbe-roseau', () => A.finish(A.tuftCanvas({ couleur: '#6f8a3e', sombre: '#3f5423', clair: '#b6c47a', brins: 60, epi: true }, A.RNG(21), 256, 512), 1, 1));
    const gr = A.crossPlanes();
    const mr = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .9 });
    const nR = Math.round(160 * (qualite || 1));
    const im = new THREE.InstancedMesh(gr, mr, nR);
    const o = new THREE.Object3D();
    for (let i = 0; i < nR; i++) {
      const a = i / nR * TAU + rng.range(-.06, .06);
      const r = 1 + .12 * Math.sin(a * 3.1) + .07 * Math.cos(a * 5.3);
      const s = .8 + rng() * .8;
      o.position.set(x + Math.cos(a) * rx * r * 1.02, .0, z + Math.sin(a) * rz * r * 1.02);
      o.rotation.set(0, rng() * TAU, 0);
      o.scale.set(s * .8, s * (1.1 + rng() * .7), s * .8);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    g.add(im);
    // nénuphars
    if (qualite > .4) {
      const tnd = A.memo('nenuphar', () => A.finish(A.leafCanvas({ forme: 'ovale', profil: .95, couleur: '#3f6b3a', sombre: '#22421f', clair: '#6f9a52', nervures: 6, morsures: true }, A.RNG(31), 128, 128), 1, 1));
      const gn = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
      const mn = new THREE.MeshStandardMaterial({ map: tnd, alphaTest: .35, side: THREE.DoubleSide, roughness: .6 });
      const nN = Math.round(14 * qualite);
      const imn = new THREE.InstancedMesh(gn, mn, nN);
      for (let i = 0; i < nN; i++) {
        o.position.set(x + rng.range(-1, 1) * rx * .6, .06, z + rng.range(-1, 1) * rz * .6);
        o.rotation.set(0, rng() * TAU, 0);
        o.scale.setScalar(.3 + rng() * .35);
        o.updateMatrix();
        imn.setMatrixAt(i, o.matrix);
      }
      g.add(imn);
    }
    return g;
  }

  /* --- allée de gravier le long d'une courbe ----------------------------- */
  function creerAllee(points, largeur, qualite) {
    const courbe = new THREE.CatmullRomCurve3(points.map(p => V(p[0], 0, p[1])), false, 'catmullrom', .5);
    const n = 120, pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = courbe.getPoint(t), tan = courbe.getTangent(t);
      const per = V(-tan.z, 0, tan.x).normalize();
      const w = largeur * (.85 + .3 * Math.sin(t * 9));
      for (let k = -1; k <= 1; k += 1) {
        const q = p.clone().addScaledVector(per, k * w * .5);
        pos.push(q.x, p.y + .02, q.z);
        nor.push(0, 1, 0);
        uv.push(k * .5 + .5, t * 22);
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const tex = A.memo('gravier', () => A.finish(A.stoneCanvas({ base: '#b8ad98', sombre: '#7d735f', clair: '#ded5c0', mousse: true }, A.RNG(77)), 3, 3));
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: .02, roughness: .95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /* --- rochers ----------------------------------------------------------- */
  function creerRochers(liste, rng) {
    const group = new THREE.Group();
    const tex = A.memo('rocher', () => A.finish(A.stoneCanvas({ base: '#8b8983', sombre: '#4f4d47', clair: '#c6c3b8', mousse: true }, A.RNG(3)), 2, 2));
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: .03, roughness: .93, metalness: 0 });
    for (const r of liste) {
      const geo = new THREE.IcosahedronGeometry(1, r.detail || 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const f = 1 + .18 * Math.sin(x * 3.1 + r.seed) * Math.cos(z * 2.7) + .1 * Math.sin(y * 4.3);
        p.setXYZ(i, x * f * r.rx, y * f * r.ry, z * f * r.rz);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(r.x, r.y === undefined ? r.ry * .45 : r.y, r.z);
      m.rotation.set(rng.range(-.2, .2), rng.range(0, TAU), rng.range(-.2, .2));
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }

  /* --- haies et topiaires ------------------------------------------------- */
  function creerHaie(depart, arrivee, largeur, hauteur, rng) {
    const longueur = Math.hypot(arrivee[0] - depart[0], arrivee[1] - depart[1]);
    const blocs = Math.max(2, Math.round(longueur / (largeur * .55)));
    const geo = new THREE.IcosahedronGeometry(.5, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = 1 + rng.gauss(0, .045) + .05 * Math.sin(x * 11) * Math.cos(z * 9);
      p.setXYZ(i, x * f, Math.max(-.5, y * f), z * f);
    }
    geo.computeVertexNormals();
    const tex = A.memo('feuille-buis', () => A.finish(A.leafCanvas({
      forme: 'ovale', profil: .72, couleur: '#3a5f28', sombre: '#1f3a17', clair: '#5f8a3c', nervures: 6, brillance: .2
    }, A.RNG(64), 128, 128), 5, 5));
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: .02, roughness: .88, metalness: 0 });
    const im = new THREE.InstancedMesh(geo, mat, blocs + 1);
    const o = new THREE.Object3D();
    const dx = (arrivee[0] - depart[0]) / blocs, dz = (arrivee[1] - depart[1]) / blocs;
    for (let i = 0; i <= blocs; i++) {
      o.position.set(depart[0] + dx * i + rng.range(-.05, .05) * largeur, hauteur * .5, depart[1] + dz * i + rng.range(-.05, .05) * largeur);
      o.rotation.set(0, rng.range(-.4, .4), 0);
      o.scale.set(largeur * (1 + rng() * .12), hauteur * (1 + rng() * .1), largeur * (1 + rng() * .12));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, new THREE.Color('#3f6b2c').offsetHSL(rng() * .03, rng() * .1, rng() * .12 - .06));
    }
    im.castShadow = im.receiveShadow = true;
    return im;
  }

  /* --- nuages ------------------------------------------------------------ */
  function creerNuages(ambiance, nombre, rng) {
    const group = new THREE.Group();
    const tex = A.memo('nuage', () => A.finish(A.cloudCanvas(A.RNG(2)), 1, 1));
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: .9, color: 0xffffff
    });
    const c = new THREE.Color(ambiance.ciel.horizon).lerp(new THREE.Color(0xffffff), .72);
    mat.color.copy(c);
    for (let i = 0; i < nombre; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: rng.range(.35, .8), color: c }));
      const a = rng() * TAU, r = 90 + rng() * 240;
      s.position.set(Math.cos(a) * r, 70 + rng() * 80, Math.sin(a) * r);
      const w = 90 + rng() * 160;
      s.scale.set(w, w * .45, 1);
      s.userData.vitesse = .4 + rng() * .8;
      group.add(s);
    }
    return group;
  }

  /* --- oiseaux ------------------------------------------------------------ */
  function creerOiseaux(nombre, rng) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2b2b30, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1.1, .28);
    geo.translate(.5, 0, 0);
    const geo2 = geo.clone().scale(-1, 1, 1);
    const bande = [];
    for (let i = 0; i < nombre; i++) {
      const oiseau = new THREE.Group();
      const a1 = new THREE.Mesh(geo, mat), a2 = new THREE.Mesh(geo2, mat);
      oiseau.add(a1, a2);
      const ph = rng() * TAU, r = 30 + rng() * 40, h = 34 + rng() * 22;
      oiseau.userData = { ph, r, h, v: .05 + rng() * .04, a1, a2, dep: (i / nombre) * .6 };
      group.add(oiseau);
      bande.push(oiseau);
    }
    group.userData.update = t => {
      for (const o of bande) {
        const u = o.userData, a = u.ph + t * u.v;
        o.position.set(Math.cos(a) * u.r, u.h + Math.sin(a * 2.2) * 2.4, Math.sin(a) * u.r);
        o.rotation.y = -a + Math.PI / 2;
        o.rotation.z = Math.sin(a * 2.2) * .12;
        const battement = Math.sin(t * 5.5 + u.ph * 3) * .5;
        u.a1.rotation.z = battement; u.a2.rotation.z = -battement;
      }
    };
    group.visible = false;
    return group;
  }

  /* ===========================================================================
     4. VENT (appliqué aux matériaux des végétaux)
     ======================================================================== */
  function appliquerVent(materiau, intensite, instancie, uniforme) {
    materiau.onBeforeCompile = function (shader) {
      shader.uniforms.uTemps = uniforme;
      shader.vertexShader = 'uniform float uTemps;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = ${instancie ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0);
float hh = max(mvPosition.y, 0.0);
float souffle = sin(uTemps * 0.55 + mvPosition.x * 0.09 + mvPosition.z * 0.07) * 0.65
              + sin(uTemps * 1.7 + mvPosition.y * 0.3) * 0.35;
float amp = ${intensite.toFixed(4)} * (0.25 + hh * 0.75);
mvPosition.x += souffle * amp;
mvPosition.z += souffle * amp * 0.6;
mvPosition.x += sin(uTemps * 3.1 + mvPosition.y * 1.9 + mvPosition.z * 2.3) * ${(intensite * .28).toFixed(4)} * (0.3 + transformed.y);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`);
    };
    materiau.customProgramCacheKey = () => 'vent' + intensite + (instancie ? 'i' : '');
    return materiau;
  }

  /* ===========================================================================
     5. CAMÉRA ORBITALE
     ======================================================================== */
  function creerCameraControles(camera, domElement, opts) {
    opts = opts || {};
    const cible = V(opts.cible ? opts.cible[0] : 0, opts.cible ? opts.cible[1] : 3, opts.cible ? opts.cible[2] : 0);
    const cibleBut = cible.clone();
    let theta = opts.azimut === undefined ? 0.7 : opts.azimut;
    let phi = opts.inclinaison === undefined ? 1.24 : opts.inclinaison;   // 0 = vertical, PI/2 = horizon
    let rayon = opts.distance === undefined ? 26 : opts.distance;
    let rayonBut = rayon;
    let thetaBut = theta, phiBut = phi;
    const limites = {
      rayonMin: opts.rayonMin || 2.5, rayonMax: opts.rayonMax || 140,
      phiMin: opts.phiMin === undefined ? 0.12 : opts.phiMin,
      phiMax: opts.phiMax === undefined ? 1.53 : opts.phiMax
    };
    let auto = opts.auto !== false;
    let vitesseAuto = opts.vitesseAuto || 0.00035;
    const pointeurs = new Map();
    let pincement = 0, dernierX = 0, dernierY = 0;
    const dom = domElement;

    function distancePincement() {
      const [a, b] = [...pointeurs.values()];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    }
    dom.addEventListener('pointerdown', e => {
      dom.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, e);
      auto = false;
      if (pointeurs.size === 2) pincement = distancePincement();
      dom.style.cursor = 'grabbing';
      if (opts.onInteraction) opts.onInteraction();
    });
    const fin = e => {
      pointeurs.delete(e.pointerId);
      dom.style.cursor = 'grab';
    };
    dom.addEventListener('pointerup', fin);
    dom.addEventListener('pointercancel', fin);
    dom.addEventListener('pointermove', e => {
      const prec = pointeurs.get(e.pointerId);
      if (!prec) return;
      const dx = e.clientX - prec.clientX, dy = e.clientY - prec.clientY;
      pointeurs.set(e.pointerId, e);
      if (pointeurs.size === 1) {
        thetaBut -= dx * .006;
        phiBut = clamp(phiBut - dy * .0045, limites.phiMin, limites.phiMax);
      } else if (pointeurs.size === 2) {
        const d = distancePincement();
        rayonBut = clamp(rayonBut * pincement / d, limites.rayonMin, limites.rayonMax);
        pincement = d;
      }
    });
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      rayonBut = clamp(rayonBut * (1 + e.deltaY * .0012), limites.rayonMin, limites.rayonMax);
      if (opts.onInteraction) opts.onInteraction();
    }, { passive: false });
    addEventListener('keydown', e => {
      const pas = e.shiftKey ? .18 : .07;
      if (e.key === 'ArrowLeft') { thetaBut += pas; auto = false; }
      else if (e.key === 'ArrowRight') { thetaBut -= pas; auto = false; }
      else if (e.key === 'ArrowUp') phiBut = clamp(phiBut - pas * .7, limites.phiMin, limites.phiMax);
      else if (e.key === 'ArrowDown') phiBut = clamp(phiBut + pas * .7, limites.phiMin, limites.phiMax);
      else if (e.key === '+' || e.key === '=') rayonBut = clamp(rayonBut * .9, limites.rayonMin, limites.rayonMax);
      else if (e.key === '-') rayonBut = clamp(rayonBut * 1.1, limites.rayonMin, limites.rayonMax);
    });

    return {
      get auto() { return auto; },
      set auto(v) { auto = v; },
      get cible() { return cible; },
      get distance() { return rayon; },
      volerVers(c, distance, azimut, inclinaison) {
        if (c) cibleBut.copy(c);
        if (distance) rayonBut = clamp(distance, limites.rayonMin, limites.rayonMax);
        if (azimut !== undefined && azimut !== null) thetaBut = azimut;
        if (inclinaison !== undefined && inclinaison !== null) phiBut = clamp(inclinaison, limites.phiMin, limites.phiMax);
        auto = false;
      },
      definirBornes(b) { Object.assign(limites, b); },
      maj(dt) {
        if (auto) thetaBut += vitesseAuto * dt * 60;
        const k = 1 - Math.pow(0.0016, dt);       // lissage exponentiel
        theta += (thetaBut - theta) * k;
        phi += (phiBut - phi) * k;
        rayon += (rayonBut - rayon) * k;
        cible.lerp(cibleBut, k);
        const sp = Math.sin(phi), cp = Math.cos(phi);
        camera.position.set(
          cible.x + rayon * sp * Math.sin(theta),
          cible.y + rayon * cp,
          cible.z + rayon * sp * Math.cos(theta)
        );
        camera.lookAt(cible);
      }
    };
  }

  /* ===========================================================================
     6. MOTEUR DE SCÈNE
     ======================================================================== */
  function creerMoteur(opts) {
    opts = opts || {};
    const saison = opts.saison || 'ete';
    const ambianceNom = opts.ambiance || 'jour';
    const ambiance = AMBIANCES[ambianceNom] || AMBIANCES.jour;
    const qualite = opts.qualite === undefined ? 1 : opts.qualite;
    const rng = A.RNG(opts.seed || 20261004);

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({
      antialias: opts.antialias !== false, powerPreference: 'high-performance', alpha: false
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, opts.pixelRatioMax || 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ambiance.exposition;
    renderer.domElement.setAttribute('aria-label', (opts.libelleAria || 'Scène 3D') +
      ' : glisser pour tourner, molette ou pincement pour zoomer, flèches du clavier pour pivoter');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    (opts.conteneur || document.body).appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1600);

    // --- lumières
    const soleil = new THREE.DirectionalLight(ambiance.soleil.couleur, ambiance.soleil.intensite);
    const distanceSoleil = 60;
    function placerSoleil() {
      const a = ambiance.soleil.az, e = ambiance.soleil.elev;
      soleil.position.set(
        Math.cos(a) * Math.cos(e) * distanceSoleil,
        Math.sin(e) * distanceSoleil,
        Math.sin(a) * Math.cos(e) * distanceSoleil
      );
    }
    placerSoleil();
    soleil.castShadow = true;
    const tailleOmbre = qualite > .9 ? 2048 : qualite > .6 ? 1536 : 1024;
    soleil.shadow.mapSize.set(tailleOmbre, tailleOmbre);
    const camOmbre = soleil.shadow.camera;
    const etendue = opts.etendueOmbres || 26;
    camOmbre.left = -etendue; camOmbre.right = etendue;
    camOmbre.top = etendue; camOmbre.bottom = -etendue;
    camOmbre.near = 1; camOmbre.far = 190;
    soleil.shadow.bias = -0.0006;
    soleil.shadow.normalBias = .035;
    scene.add(soleil);
    scene.add(soleil.target);

    const hemi = new THREE.HemisphereLight(ambiance.hemisphere.ciel, ambiance.hemisphere.sol, ambiance.hemisphere.intensite);
    scene.add(hemi);
    scene.fog = new THREE.Fog(ambiance.brume.couleur, ambiance.brume.near, ambiance.brume.far);

    const ciel = creerCiel(ambiance, scene);
    ciel.material.uniforms.soleilDir.value.copy(soleil.position).normalize();

    // --- vent
    const uTemps = { value: 0 };
    const materiauxVent = [];
    function enregistrerVent(materiau, intensite, instancie) {
      appliquerVent(materiau, intensite, instancie, uTemps);
      materiauxVent.push(materiau);
      return materiau;
    }

    // --- sol et décor
    const decor = new THREE.Group();
    scene.add(decor);
    const terrain = creerTerrain({
      qualite: qualite, taille: opts.tailleSol || 320, touffes: opts.touffes,
      cailloux: opts.cailloux, rayonDetail: opts.rayonDetail, decalage: opts.decalageDetail,
      reliefSol: opts.reliefSol, zonesPlates: opts.zonesPlates, ondulation: opts.ondulation
    }, ambiance, saison, rng);
    decor.add(terrain);

    const nuages = creerNuages(ambiance, saison === 'hiver' ? 12 : 8, rng);
    scene.add(nuages);
    const oiseaux = creerOiseaux(9, rng);
    scene.add(oiseaux);

    // --- arbres
    const arbres = new THREE.Group();
    scene.add(arbres);
    const especesPresentes = new Map();

    function planter(id, o) {
      o = o || {};
      const group = A.buildTree(id, {
        seed: o.seed === undefined ? Math.floor(rng() * 1e6) : o.seed,
        qualite: o.qualite === undefined ? qualite : o.qualite,
        saison: o.saison || saison,
        echelle: o.echelle,
        feuilles: o.feuilles,
        densite: o.densite,
        niveaux: o.niveaux,          // nombre de générations de branches
        rameaux: o.rameaux,          // pousses terminales par rameau
        rapide: o.rapide,            // géométrie allégée (sujets lointains)
        segmentsFeuille: o.segmentsFeuille
      });
      const meshes = group.userData.meshes || {};
      for (const cle in meshes) {
        const v = meshes[cle];
        const liste = Array.isArray(v) ? v : [v];
        for (const m of liste) {
          if (!m || !m.material) continue;
          const inst = !!m.isInstancedMesh;
          const inten = cle === 'feuilles' || cle === 'aiguilles' || cle === 'fleurs' ? .035 : .008;
          enregistrerVent(m.material, inten, inst);
          if (m.customDepthMaterial) enregistrerVent(m.customDepthMaterial, inten, inst);
          m.material.shadowSide = THREE.DoubleSide;
        }
      }
      const x0 = o.x || 0, z0 = o.z || 0;
      const y0 = (o.y || 0) + (o.sol === false ? 0
        : hauteurTerrain(x0, z0, opts.reliefSol, opts.zonesPlates, opts.ondulation));
      group.position.set(x0, y0, z0);
      group.rotation.y = o.rotation === undefined ? rng() * TAU : o.rotation;
      if (o.echelleGlobale) group.scale.setScalar(o.echelleGlobale);
      group.userData.especeId = id;
      arbres.add(group);
      const esp = A.ESPECES[id];
      especesPresentes.set(id, (especesPresentes.get(id) || 0) + 1);
      group.userData.nom = esp.nom;
      group.userData.latin = esp.latin;
      group.userData.description = esp.description;
      group.userData.icone = esp.icone;
      group.userData.famille = esp.famille;
      group.userData.rayon = esp.largeur * .5 * (o.echelleGlobale || 1);
      // ombre douce de contact : même quand la carte d'ombres est grossière,
      // l'arbre reste posé sur le sol
      if (o.socle !== false) {
        const r0 = Math.max(.7, group.userData.rayon * .62);
        const socle = new THREE.Mesh(A.memoGeometrie('socle', () => new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)),
          A.memoMateriau('socle', () => new THREE.MeshBasicMaterial({
            map: A.finish(A.socleCanvas(A.RNG(7)), 1, 1), transparent: true, depthWrite: false,
            opacity: .30, color: 0x1d2410, side: THREE.FrontSide
          })));
        socle.scale.set(r0, 1, r0);
        socle.position.y = .035;
        socle.renderOrder = 1;
        group.add(socle);
        group.userData.socle = socle;
      }
      return group;
    }

    // --- contrôles
    const controles = creerCameraControles(camera, renderer.domElement, {
      cible: opts.cible, distance: opts.distance, azimut: opts.azimut, inclinaison: opts.inclinaison,
      auto: opts.auto, rayonMin: opts.rayonMin, rayonMax: opts.rayonMax, vitesseAuto: opts.vitesseAuto,
      phiMin: opts.phiMin, phiMax: opts.phiMax
    });

    // --- redimensionnement
    function redimensionner() {
      const parent = renderer.domElement.parentElement || document.body;
      const w = parent.clientWidth || innerWidth;
      const h = parent.clientHeight || innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // sur téléphone vertical, on recule un peu pour garder l'arbre entier
      camera.fov = camera.aspect < .85 ? 58 : 46;
      camera.updateProjectionMatrix();
    }
    addEventListener('resize', redimensionner);
    redimensionner();

    // --- boucle
    const horloge = new THREE.Clock();
    let temps = 0, fps = 60, enMarche = true, adaptatif = opts.adaptatif !== false;
    let bas = 0;
    const listeners = [];
    function frame() {
      if (!enMarche) return;
      const dt = Math.min(horloge.getDelta(), .05);
      temps += dt;
      uTemps.value = temps;
      controles.maj(dt);
      // le soleil suit la cible pour garder des ombres nettes
      soleil.target.position.copy(controles.cible);
      soleil.position.copy(controles.cible).add(V(
        Math.cos(ambiance.soleil.az) * Math.cos(ambiance.soleil.elev) * distanceSoleil,
        Math.sin(ambiance.soleil.elev) * distanceSoleil,
        Math.sin(ambiance.soleil.az) * Math.cos(ambiance.soleil.elev) * distanceSoleil
      ));
      uTempsSoleil.value.copy(soleil.position).sub(controles.cible).normalize();
      for (const s of nuages.children) {
        s.position.x += s.userData.vitesse * dt;
        if (s.position.x > 320) s.position.x = -320;
      }
      if (oiseaux.visible) oiseaux.userData.update(temps);
      for (const l of listeners) l(dt, temps);
      renderer.render(scene, camera);
      // performance adaptative : on baisse la résolution si nécessaire
      if (adaptatif) {
        fps = fps * .92 + (1 / Math.max(dt, 1e-3)) * .08;
        if (fps < 32 && bas < 2 && temps > 1.5) {
          bas++;
          renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * .8));
        }
      }
      requestAnimationFrame(frame);
    }
    const uTempsSoleil = ciel.material.uniforms.soleilDir;
    requestAnimationFrame(frame);

    // --- changement d'ambiance à chaud
    function setAmbiance(nom) {
      const a = AMBIANCES[nom] || AMBIANCES.jour;
      soleil.color.set(a.soleil.couleur);
      soleil.intensity = a.soleil.intensite;
      hemi.color.set(a.hemisphere.ciel);
      hemi.groundColor.set(a.hemisphere.sol);
      hemi.intensity = a.hemisphere.intensite;
      scene.fog.color.set(a.brume.couleur);
      scene.fog.near = a.brume.near;
      scene.fog.far = a.brume.far;
      renderer.toneMappingExposure = a.exposition;
      const u = ciel.material.uniforms;
      u.cTop.value.set(a.ciel.top);
      u.cHorizon.value.set(a.ciel.horizon);
      u.cBas.value.set(a.ciel.bas);
      u.soleilCol.value.set(a.soleil.couleur);
      u.etoiles.value = a.etoiles ? 1 : 0;
      u.halo.value = a === AMBIANCES.nuit ? .25 : .55;
      for (const s of nuages.children) {
        s.material.color.copy(new THREE.Color(a.ciel.horizon).lerp(new THREE.Color(0xffffff), .7));
        s.material.opacity = a === AMBIANCES.nuit ? .22 : .75;
      }
      if (opts.onAmbiance) opts.onAmbiance(nom);
    }

    const moteur = {
      THREE, scene, camera, renderer, controles, arbres, decor, soleil, hemi, ciel, nuages, oiseaux,
      uTemps, planter, setAmbiance, temps: () => temps,
      hauteurSol: (x, z) => hauteurTerrain(x, z, opts.reliefSol, opts.zonesPlates, opts.ondulation),
      ajouter: o => scene.add(o),
      enregistrerVent,
      surFrame: cb => listeners.push(cb),
      arreter() { enMarche = false; },
      redimensionner,
      ambiance: ambianceNom, saison, qualite,
      especesPresentes,
      /** liste des arbres pour le survol / clic */
      cibles: () => arbres.children,
      /** cadre la caméra sur un objet */
      cadrer(objet, distance, options) {
        options = options || {};
        const boite = new THREE.Box3().setFromObject(objet);
        const centre = boite.getCenter(new THREE.Vector3());
        const taille = boite.getSize(new THREE.Vector3());
        const maxi = Math.max(taille.x, taille.y, taille.z);
        controles.volerVers(centre, distance || maxi * (options.marge || 1.45),
          options.azimut === undefined ? null : options.azimut,
          options.inclinaison === undefined ? null : options.inclinaison);
      }
    };
    return moteur;
  }

  /* ===========================================================================
     7. INTERFACE
     ======================================================================== */
  function creerBarre(opts) {
    const conteneur = document.createElement('div');
    conteneur.className = 'barre-outils';
    conteneur.setAttribute('role', 'toolbar');
    conteneur.setAttribute('aria-label', 'Réglages de la scène');
    const groupes = [];

    function groupe(titre, cle, options, defaut, cb) {
      const g = document.createElement('div');
      g.className = 'groupe-outils';
      const lab = document.createElement('span');
      lab.className = 'etiquette';
      lab.textContent = titre;
      g.appendChild(lab);
      const rangee = document.createElement('div');
      rangee.className = 'rangee-boutons';
      options.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bouton-outil' + (o.v === defaut ? ' actif' : '');
        b.innerHTML = (o.e ? '<span class="icone">' + icone(o.e) + '</span>' : '') + '<span>' + o.nom + '</span>';
        b.setAttribute('aria-pressed', o.v === defaut ? 'true' : 'false');
        b.onclick = () => {
          rangee.querySelectorAll('button').forEach(x => { x.classList.remove('actif'); x.setAttribute('aria-pressed', 'false'); });
          b.classList.add('actif'); b.setAttribute('aria-pressed', 'true');
          cb(o.v);
        };
        rangee.appendChild(b);
      });
      g.appendChild(rangee);
      conteneur.appendChild(g);
      groupes.push({ cle, g });
      return g;
    }
    const api = {
      element: conteneur,
      groupe,
      masquerGroupe(cle) {
        const t = groupes.find(x => x.cle === cle);
        if (t) t.g.style.display = 'none';
      },
      definirActif(cle, valeur) {
        const t = groupes.find(x => x.cle === cle);
        if (!t) return;
        t.g.querySelectorAll('button').forEach(b => {
          const est = b.textContent.trim() === String(valeur) || b.dataset.v === String(valeur);
          if (b.dataset.v === String(valeur)) { b.classList.add('actif'); b.setAttribute('aria-pressed', 'true'); }
        });
      }
    };
    return api;
  }

  return {
    AMBIANCES, SAISONS, icone, ICONES, creerMoteur, creerBarre, creerCameraControles,
    creerTerrain, creerEau, creerAllee, creerRochers, creerHaie, appliquerVent
  };
})();
