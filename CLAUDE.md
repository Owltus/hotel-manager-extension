# CLAUDE.md — Hotel Manager Extension

Guide de référence pour les futures mises à jour. À lire avant toute modification.

## Projet

Extension WebExtension (Manifest V3) Firefox/Chrome qui scrape les données de StayNTouch PMS (`*.stayntouch.com`) et Dmbook Pro (`*.dmbook.pro`) pour un hôtel de 80 chambres. Génère des PDF d'impression (tickets de maintenance, rooming list, liste personnalisée).

- **Distribution** : addons.mozilla.org (AMO)
- **Pas de build** : JS vanilla, pas de bundler, pas de TypeScript, pas de tests
- **Owner** : usage personnel mono-utilisateur

## Architecture

```
manifest.json                          → MV3 config, ordre des scripts critique
background/service-worker.js           → orchestration StayNTouch scraping
content-scripts/
  stayntouch-scraper.js                → scrape StayNTouch, écrit chambres_data
  dmbook-scraper.js                    → scrape tickets DMbook + UI boutons + PDF
lib/
  status-calculator.js                 → calculateRoomStatus() → statuts hôtel
  rooms-list.js                        → ROOMS_BY_LEVEL (liste chambres hardcodée)
  config.js
popup/                                 → popup de l'extension
icons/                                 → 16/48/128 PNG
build.py                               → packaging ZIP pour AMO
```

**Ordre de chargement des content scripts DMbook** (dans `manifest.json`) :
1. `lib/status-calculator.js`
2. `lib/rooms-list.js`
3. `content-scripts/dmbook-scraper.js`

Ne JAMAIS inverser. `dmbook-scraper.js` dépend des deux autres via scope partagé du content-script MV3 (const top-level partagés entre fichiers de la même entrée `content_scripts`).

## Workflow de release

1. Modifier le code
2. Bumper la version dans `manifest.json` (SemVer, AMO refuse les doublons)
3. `python build.py` → génère `hotel-manager-extension-vX.Y.Z.zip` avec `manifest.json` à la racine
4. Soumettre à https://addons.mozilla.org/developers

Le script `build.py` exclut automatiquement : `.claude/`, `.git/`, `build.py`, `__pycache__/`, logs, ZIPs précédents.

## Règles AMO (validator Mozilla)

**INTERDIT** — le validator refuse ou flag :

- `element.innerHTML = <string>` → utiliser `createElement` + `textContent`/`setAttribute` ou `createElementNS` pour le SVG. Voir `buildLucideSvg()` et `promptCustomTitle()` dans `dmbook-scraper.js` pour l'exemple.
- `eval()`, `new Function()`, `setTimeout("string")` → jamais.
- Scripts distants (`<script src="https://…">`) → jamais, tout doit être local.
- Obfuscation/minification agressive.

**OBLIGATOIRE** dans le packaging :

- `manifest.json` à la **racine** du ZIP (pas dans un sous-dossier). Le script `build.py` garantit cela.
- Chaque soumission = version incrémentée (AMO rejette `2.1.1` si elle existe déjà).

## Conventions du code

### Factory bouton UI (`createHotelManagerButton`)

Tous les boutons injectés dans DMbook passent par la factory. Pour ajouter un nouveau bouton :

1. Ajouter l'icône dans `BUTTON_ICONS` (Lucide, en données structurées `{ tag, attrs }`)
2. Appeler `createHotelManagerButton({ id, title, bgColor, iconName, onClick })` dans `addSimpleButton()`
3. Ajouter le cleanup de l'id dans `initDmbookInterface()`
4. Appeler `pullRightElement.appendChild(monBouton)`

### Handler d'export (pattern disable/flash/enable)

Tout handler de bouton asynchrone suit ce pattern :

```js
async function handleXxx(button) {
  const originalBackground = button.style.background;
  button.style.pointerEvents = 'none';    // désactiver AVANT tout await
  button.style.opacity = '0.6';
  try {
    // … travail …
    button.style.background = '#28a745';  // vert = succès
    setTimeout(() => { button.style.background = originalBackground; }, 2000);
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur …:', error);
    button.style.background = '#dc3545';  // rouge = erreur
    setTimeout(() => { button.style.background = originalBackground; }, 2000);
  }
  setTimeout(() => {                      // réactivation systématique
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}
```

**Point critique** : désactiver le bouton **avant** tout `await` (prompt modal, fetch, etc.). Sinon l'utilisateur peut re-cliquer et provoquer des Promises orphelines (voir BORG-2026-04-20-002).

### PDF d'impression

- CSS commun à tous les exports → constante `PRINT_CSS` (module-level) dans `dmbook-scraper.js`
- `openPrintWindow(htmlContent, title)` accepte un titre optionnel (défaut : `'Tickets de Maintenance'`)
- Le titre est toujours échappé via `escapeHTML()` dans le `<title>` de l'iframe
- Layout PDF : grille `.floors-grid` (6 colonnes = 6 étages). Variant `.compact` pour tableaux 2 colonnes (liste personnalisée)

### Sécurité HTML / échappement

- `escapeHTML()` dans `dmbook-scraper.js` couvre `& < > " '`
- **Tout** input utilisateur (titre modale, description ticket) doit passer par `escapeHTML()` avant interpolation dans une string HTML destinée à être parsée (srcdoc iframe, template literals)
- Les valeurs purement numériques/internes (numéro de chambre depuis `ROOMS_BY_LEVEL`, date formatée, total calculé) sont safe sans escape

### Modale personnalisée (`promptCustomTitle`)

Pattern Promise-based. Points à respecter :

- Stocker `overlay._cleanup` sur l'élément pour qu'une réouverture puisse nettoyer la précédente
- Flag `resolved` pour empêcher double-appel à `resolve()`
- Retirer le listener `document.keydown` **avant** `overlay.remove()`
- Cleanup appelé dans toutes les branches : OK, Annuler, Escape, clic overlay
- `initDmbookInterface` nettoie aussi `#hotel-manager-modal` orpheline au démarrage

## Pièges connus

- **`chambres_data` absent** : si l'utilisateur n'a pas ouvert StayNTouch récemment, le storage est vide. `handleRoomingExport` lève une erreur explicite (flash rouge). `handlePDFExport` retombe sur `formatTicketsToHTML` (sans statuts). `enhanceTicketDisplay` affiche les tickets sans badge statut. Comportement attendu.
- **Passage 14h00** : `isMorning = getHours() >= 2 && getHours() < 14`. Le bascule est pile à 14h. Accepté par spec utilisateur.
- **Re-init DMbook** : `initDmbookInterface()` est appelée une fois par load (setTimeout 1000ms + load listener conditionnel). DMbook n'est pas une SPA, donc pas de re-init en pratique. Le cleanup est quand même exhaustif (4 boutons + modale).
- **FontAwesome** : retiré des boutons (remplacé par SVG Lucide inline via `buildLucideSvg`). Ne pas réintroduire la dépendance implicite sur la page tierce.

## Audit avec Borg

Le Collectif Borg est configuré pour ce projet (`.claude/skills/borg/`). Lancer `/borg <description ciblée>` avant chaque release majeure. Logs dans `.claude/skills/borg/logs/`.

Historique des audits cette base :
- `BORG-2026-04-20-001-rooming-list.md` — première couche (rooming list, CSS extraction, alerte chambres_data)
- `BORG-2026-04-20-002-custom-list.md` — factory boutons + liste personnalisée + modale (fix memory leak re-entrance)

## Points hors scope / dette connue

Documentés dans les logs Borg, non corrigés car usage personnel :

- Duplication structurelle entre `formatTicketsToHTML`, `formatConsolidatedToHTML`, `formatRoomingToHTML`, `formatCustomListToHTML` (~60-70%)
- Deux systèmes de statut (`calculateRoomStatus` dans lib vs `analyzeStayNTouchStatuses` dans scraper) — dérive silencieuse possible si l'un évolue sans l'autre
- Code mort : `formatTicketsToTXT`, `formatConsolidatedToTXT`, `downloadTXT`, `createVisualTicketContent` (@deprecated), `handleFilter`, `reorganizeTicketsInDOM`, `addRoomStatusLine`, `createButton`, `updateStatus`
- Bug `originalTicketsOrder` stale si tickets modifiés entre activation/désactivation du filtre
- Accessibilité modale : pas de focus trap, `aria-*` incomplets

Avant refactor lourd : lancer `/borg` pour valider l'angle d'attaque.

## Checklist avant release

- [ ] Version bumpée dans `manifest.json`
- [ ] `node --check content-scripts/dmbook-scraper.js` → OK
- [ ] Grep `.innerHTML\s*=` → 0 match
- [ ] Test manuel : bouton tickets (rouge), rooming (violet), liste perso (orange), reset (gris)
- [ ] Test annulation modale (Escape + clic hors + bouton Annuler)
- [ ] `python build.py` → ZIP généré, `manifest.json` à la racine vérifié
- [ ] Soumission AMO
