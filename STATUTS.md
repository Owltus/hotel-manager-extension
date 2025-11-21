# Documentation des Statuts de Chambres

## Vue d'ensemble

Le système de gestion des statuts de chambres analyse automatiquement l'état de chaque chambre et attribue un statut intelligent pour faciliter la gestion du housekeeping.

## Liste des Statuts

### Statuts Prioritaires (traités en premier)

#### `(bloquée)` - Chambre Bloquée
**Priorité:** BLOQUÉE
**Description:** Chambre en maintenance

**Conditions de détection:**
- Présence d'un élément `.service-status` dans le HTML
- Chambre non disponible temporairement pour raison technique

**Exemple d'affichage:**
- `(bloquée)`

**Action requise:** Attendre la fin de la maintenance

---

#### `(day-use)` - Day Use
**Priorité:** HAUTE
**Description:** Rotation rapide

**Conditions de détection:**
- Statut combiné: "Departed / Arrival" dans le même span
- OU dates check-in et check-out identiques

**Exemple d'affichage:**
- `(day-use)`

**Action requise:** Nettoyage rapide entre les deux clients (rotation dans la journée)

---

### Statuts Standards

#### `(o)` - Occupé (Stayover)
**Priorité:** BASSE (MOYENNE si DIRTY)
**Description:** Client en séjour

**Conditions de détection:**
- Current: "Stayover" / Next: "Stayover"
- OU Current: "Inhouse" / Next: "Stayover"

**Action requise:** Recouche (nettoyage léger) si client autorise

---

#### `(in)` - Client Installé
**Priorité:** BASSE
**Description:** Client installé peut importe si il y en avait un avant

**Conditions de détection:**
- Current: "Arrived" (sans "Departure")

**Action requise:** Rien à faire, client dans la chambre

---

#### `(out/inc)` - Rotation Prévue
**Priorité:** HAUTE
**Description:** Client parti, nouveau arrive

**Conditions de détection:**
- Current: "Departed" (sans "Arrival")
- Next: "Arrival"

**Exemple d'affichage:**
- `(out/inc)`

**Action requise:** Nettoyage complet urgent avant l'arrivée du prochain client

---

#### `(out/dispo)` - Départ Aujourd'hui
**Priorité:** HAUTE
**Description:** Départ aujourd'hui, pas d'arrivée

**Conditions de détection:**
- Current: "Due out"
- Next: "Due out" (même client)

**Exemple d'affichage:**
- `(out/dispo)`

**Action requise:** Attendre le départ puis nettoyage complet

---

#### `(inc)` - Arrivée Prévue
**Priorité:** MOYENNE
**Description:** Arrivée prévue et pas de client avant

**Conditions de détection:**
- Current: "Arrival" ou "Not Reserved" (chambre vide)
- Next: "Arrival"

**Exemple d'affichage:**
- `(inc)`

**Action requise:** Préparer la chambre avant l'arrivée

---

#### `(out)` - Client Parti
**Priorité:** MOYENNE (HAUTE si DIRTY)
**Description:** Client parti et du coup de nouveau qui arrive

**Conditions de détection:**
- Current: "Departed" (sans "Arrival")
- Next: "Not Reserved" ou "Departed"

**Exemple d'affichage:**
- `(out)`

**Action requise:** Nettoyage complet

---

#### `(dispo)` - Disponible
**Priorité:** BASSE
**Description:** Disponible

**Conditions de détection:**
- Vacant = true
- Current: "Not Reserved" / Next: "Not Reserved"

**Action requise:** Maintenir propre pour disponibilité

---

#### `null` - Statut Non Reconnu
**Priorité:** HAUTE
**Description:** Statut non reconnu - Vérification manuelle requise

**Conditions de détection:**
- Aucune règle ne correspond aux statuts détectés
- Configuration inhabituelle dans le PMS

**Action requise:** Vérification manuelle requise, signaler l'anomalie

---

## Règles de Priorité

Les priorités sont ajustées automatiquement selon:

1. **Statut de propreté:**
   - Si chambre DIRTY: priorité augmentée
   - BASSE → MOYENNE
   - MOYENNE → HAUTE

2. **Tickets de maintenance:**
   - Présence de tickets: BASSE → MOYENNE
   - Tickets urgents: HAUTE

---

## Exemples Réels

### Exemple 1: Chambre 109
```
Current: "Due out"
Next: "Due out"
→ Statut: (out/dispo)
```

### Exemple 2: Chambre 108 (Day Use)
```
Current: "Arrival" (no-show class)
Next: "Arrival"
Check-in: "2025-11-21"
Check-out: "2025-11-21"
→ Statut: (day-use)
```

### Exemple 3: Chambre 103 (Stayover)
```
Current: "Stayover"
Next: "Stayover"
→ Statut: (o)
```

### Exemple 4: Chambre 102 (Departed)
```
Current: "Departed"
Next: "Departed"
→ Statut: (out)
```

### Exemple 5: Chambre 211 (Bloquée)
```
Service status: "OOO until 24-11-2025 (Out of Order)"
→ Statut: (bloquée)
```

---

## Tableau Récapitulatif

| Statut | Priorité | Description |
|--------|----------|-------------|
| `(bloquée)` | BLOQUÉE | Chambre en maintenance |
| `(day-use)` | HAUTE | Rotation rapide |
| `(out/inc)` | HAUTE | Client parti, nouveau arrive |
| `(out/dispo)` | HAUTE | Départ aujourd'hui, pas d'arrivée |
| `null` | HAUTE | Statut non reconnu - Vérification manuelle requise |
| `(out)` | MOYENNE | Client parti et du coup de nouveau qui arrive |
| `(inc)` | MOYENNE | Arrivée prévue et pas de client avant |
| `(in)` | BASSE | Client installé peut importe si il y en avait un avant |
| `(o)` | BASSE | Client en séjour |
| `(dispo)` | BASSE | Disponible |

---

## Notes Techniques

### Détection des Statuts Combinés
Le scraper détecte automatiquement les statuts combinés comme "Departed / Arrival" qui indiquent un day use.

### Classes CSS Utilisées
Le système analyse les classes CSS des éléments:
- `.check-out`, `.check-in`, `.inhouse`, `.no-show`
- `.current`, `.next`
- `.guest-status`

### Gestion des Cas Limites
- Si aucun statut ne correspond aux règles: retourne `null`
- Log d'avertissement dans la console pour debugging
- Couleur rouge pour attirer l'attention

---

## Mise à Jour

**Version:** 2.0
**Date:** Novembre 2025
**Améliorations:**
- ✅ Ajout du statut Day Use
- ✅ Gestion des chambres OOO
- ✅ Statut "null" pour cas non gérés
- ✅ Meilleure distinction "Due out"
- ✅ Détection des statuts combinés
- ✅ Priorités ajustées automatiquement
