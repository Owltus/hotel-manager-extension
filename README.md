# 🏨 Hotel Manager - Extension Firefox

> Extension Firefox pour scraper et consolider automatiquement les données de chambres d'hôtel depuis StayNTouch PMS et Dmbook Pro.

**100% LOCALE** • **GRATUITE** • **OPEN SOURCE** • **AUCUNE API EXTERNE**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/votre-username/hotel-manager-extension)
[![Firefox](https://img.shields.io/badge/Firefox-109%2B-orange.svg)](https://www.mozilla.org/firefox/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📸 Aperçu

![Interface de l'extension](https://via.placeholder.com/500x300/1a73e8/ffffff?text=Hotel+Manager+Interface)

**Interface minimaliste** avec code couleur intelligent et workflow optimisé.

---

## ✨ Fonctionnalités

### 🎯 Scraping Intelligent
- ✅ **Dmbook Pro** : Extraction et formatage automatique des tickets de maintenance
- ✅ **StayNTouch PMS** : Scraping multi-pages mode cumulatif (80 chambres)
- ✅ **Vérification automatique** : Liste hardcodée pour détecter les chambres manquantes

### 📊 Formatage Automatique
- ✅ **Organisation par niveaux** : Tickets groupés par étage (100, 200, 300...)
- ✅ **Nettoyage intelligent** : Suppression automatique des métadonnées (auteur, IDs, dates)
- ✅ **Section DIVERS** : Tickets sans numéro de chambre séparés

### 🎨 Statuts Automatiques
Calcul automatique de 7 statuts selon l'occupation :
- **(o)** - Occupé, séjour multiple nuits
- **(in)** - Client arrivé, dans la chambre
- **(inc)** - Arrivée prévue + heure
- **(out)** - Départ prévu/fait + heure
- **(dispo)** - Disponible, vide
- **(out/inc)** - Rotation : client parti, nouveau arrive
- **(in/inc)** - Rotation : client encore là, nouveau arrive

### 💾 Export Double
- 📄 **CSV** : Tableau complet des chambres avec statuts
- 📝 **TXT** : Liste formatée des tickets par niveau avec statuts intégrés

### 🎨 Interface Visuelle
- **Code couleur** : 🔵 Bleu (à faire) • 🟠 Orange (en cours) • ✅ Vert (validé) • ⚫ Grisé (désactivé)
- **Activation contextuelle** : Boutons activés selon le site visité
- **Persistance** : Données sauvegardées entre les pages

---

## 🚀 Installation Rapide

### Prérequis
- Firefox 109+ (ou Firefox Developer Edition)
- Accès à StayNTouch PMS et Dmbook Pro

### Installation en 3 étapes

1️⃣ **Générer les icônes**
```
Ouvrir : icons/generate-icons.html dans votre navigateur
→ Télécharger les 3 icônes PNG
→ Les placer dans le dossier icons/
```

2️⃣ **Charger l'extension**
```
Firefox → about:debugging
→ "Ce Firefox"
→ "Charger un module complémentaire temporaire"
→ Sélectionner manifest.json
```

3️⃣ **C'est prêt !** 🎉

---

## 📖 Utilisation

### Workflow Simple

```
1. Dmbook Pro → Scraper tickets → ✅ Vert (19 tickets)
2. StayNTouch page 1 → Scraper → 🟠 Orange (50/80)
3. StayNTouch page 2 → Scraper → ✅ Vert (80/80)
   → Consolidation automatique (1 sec)
4. Exporter → 2 fichiers téléchargés
```

### Interface

```
┌─────────────────────────────────────────┐
│ 📊 Export                               │
│ ┌────────┬─────────┬─────────┐         │
│ │  80/80 │   19    │[Export] │         │
│ │Chambres│ Tickets │[Reset]  │         │
│ └────────┴─────────┴─────────┘         │
│                                         │
│ ┌──────────────────┬──────────────────┐ │
│ │ Dmbook Tickets   │ Stayntouch       │ │
│ │ [Scraper|Aperçu] │ [   Scraper    ] │ │
│ └──────────────────┴──────────────────┘ │
└─────────────────────────────────────────┘
```

### Fichiers Exportés

**hotel-tickets-2025-11-20.txt** :
```
LISTE DES TICKETS DE MAINTENANCE
Date : 20/11/2025

----------

#107 refixer la butée porte (o)

#112 retouche peinture mur (in)

#213 Dalle sol à changer (out)

----------

Total de tickets : 19
```

**hotel-chambres-2025-11-20.csv** :
```csv
Chambre,Statut_Proprete,Type,Statut_Auto,Reservation,Tickets,Priorite
102,CLEAN,Confort,(in),Arrived/Departed,0,BASSE
213,DIRTY,Classique,(out),Departed,2,HAUTE
```

---

## 🔧 Architecture Technique

### Structure du Projet

```
hotel-manager-extension/
├── manifest.json              # Configuration Manifest V3
├── popup/
│   ├── popup.html            # Interface utilisateur
│   ├── popup.css             # Styles
│   └── popup.js              # Logique UI et workflow
├── background/
│   └── service-worker.js     # Traitement local des données
├── content-scripts/
│   ├── stayntouch-scraper.js # Extraction chambres (mode cumulatif)
│   └── dmbook-scraper.js     # Extraction tickets
├── lib/
│   ├── config.js             # Configuration
│   ├── rooms-list.js         # Liste des 80 chambres
│   └── status-calculator.js  # Calcul statuts automatiques
└── icons/                     # Icônes 16x16, 48x48, 128x128
```

### Technologies

- **Manifest V3** : Standard moderne Firefox
- **Vanilla JavaScript** : Aucune dépendance
- **browser.storage.local** : Persistance des données
- **Content Scripts** : Injection dans les pages web
- **Service Worker** : Traitement en arrière-plan

### Traitement 100% Local

Toutes les opérations sont effectuées localement :
- ✅ Extraction HTML → JavaScript natif
- ✅ Formatage par niveaux → Algorithme local
- ✅ Consolidation → Matching par regex
- ✅ Calcul statuts → Logique conditionnelle
- ✅ Export → Génération CSV/TXT locale

**Aucune donnée n'est jamais envoyée à l'extérieur** 🔒

---

## 📊 Calcul des Statuts

L'extension analyse les données de réservation pour calculer automatiquement le statut de chaque chambre :

| Statut | Signification | HTML Détecté | Priorité |
|--------|---------------|--------------|----------|
| **(o)** | Client en séjour | Stayover / Stayover | BASSE |
| **(in)** | Client arrivé | Arrived | BASSE |
| **(inc)** | Arrivée prévue | Arrival + heure | MOYENNE |
| **(out)** | Départ | Departed | MOYENNE |
| **(dispo)** | Disponible | Vacant | BASSE |
| **(out/inc)** | Rotation prévue | Departed + Arrival | HAUTE |
| **(in/inc)** | Rotation client présent | Stayover + Arrival | HAUTE |

---

## 🎯 Cas d'Usage

### Gestionnaire de Maintenance Hôtelière

**Problème** : Données dispersées sur 2 systèmes différents
- StayNTouch → Statuts des chambres (80 chambres sur 2 pages)
- Dmbook Pro → Tickets de maintenance (19 tickets)

**Solution** : Extension qui consolide tout en 1 clic
- Vue unifiée par niveau (étage)
- Statuts automatiques pour priorisation
- Export pour impression/partage

**Résultat** :
- ⏱️ Gain de temps : 15 min → 2 min
- 📊 Vue consolidée claire
- 🎯 Priorisation automatique

---

## 🛠️ Installation sur Plusieurs PC

### Option 1 : Extension Temporaire (Firefox normal)

**Sur chaque PC** :
1. Extraire le dossier de l'extension
2. `about:debugging` → Charger module temporaire
3. ⚠️ **Recharger à chaque démarrage de Firefox**

### Option 2 : Firefox Developer Edition ⭐ (Recommandé)

**Sur chaque PC** :
1. Installer [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/)
2. Charger l'extension **UNE SEULE FOIS**
3. ✅ **Persiste entre les redémarrages**

### Option 3 : Publication Mozilla Add-ons (Officiel)

**Une fois pour tous** :
1. Soumettre à [Mozilla Add-ons](https://addons.mozilla.org)
2. Validation (~1 semaine)
3. Installation permanente pour tout le monde

---

## 🐛 Débogage

### Vérifier les données persistantes

```javascript
// Dans la console du popup (clic droit → Inspecter)
browser.storage.local.get(null).then(data => {
  console.log('Chambres:', data.chambres_data?.total || 0);
  console.log('Tickets:', data.tickets_data?.tickets.length || 0);
  console.log('Consolidé:', data.consolidated_data ? 'Oui' : 'Non');
});
```

### Effacer toutes les données

```javascript
browser.storage.local.clear().then(() => console.log('Storage effacé'));
```

### Logs Console

**Service Worker** : `about:debugging` → Inspecter  
**Popup** : Clic droit sur popup → Inspecter  
**Content Script** : F12 sur la page web

---

## 📦 Données de l'Hôtel

L'extension est configurée pour **80 chambres** :
- Niveau 100 : 13 chambres (102-114)
- Niveau 200 : 14 chambres (201-214)
- Niveau 300 : 14 chambres (301-314)
- Niveau 400 : 14 chambres (401-414)
- Niveau 500 : 14 chambres (501-514)
- Niveau 600 : 11 chambres (621-631)

Modification possible dans `lib/rooms-list.js`

---

## 🔐 Sécurité et Confidentialité

- ✅ **Traitement 100% local** : Aucun serveur externe
- ✅ **Données privées** : Restent dans votre navigateur
- ✅ **Aucune télémétrie** : Pas de tracking
- ✅ **Open source** : Code auditable
- ✅ **Permissions minimales** : Seulement storage + activeTab

---

## 🤝 Contribution

Les contributions sont les bienvenues !

### Pour contribuer :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit vos changements (`git commit -m 'Ajout fonctionnalité'`)
4. Push (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

### Idées d'améliorations :
- [ ] Support d'autres PMS (Opera, Mews, etc.)
- [ ] Export PDF avec mise en forme
- [ ] Graphiques de statistiques
- [ ] Mode dark
- [ ] Configuration visuelle des sélecteurs CSS
- [ ] Multi-langues

---

## 📝 Changelog

### Version 1.0.0 (2025-11-20)

**Fonctionnalités principales** :
- ✅ Scraping Dmbook Pro (tickets maintenance)
- ✅ Scraping StayNTouch PMS (statuts chambres, mode cumulatif)
- ✅ Formatage automatique par niveaux
- ✅ Calcul automatique de 7 statuts
- ✅ Consolidation locale
- ✅ Export CSV + TXT
- ✅ Interface avec code couleur
- ✅ Persistance des données

**Optimisations** :
- ✅ 100% local (retrait API Claude)
- ✅ Mode cumulatif multi-pages
- ✅ Consolidation automatique à 80/80
- ✅ Vérification contre liste hardcodée

---

## 📄 Licence

MIT License - Utilisation libre pour usage personnel et commercial.

---

## 👤 Auteur

Créé pour OKKO HOTELS par Pierre-Louis

---

## 🆘 Support

### Documentation

- **Installation** : Voir section ci-dessus
- **Workflow** : 1. Tickets → 2. Chambres (multi-pages) → 3. Export automatique
- **Statuts** : 7 statuts calculés automatiquement (voir tableau ci-dessus)
- **Débogage** : Console F12 pour logs détaillés

### Problèmes Courants

**"Aucune chambre détectée"**  
→ Attendre le chargement complet de la page Angular

**"Données incomplètes"**  
→ Vérifier que vous avez les tickets ET 80/80 chambres (2 boutons verts)

**"Bouton Export désactivé"**  
→ Il faut les 2 boutons verts + consolidation auto terminée

**Extension disparaît au redémarrage**  
→ Normal avec extension temporaire. Utiliser Firefox Developer Edition pour persistance.

### Reporting de Bugs

Ouvrir une [issue sur GitHub](https://github.com/votre-username/hotel-manager-extension/issues) avec :
- Description du problème
- Étapes pour reproduire
- Logs de la console (F12)
- Version de Firefox

---

## 🎯 Roadmap

### Version 1.1 (Prochaine)
- [ ] Configuration visuelle des sélecteurs CSS
- [ ] Support pagination automatique
- [ ] Export PDF formaté

### Version 2.0 (Future)
- [ ] Support multi-hôtels
- [ ] Dashboard avec graphiques
- [ ] Historique des exports
- [ ] Mode hors-ligne avancé

---

## 🙏 Remerciements

- StayNTouch PMS pour le système de gestion
- Dmbook Pro pour le système de tickets
- Mozilla pour l'excellent support des WebExtensions

---

## 📞 Contact

Pour questions ou suggestions :
- 📧 Email : [votre-email]
- 🐙 GitHub Issues : [lien repo]
- 💬 Discussions : [lien discussions]

---

<div align="center">

**⭐ Si cette extension vous est utile, n'hésitez pas à mettre une étoile sur GitHub ! ⭐**

Made with ❤️ for hotel management

</div>
