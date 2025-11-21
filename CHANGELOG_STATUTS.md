# Changelog - Amélioration du Système de Statuts

## Version 2.0 - Novembre 2025

### 🎯 Objectif
Améliorer le système de détection et de calcul des statuts de chambres pour le rendre plus intelligent, flexible et exhaustif.

---

## 🚀 Nouvelles Fonctionnalités

### 1. Détection du Day Use
- **Nouveau statut:** `(day-use)`
- **Détection:** Arrivée et départ le même jour
- **Identification:**
  - Statut combiné "Departed / Arrival" dans le HTML
  - OU dates check-in et check-out identiques
- **Affichage:** `(day-use) 09:00 am-02:00 pm`
- **Priorité:** HAUTE

### 2. Gestion des Chambres OOO (Out of Order)
- **Nouveau statut:** `(OOO)`
- **Détection:** Élément `.service-status` présent
- **Extraction:**
  - Raison de maintenance
  - Date de fin prévue
- **Affichage:** `(OOO) jusqu'au 24-11-2025 (Out of Order)`
- **Priorité:** BLOQUÉE (nouvelle priorité)

### 3. Statut "null" pour Cas Non Gérés
- **Nouveau statut:** `null`
- **Utilisation:** Quand aucune règle ne correspond
- **Affichage:** `null`
- **Priorité:** HAUTE avec alerte rouge
- **Action:** Vérification manuelle requise

### 4. Statut "Due out" Amélioré
- **Nouveau statut:** `(out/dispo)`
- **Distinction claire:**
  - `(out/dispo)` : Client part aujourd'hui, pas de nouvelle arrivée
  - `(out/inc)` : Client parti, nouvelle arrivée prévue
- **Priorité:** HAUTE

---

## 🔧 Améliorations Techniques

### Scraper (`stayntouch-scraper.js`)

#### Nouvelles Extractions:
```javascript
// Classes CSS pour contexte supplémentaire
current_classes: ['guest-status', 'check-out', ...]
next_classes: ['guest-status', 'check-in', ...]

// Détection statuts combinés
is_combined_status: true/false

// Détection Day Use
is_day_use: true/false

// Détection OOO
is_ooo: true/false
ooo_reason: "Out of Order"
ooo_until: "24-11-2025"
```

#### Améliorations de Détection:
- ✅ Extraction des classes CSS pour meilleur contexte
- ✅ Détection automatique des statuts combinés (`/`)
- ✅ Identification des chambres OOO via `.service-status`
- ✅ Parsing des dates et raisons de maintenance
- ✅ Flag `is_day_use` pour identification rapide

### Calculateur (`status-calculator.js`)

#### Nouvelle Architecture:
```javascript
// RÈGLES PRIORITAIRES (traitées en premier)
1. OOO (Out of Order)
2. Day Use

// RÈGLES STANDARDS
3. Stayover (o)
4. Client installé (in)
5. Rotation prévue (out/inc)
6. Départ aujourd'hui (out/dispo)
7. Arrivée prévue (inc)
8. Client parti (out)
9. Disponible (dispo)

// CAS NON GÉRÉS
10. null (avec warning console)
```

#### Logique Améliorée:
- ✅ Ordre de priorité clair (prioritaires → standards → null)
- ✅ Détection plus précise des rotations
- ✅ Distinction "Due out" avec/sans nouvelle arrivée
- ✅ Logs détaillés pour debugging
- ✅ Warning console pour statuts non reconnus

#### Priorités Automatiques:
```javascript
// Ajustement si chambre DIRTY
BASSE → MOYENNE
MOYENNE → HAUTE

// Ajustement si tickets de maintenance
BASSE → MOYENNE
Tickets urgents → HAUTE
```

---

## 📊 Comparaison Avant/Après

### Avant (v1.0)
| Situation | Statut Retourné | Problème |
|-----------|-----------------|----------|
| Day Use | `''` (vide) | ❌ Non détecté |
| OOO | `''` (vide) | ❌ Non géré |
| Due out sans arrivée | `(out)` | ⚠️ Ambigu |
| Cas non géré | `''` (vide) | ❌ Silencieux |

### Après (v2.0)
| Situation | Statut Retourné | Amélioration |
|-----------|-----------------|--------------|
| Day Use | `(day-use) 09:00-14:00` | ✅ Détecté avec heures |
| OOO | `(OOO) jusqu'au 24-11-2025` | ✅ Géré avec détails |
| Due out sans arrivée | `(out/dispo) 02:00 pm` | ✅ Précis |
| Cas non géré | `null` + warning | ✅ Visible et alerté |

---

## 🎨 Nouvelles Couleurs et Priorités

| Statut | Couleur | Priorité | Changement |
|--------|---------|----------|------------|
| `(OOO)` | Violet | BLOQUÉE | 🆕 Nouveau |
| `(day-use)` | Orange | HAUTE | 🆕 Nouveau |
| `(out/dispo)` | Jaune | HAUTE | 🆕 Nouveau |
| `null` | Rouge | HAUTE | 🆕 Nouveau |
| `(out/inc)` | Orange | HAUTE | ✓ Inchangé |
| `(out)` | Jaune | MOYENNE | ✓ Inchangé |
| `(inc)` | Bleu | MOYENNE | ✓ Inchangé |
| `(in)` | Bleu | BASSE | ✓ Inchangé |
| `(o)` | Vert | BASSE | ✓ Inchangé |
| `(dispo)` | Gris | BASSE | ✓ Inchangé |

---

## 📝 Exemples de Détection Réels

### Exemple 1: Chambre 401 (Day Use)
**HTML:**
```html
<div class="current check-out">
  <span class="guest-status check-out">Departed / Arrival</span>
  <span class="reservation-time">OUT</span>
</div>
<div class="next check-in">
  <span class="guest-status check-in">Departed / Arrival</span>
  <span class="reservation-time">02:00 pm</span>
</div>
```
**Résultat:**
```javascript
current_status: "Departed / Arrival"
next_status: "Departed / Arrival"
is_combined_status: true
is_day_use: true
→ Statut final: "(day-use) 02:00 pm"
```

### Exemple 2: Chambre 211 (OOO)
**HTML:**
```html
<span class="service-status">OOO until <strong>24-11-2025</strong>
  <span class="service-status-reason">(Out of Order)</span>
</span>
```
**Résultat:**
```javascript
is_ooo: true
ooo_reason: "(Out of Order)"
ooo_until: "24-11-2025"
→ Statut final: "(OOO) jusqu'au 24-11-2025 (Out of Order)"
```

### Exemple 3: Chambre 109 (Due out)
**HTML:**
```html
<div class="current check-out">
  <span class="guest-status check-out">Due out</span>
  <span class="reservation-time">02:00 pm</span>
</div>
<div class="next no-show">
  <span class="guest-status no-show">Due out</span>
</div>
```
**Résultat:**
```javascript
current_status: "Due out"
next_status: "Due out"
→ Statut final: "(out/dispo) 02:00 pm"
```

---

## 🐛 Corrections de Bugs

### 1. Ambiguïté "Due out"
**Avant:** Impossible de distinguer si nouvelle arrivée ou non
**Après:**
- `(out/dispo)` : pas de nouvelle arrivée
- `(out/inc)` : rotation prévue

### 2. Statuts combinés ignorés
**Avant:** "Departed / Arrival" traité comme simple "Departed"
**Après:** Détecté comme Day Use avec priorité haute

### 3. Cas non gérés silencieux
**Avant:** Retourne chaîne vide sans avertissement
**Après:** Retourne `null` avec warning console et alerte visuelle

---

## 🧪 Tests Recommandés

### Scénarios à Tester:

1. **Day Use:**
   - Chambre avec arrivée et départ même jour
   - Vérifier affichage des heures
   - Priorité HAUTE confirmée

2. **OOO:**
   - Chambre en maintenance
   - Extraction date et raison
   - Priorité BLOQUÉE

3. **Due out:**
   - Avec nouvelle arrivée → `(out/inc)`
   - Sans nouvelle arrivée → `(out/dispo)`

4. **Cas limite:**
   - Statut HTML invalide
   - Vérifier retour `null`
   - Warning dans console

5. **Stayover classique:**
   - Aucun changement de comportement
   - Statut `(o)` confirmé

---

## 📚 Documentation

### Nouveaux Fichiers:
- ✅ `STATUTS.md` : Documentation complète de tous les statuts
- ✅ `CHANGELOG_STATUTS.md` : Ce fichier (historique des modifications)

### Fichiers Modifiés:
- ✅ `content-scripts/stayntouch-scraper.js` : +50 lignes
- ✅ `lib/status-calculator.js` : Refonte complète (~100 lignes modifiées)

---

## 🔮 Améliorations Futures Possibles

1. **Détection No-Show:**
   - Client n'est pas arrivé alors que prévu
   - Statut `(no-show)`

2. **Late Checkout:**
   - Client demande départ tardif
   - Statut `(late-out)`

3. **Early Check-in:**
   - Client arrive plus tôt que prévu
   - Statut `(early-in)`

4. **Multi-room Tracking:**
   - Groupes occupant plusieurs chambres
   - Lien visuel entre chambres

5. **Historique:**
   - Tracking des changements de statut
   - Timeline par chambre

---

## 👥 Contribution

**Développé par:** Claude Code AI
**Demandé par:** Utilisateur (français)
**Date:** Novembre 2025
**Version:** 2.0

---

## 📞 Support

En cas de problème ou question:
1. Vérifier `STATUTS.md` pour documentation complète
2. Consulter console browser pour warnings
3. Statut `null` = vérification manuelle requise
