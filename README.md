# Hotel Manager Extension

Extension Firefox/Chrome (Manifest V3) pour simplifier le quotidien d'un hôtel de 80 chambres utilisant **StayNTouch PMS** et **Dmbook Pro**.

## Fonctionnalités

- **Scraping automatique** des données de chambres depuis StayNTouch (statut, arrivées, départs, day-use, OOO/OOS)
- **Scraping automatique** des tickets de maintenance depuis Dmbook Pro
- **4 boutons** ajoutés dans l'interface Dmbook (section TECHNIQUE) :
  - 🔴 **Tickets de maintenance** — PDF consolidé avec statuts colorés
  - 🟣 **Rooming list** — PDF compact avec dispo par étage, comptage temps réel
  - 🟠 **Liste personnalisée** — PDF 2 colonnes avec titre libre (checklist chambres)
  - ⚪ **Reset** — purge le cache local
- **Filtrage des tickets** par numéro de chambre dans la vue Dmbook
- **Affichage enrichi** des tickets Dmbook avec badges statut colorés (IN, OUT, INC, DISPO, RECOUCHE, etc.)

## Installation

### Firefox (AMO)

À venir — en cours de soumission sur addons.mozilla.org.

### Installation manuelle (dev)

1. Cloner le repo
2. Firefox : `about:debugging` → « Ce Firefox » → « Charger un module complémentaire temporaire » → sélectionner `manifest.json`
3. Chrome : `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → dossier du repo

## Structure

```
manifest.json              MV3 config
background/                service worker (scraping StayNTouch)
content-scripts/           injection dans StayNTouch + Dmbook
lib/                       utilitaires partagés (calcul statuts, liste chambres)
popup/                     popup de l'extension
icons/                     icônes 16/48/128
build.py                   packaging ZIP pour AMO
CLAUDE.md                  guide dev (conventions, workflow release)
```

## Build

```bash
python build.py
```

Génère `hotel-manager-extension-vX.Y.Z.zip` avec `manifest.json` à la racine, prêt pour soumission AMO. Version lue automatiquement depuis `manifest.json`.

## Usage

1. Ouvrir StayNTouch → l'extension scrape automatiquement les chambres en arrière-plan
2. Ouvrir Dmbook Pro → les 4 boutons apparaissent dans la section TECHNIQUE
3. Cliquer sur le bouton désiré → génération du PDF ou action

Les données sont stockées localement via `browser.storage.local`. Aucun envoi externe.

## Licence

Usage personnel / interne.
