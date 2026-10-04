#!/usr/bin/env python3
"""Rendu logiciel des arbres exportés par test/harness.js.

Reproduit approximativement le découpage alpha des textures procédurales
(masques dessinés à partir de la même configuration que arbres-core.js) afin de
juger la silhouette réelle du feuillage sans navigateur.
"""
import sys, os, struct, math, json
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
TAU = math.pi * 2


def clamp(v, a, b):
    return a if v < a else b if v > b else v


# --------------------------------------------------------------------------- #
#  Masques alpha (approximation des textures canvas de arbres-core.js)
# --------------------------------------------------------------------------- #
_cache = {}


def _half_fn(f):
    forme = f.get('forme', 'ovale')
    if forme == 'ovale':
        p = f.get('profil', .68)
        return lambda t: math.pow(math.sin(math.pi * pow(clamp(t, 0, 1), p)), .82)
    if forme == 'cordee':
        return lambda t: math.pow(math.sin(math.pi * pow(clamp(t, 0, 1), .55)), .85) * (1 - .28 * math.exp(-clamp(t, 0, 1) * 9))
    if forme == 'lanceolee':
        def h(t):
            u = clamp(t, 0, 1)
            return math.pow(math.sin(math.pi * pow(u, 1.05)), .62) * (.55 + u * 7 if u < .06 else 1)
        return h
    if forme == 'lobee':
        lobes = f.get('lobes', 5)
        def h(t):
            u = clamp(t, 0, 1)
            env = math.pow(math.sin(math.pi * pow(u, .62)), .5)
            s = 0.0
            for i in range(lobes):
                c0 = (i + .62) / (lobes + .35)
                s = max(s, math.exp(-pow((u - c0) / (.30 / lobes + .06), 2)))
            return env * (.52 + .62 * s) * (1 - .35 * pow(u, 3))
        return h
    if forme == 'palmee':
        def h(t):
            u = clamp(t, 0, 1)
            if u < .12:
                return .30 * math.sin(math.pi * u / .12 * .5 + .35)
            return math.pow(math.sin(math.pi * pow(u, .95)), .45) * (1 - .1 * math.sin(u * 12))
        return h
    if forme == 'aiguille':
        def h(t):
            u = clamp(t, 0, 1)
            return .11 * math.pow(1 - u * .75, .5) * (.6 + u * 8 if u < .05 else 1)
        return h
    return lambda t: math.pow(math.sin(math.pi * clamp(t, 0, 1)), .8)


def leaf_mask(f, W=128, H=256):
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    cx = W / 2
    y0, y1 = H * .955, H * .045
    P = lambda t: y0 - (y0 - y1) * t
    half = _half_fn(f)
    serr = f.get('serration', 0) or 0
    pts = []
    for t in np.linspace(0, 1, 90):
        hw = W * .47 * half(t) * (1 + serr * .06 * math.sin(t * 26))
        pts.append((cx + hw, P(t)))
    for t in np.linspace(1, 0, 90):
        hw = W * .47 * half(t) * (1 + serr * .06 * math.sin(t * 26))
        pts.append((cx - hw, P(t)))
    d.polygon(pts, fill=255)
    # pétiole
    d.line([(cx, y0 + H * .02), (cx, H - 1)], fill=255, width=3)
    # morsures
    rng = np.random.default_rng(7)
    for _ in range(5):
        t = rng.uniform(.15, .8)
        x = cx + (1 if rng.random() < .5 else -1) * W * .47 * half(.5) * rng.uniform(.4, .95)
        y = y0 - (y0 - y1) * t
        rx, ry = rng.uniform(3, 9), rng.uniform(4, 12)
        d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=0)
    return img


def frond_mask(f, W=128, H=512):
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    cx = W * .5
    curveX = lambda t: cx + (t - .5) * W * .10 * (1 - t) * 2
    for i in range(120):
        t = i / 119
        d.ellipse([curveX(t) - W * .018, H - t * H * .96 - 4, curveX(t) + W * .018, H - t * H * .96 + 4], fill=255)
    n = f.get('pinnae', 26)
    rng = np.random.default_rng(3)
    for i in range(n):
        t = .04 + .93 * (i / n)
        x, y = curveX(t), H - t * H * .96
        leaf = W * .46 * math.pow(1 - t, .75) * (t / .1 if t < .1 else 1) * rng.uniform(.8, 1.05)
        hh = (H / n) * rng.uniform(.34, .5)
        for sgn in (-1, 1):
            a = sgn * (.30 + rng.uniform(-.12, .12))
            ca, sa = math.cos(a), math.sin(a)
            pts = []
            for u in np.linspace(0, 1, 18):
                w = leaf * u
                th = hh * math.sin(math.pi * u) * .95
                px = w * ca - th * sa
                py = w * sa + th * ca
                pts.append((x + px, y + py * .6))
            for u in np.linspace(1, 0, 18):
                w = leaf * u
                th = hh * math.sin(math.pi * u) * .95
                px = w * ca + th * sa
                py = w * sa - th * ca
                pts.append((x + px, y + py * .6))
            d.polygon(pts, fill=255)
    return img


def tuft_mask(f, W=256, H=256):
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(11)
    n = f.get('brins', 90)
    for _ in range(n):
        x0 = W * (.5 + (rng.random() - .5) * .22)
        y0 = H * .99
        ln = H * (.45 + .55 * rng.random())
        bend = (rng.random() - .5) * W * .9
        w = W * rng.uniform(.006, .016)
        pts = [(x0, y0)]
        for u in np.linspace(0, 1, 24):
            pts.append((x0 + bend * (u ** 1.6), y0 - ln * u))
        d.line(pts, fill=255, width=max(1, int(w)), joint='curve')
    return img


def spray_mask(a, W=512, H=256):
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(19)
    x0, y0, x1 = W * .02, H * .5, W * .98
    courbe = a.get('courbe', 0) or 0
    mode = a.get('mode', 'pousse')
    yAt = lambda t: y0 + courbe * H * .34 * (1 - t) ** 2
    # masse verte continue le long du rameau (comme dans sprayCanvas)
    masse = a.get('masse', .30)
    haut = [(x0 + (x1 - x0) * (i / 24), yAt(i / 24) - masse * H * (1 - i / 24) ** 1.5) for i in range(25)]
    bas = [(x0 + (x1 - x0) * (i / 24), yAt(i / 24) + masse * H * (1 - i / 24) ** 1.5) for i in range(24, -1, -1)]
    d.polygon(haut + bas, fill=255)
    d.line([(x0, y0), (W * .5, yAt(.5)), (x1, yAt(1))], fill=255, width=5)
    n = a.get('densite', 190)
    ep = a.get('epaisseur', 2.1)
    for _ in range(int(n)):
        t = rng.random() ** .8
        px = x0 + (x1 - x0) * (1 - t)
        py = yAt(t)
        L = (a.get('longueur', .42)) * H * (.5 + .8 * (1 - t)) * rng.uniform(.65, 1.2)
        if mode == 'pousse':
            ang = (-1 if rng.random() < .5 else 1) * (math.pi * .5) + rng.uniform(-.75, .75) - .18
        elif mode == 'peigne':
            ang = (-1 if rng.random() < .5 else 1) * rng.uniform(.55, 1.25)
        else:
            ang = rng.random() * TAU
        ex, ey = px + math.cos(ang) * L, py + math.sin(ang) * L
        d.line([(px, py), (ex, ey)], fill=255, width=max(1, int(ep * rng.uniform(.7, 1.25))))
        if mode == 'etoile':
            for _ in range(3):
                a2 = ang + rng.uniform(-.9, .9)
                L2 = L * rng.uniform(.5, .85)
                d.line([(px, py), (px + math.cos(a2) * L2, py + math.sin(a2) * L2)], fill=255, width=max(1, int(ep * .75)))
    return img


def mask_for(name, cfg, typ):
    key = (name, typ)
    if key in _cache:
        return _cache[key]
    if typ == 4 and cfg.get('aiguilles'):
        m = spray_mask(cfg['aiguilles'])
    elif cfg.get('feuille', {}).get('forme') == 'fronde':
        m = frond_mask(cfg['feuille'])
    elif cfg.get('feuille', {}).get('forme') == 'touffe':
        m = tuft_mask(cfg['feuille'])
    elif cfg.get('feuille'):
        m = leaf_mask(cfg['feuille'])
    elif typ == 0:
        m = None                      # écorce : pleine
    else:
        m = None
    _cache[key] = m
    return m


# --------------------------------------------------------------------------- #
def load(name):
    data = open(os.path.join(OUT, name + '.bin'), 'rb').read()
    magic, n = struct.unpack_from('<II', data, 0)
    off = 8
    px = np.frombuffer(data, '<f4', n * 3, off).reshape(n, 3); off += n * 3 * 4
    py = np.frombuffer(data, '<f4', n * 3, off).reshape(n, 3); off += n * 3 * 4
    pz = np.frombuffer(data, '<f4', n * 3, off).reshape(n, 3); off += n * 3 * 4
    col = np.frombuffer(data, '<f4', n * 9, off).reshape(n, 3, 3); off += n * 9 * 4
    typ = np.frombuffer(data, 'u1', n, off); off += n
    uvs = np.frombuffer(data, '<f4', n * 6, off).reshape(n, 3, 2); off += n * 3 * 2 * 4
    P = np.stack([px, py, pz], axis=2).astype(np.float32)
    cfg = json.load(open(os.path.join(OUT, name + '.json')))
    return P, col.astype(np.float32), typ, uvs.astype(np.float32), cfg


def render(P, C, T, uv, cfg, name, size=760, azim=0.6, elev=0.06, sun=(0.55, 0.72, 0.42), pad=1.06,
           ground=True, bg=(196, 214, 226)):
    # --- découpe alpha : on élimine les triangles dont le centroïde tombe hors texture
    keep = np.ones(len(P), dtype=bool)
    for t in np.unique(T):
        m = mask_for(name, cfg, int(t))
        if m is None:
            continue
        W, H = m.size
        arr = np.asarray(m)
        sel = T == t
        u = uv[sel, :, 0].mean(axis=1)
        v = uv[sel, :, 1].mean(axis=1)
        xi = np.clip((u % 1.0 * (W - 1)).astype(int), 0, W - 1)
        yi = np.clip(((1 - v % 1.0) * (H - 1)).astype(int), 0, H - 1)
        keep[np.where(sel)[0]] = arr[yi, xi] > 110
    P, C, T, uv = P[keep], C[keep], T[keep], uv[keep]
    if len(P) == 0:
        raise SystemExit('tout a été découpé pour ' + name)

    e1 = P[:, 1] - P[:, 0]
    e2 = P[:, 2] - P[:, 0]
    nrm = np.cross(e1, e2)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True); ln[ln < 1e-9] = 1e-9
    nrm /= ln
    s = np.array(sun, dtype=np.float32); s /= np.linalg.norm(s)
    diff = np.abs(nrm @ s)
    # translucidité du feuillage : les faces presque vues de dos restent éclairées
    shade = 0.40 + 0.70 * diff + 0.20 * np.clip(nrm[:, 1], 0, 1)
    # assombrissement au cœur de la couronne (occlusion)
    cy0 = P[:, :, 1].mean()
    r = np.hypot(P[:, :, 0], P[:, :, 2]).mean(axis=1)
    rmax = max(1e-3, r.max())
    shade *= 0.55 + 0.55 * np.clip(r / rmax, 0, 1.2)
    C = C * shade[:, None, None]
    fc = C.mean(axis=1)

    ca, sa = math.cos(azim), math.sin(azim)
    R1 = np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]], dtype=np.float32)
    ce, se = math.cos(elev), math.sin(elev)
    R2 = np.array([[1, 0, 0], [0, ce, -se], [0, se, ce]], dtype=np.float32)
    V = P.reshape(-1, 3) @ R1.T @ R2.T
    Vc = V - V.mean(axis=0)
    lo, hi = Vc.min(axis=0), Vc.max(axis=0)
    cx2, cy2 = (lo[0] + hi[0]) * .5, (lo[1] + hi[1]) * .5
    scale = size * 0.92 / max(hi[1] - lo[1], hi[0] - lo[0], 1.0)
    fx = -(Vc[:, 0] - cx2) * scale + size * 0.5
    fy = -(Vc[:, 1] - cy2) * scale + size * 0.5
    depth = Vc[:, 2].reshape(-1, 3).mean(axis=1)

    img = Image.new('RGB', (size, size), bg)
    d = ImageDraw.Draw(img, 'RGBA')
    for i in range(size):
        t = i / size
        d.line([(0, i), (size, i)],
               fill=(int(bg[0] - 44 * t), int(bg[1] - 30 * t), int(bg[2] + 6 * t)))
    F = np.stack([fx, fy], axis=1).reshape(-1, 3, 2)
    cols = (np.clip(fc, 0, 1) * 255).astype(np.uint8)
    order = np.argsort(depth)
    for i in order:
        tri = F[i]
        if not np.isfinite(tri).all():
            continue
        d.polygon([tuple(tri[0]), tuple(tri[1]), tuple(tri[2])], fill=tuple(int(v) for v in cols[i]))
    return img


def montage(images, cols, path, labels=None):
    w, h = images[0].size
    rows = (len(images) + cols - 1) // cols
    M = Image.new('RGB', (w * cols, h * rows), (238, 240, 236))
    d = ImageDraw.Draw(M)
    for i, im in enumerate(images):
        r, c = divmod(i, cols)
        M.paste(im, (c * w, r * h))
        if labels:
            d.rectangle([c * w, r * h, c * w + w - 1, r * h + h - 1], outline=(150, 158, 148))
            d.text((c * w + 12, r * h + 10), labels[i], fill=(15, 25, 15))
    M.save(path)


if __name__ == '__main__':
    names = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.bin'))
    ims = []
    for n in names:
        P, C, T, uv, cfg = load(n)
        im = render(P, C, T, uv, cfg, n)
        im.save(os.path.join(OUT, n + '.png'))
        ims.append(im)
        print(n, 'faces conservées:', len(P))
    if len(ims) > 1:
        montage(ims, min(4, len(ims)), os.path.join(OUT, 'montage.png'), names)
        print('montage écrit')
