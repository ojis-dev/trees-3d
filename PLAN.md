# Plan du jardin

Le jardin occupe un rectangle d’environ 120 × 110 m, ceint d’une lisière boisée qui ferme
l’horizon. La composition est classique : une allée de gravier serpente du sud (le promeneur
arrive de là) vers le nord, et chaque chambre du parc se découvre le long du chemin.

## Les chambres du jardin

| Scène | Lieu | Sujets |
|---|---|---|
| **La grande pelouse** | Centre-ouest | Le chêne centenaire mis en scène, à l’aplomb de la vue d’ensemble |
| **L’allée** | Nord-sud, sinueuse | Bordures de cheveux d’ange, massifs fleuris, lilas |
| **La pièce d’eau** | Est (x ≈ 19, z ≈ −9) | Saule pleureur, roseaux, nénuphars, berges de pierres |
| **Le bosquet de conifères** | Nord-ouest | Épicéas, pins sylvestres, lisière de fougères |
| **La flèche des cyprès** | Nord-est | Quatre cyprès alignés, haie taillée |
| **Le coin japonais** | Sud-ouest | Érable du Japon à plusieurs troncs, neuf rochers, fougères |
| **Le verger** | Sud-est | Trois pommiers, hortensias, massifs |
| **Le carré des fleurs** | Sud | Lilas, hortensias, haies basses, massifs de pâquerettes |
| **La terrasse méditerranéenne** | Est | Deux oliviers, cheveux d’ange, pierres |
| **La lisière** | Pourtour (rayon 50-66 m) | 34 sujets de détail minimal : chênes, hêtres, bouleaux, épicéas… |

## Organisation du fichier `jardin.js`

```js
const PLAN = [ { id, x, z, e, q, rot, vedette, note }, … ]   // plantation principale
const HAIES = [ { de: [x, z], a: [x, z], l, h }, … ]          // bordures de buis
const ALLEE = [ [x, z], … ]                                   // tracé de l’allée
planRochers()                                                 // rochers du coin japonais et des berges
planLisiere()                                                 // ceinture boisée, détail minimal
```

`x`, `z` sont en mètres (l’origine au centre du jardin, le nord vers les `z` négatifs),
`e` est l’échelle du sujet, `q` sa qualité de construction et `vedette` le fait qu’il soit
présenté par la visite guidée.

## Priorité de construction

Les sujets sont plantés du plus détaillé au plus léger (tri par qualité décroissante) et la
construction est découpée en tranches de ~26 ms : le jardin apparaît progressivement, sans figer
l’onglet. Le niveau de détail suit la distance :

| Palier | Critère | Niveaux de branches | Feuillage |
|---|---|---|---|
| héros | sujet mis en scène ou proche (< 16 m) | complet | 62 % |
| moyen | < 34 m | −2 | 48 % |
| fond | au-delà | −3, géométrie allégée | 34 % |
| petit | fougères, graminées, buis | — | 80 % |

## Vérification

`node test/smoke.js` reconstruit le plan complet et contrôle : nombre de sujets, budget de
facettes (< 6 M), durée de construction (< 9 s), unicité du décor, cohérence des essences.
`python3 test/plan.py` redessine le plan en image (l’export vient de `test/out/plan.json`,
produit par le test de fumée).
