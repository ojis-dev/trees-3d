/* Scènes capturées par test/navigateur/captures.js
   Les pages d'origine (arbre.html, cerisier.html…) sont très lourdes pour le
   rendu logiciel de Chromium : elles ont leur propre script (origine.js). */
module.exports = [
  { nom: 'fiche-chene-automne', url: 'espece.html?espece=chene&saison=automne&ambiance=coucher', max: 300 },
  { nom: 'fiche-cerisier-printemps', url: 'espece.html?espece=cerisier&saison=printemps&ambiance=jour', max: 300 },
  { nom: 'fiche-erable-automne', url: 'espece.html?espece=erable&saison=automne&ambiance=aube', max: 300 },
  { nom: 'fiche-saule-ete', url: 'espece.html?espece=saule&saison=ete&ambiance=coucher', max: 300 },
  { nom: 'fiche-olivier', url: 'espece.html?espece=olivier&saison=ete&ambiance=jour', max: 300 },
  { nom: 'galerie', url: 'galerie.html', max: 900 },
  { nom: 'jardin-ete', url: '', max: 1800 }
];
