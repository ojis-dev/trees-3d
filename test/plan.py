#!/usr/bin/env python3
"""Plan du jardin : dessine la composition (arbres, couronnes, allée, eau,
haies) à partir du plan de plantation de jardin.js. Sert de contrôle visuel
et de documentation. Usage : python3 test/plan.py [chemin-sortie]"""
import re, os, sys, math
from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source = open(os.path.join(RACINE, 'jardin.js'), encoding='utf-8').read()

# --- essences : nom, emoji, largeur de couronne
esp = {}
bloc = open(os.path.join(RACINE, 'arbres-core.js'), encoding='utf-8').read()
for m in re.finditer(r"id: '([a-z]+)', nom: '([^']+)'.*?largeur: ([0-9.]+)", bloc, re.S):
    esp[m.group(1)] = {'nom': m.group(2), 'largeur': float(m.group(3))}

# --- plan de plantation
plan = []
# le plan effectif (lisière comprise) est exporté par test/smoke.js
chemin_plan = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'plan.json')
if os.path.exists(chemin_plan):
    import json
    plan = json.load(open(chemin_plan))
else:
    for m in re.finditer(r"\{ id: '([a-z]+)', x: (-?[0-9.]+), z: (-?[0-9.]+), e: ([0-9.]+)(.*?)\}", source):
        plan.append({'id': m.group(1), 'x': float(m.group(2)), 'z': float(m.group(3)),
                     'e': float(m.group(4)), 'vedette': 'vedette: true' in m.group(5)})

haies = [(float(a), float(b), float(c), float(d)) for a, b, c, d in
         re.findall(r"de: \[(-?[0-9.]+), (-?[0-9.]+)\], a: \[(-?[0-9.]+), (-?[0-9.]+)\]", source)]
allee = [(float(a), float(b)) for a, b in re.findall(r"\[(-?[0-9.]+), (-?[0-9.]+)\]", source[source.index('const ALLEE'):source.index('/* --- construction')])]

COULEURS = {
    'chene': (86, 122, 50), 'hetre': (104, 122, 74), 'bouleau': (150, 170, 96),
    'tilleul': (110, 140, 60), 'erable': (150, 60, 44), 'cerisier': (226, 150, 178),
    'pommier': (196, 90, 70), 'olivier': (140, 148, 118), 'saule': (126, 168, 76),
    'cypres': (52, 84, 52), 'epicea': (42, 74, 48), 'pin': (72, 96, 54),
    'lilas': (154, 122, 184), 'hortensia': (110, 150, 205), 'fougere': (62, 108, 58),
    'stipa': (200, 176, 108), 'buis': (74, 107, 52)
}

ECH = 6.4          # pixels par mètre
MARGE = 60
X0, X1, Z0, Z1 = -72, 72, -72, 60
W = int((X1 - X0) * ECH) + MARGE * 2
H = int((Z1 - Z0) * ECH) + MARGE * 2


def px(x):
    return MARGE + (x - X0) * ECH


def py(z):
    return MARGE + (z - Z0) * ECH


img = Image.new('RGB', (W, H), (214, 226, 206))
d = ImageDraw.Draw(img, 'RGBA')

# pelouse : dégradé très léger
for i in range(H):
    t = i / H
    d.line([(0, i), (W, i)], fill=(int(198 - 26 * t), int(214 - 22 * t), int(188 - 30 * t)))

# allée
if allee:
    pts = [(px(x), py(z)) for x, z in allee]
    d.line(pts, fill=(206, 198, 178), width=int(2.6 * ECH) + 6, joint='curve')
    d.line(pts, fill=(226, 219, 200), width=int(2.6 * ECH), joint='curve')

# pièce d'eau
d.ellipse([px(19) - 5.2 * ECH, py(-9) - 3.8 * ECH, px(19) + 5.2 * ECH, py(-9) + 3.8 * ECH], fill=(96, 152, 168))
d.ellipse([px(19) - 5.2 * ECH + 6, py(-9) - 3.8 * ECH + 6, px(19) + 5.2 * ECH - 6, py(-9) + 3.8 * ECH - 6], fill=(120, 176, 190))

# haies
for x1, z1, x2, z2 in haies:
    d.line([(px(x1), py(z1)), (px(x2), py(z2))], fill=(84, 118, 62), width=int(1.1 * ECH) + 4)

# arbres : couronne + tronc
try:
    police = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    police_p = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    police = police_p = None

for a in sorted(plan, key=lambda p: -p['z']):
    e = esp.get(a['id'], {'nom': a['id'], 'largeur': 5})
    r = e['largeur'] * .5 * a['e'] * ECH
    c = COULEURS.get(a['id'], (100, 130, 80))
    x, y = px(a['x']), py(a['z'])
    # ombre portée au sol
    d.ellipse([x - r, y - r * .72 + 4, x + r, y + r * .72 + 4], fill=(90, 110, 80, 70))
    alpha = 110 if a.get('lisiere') else 170
    d.ellipse([x - r, y - r * .72, x + r, y + r * .72], fill=tuple(c) + (alpha,))
    d.ellipse([x - r * .55, y - r * .40, x + r * .55, y + r * .40], fill=tuple(min(255, int(v * 1.18)) for v in c) + (200,))
    d.ellipse([x - 1.6 * ECH * .18 - 1, y - 2, x + 1.6 * ECH * .18 + 1, y + 2], fill=(120, 96, 70))
    if a['vedette']:
        d.ellipse([x - r - 4, y - r * .72 - 4, x + r + 4, y + r * .72 + 4], outline=(60, 78, 50), width=2)
    if police and (a['vedette'] or r > 26) and not a.get('lisiere'):
        d.text((x - r, y + r * .72 + 3), e['nom'], fill=(36, 46, 34), font=police)

# échelle, rose des vents, légende
d.line([(MARGE, H - 26), (MARGE + 10 * ECH, H - 26)], fill=(60, 70, 58), width=3)
if police:
    d.text((MARGE, H - 44), '10 m', fill=(60, 70, 58), font=police_p or police)
    d.text((W - MARGE - 90, MARGE - 10), 'NORD ↑', fill=(60, 70, 58), font=police_p or police)
    d.text((MARGE, 16), 'Plan du Jardin des Arbres — %d sujets, %d essences' % (
        len(plan), len({p['id'] for p in plan})), fill=(30, 42, 28), font=police_p or police)
    d.text((MARGE, 36), 'les cercles figurent l’emprise des couronnes ; les traits gras cerclés : sujets mis en scène',
           fill=(70, 82, 66), font=police)

sortie = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, 'docs', 'plan-jardin.png')
os.makedirs(os.path.dirname(sortie), exist_ok=True)
img.save(sortie)
print('plan écrit :', sortie, img.size, '|', len(plan), 'arbres,', len(haies), 'haies')
