# Documentation des Statuts de Chambres

## Vue d'ensemble

Le système de gestion des statuts de chambres analyse automatiquement l'état de chaque chambre et attribue un statut intelligent pour faciliter la gestion du housekeeping.

## Liste des Statuts

### Statuts Prioritaires (traités en premier)

#### `(OOO)` - Out of Order
**Priorité:** BLOQUÉE
**Couleur:** Violet
**Description:** Chambre hors service en maintenance

**Conditions de détection:**
- Présence d'un élément `.service-status` dans le HTML
- Chambre non disponible temporairement pour raison technique

**Exemple d'affichage:**
- `(OOO) jusqu'au 24-11-2025 (Out of Order)`

**Action requise:** Attendre la fin de la maintenance

---

#### `(day-use)` - Day Use
**Priorité:** HAUTE
**Couleur:** Orange
**Description:** Arrivée et départ le même jour (rotation rapide)

**Conditions de détection:**
- Statut combiné: "Departed / Arrival" dans le même span
- OU dates check-in et check-out identiques

**Exemple d'affichage:**
- `(day-use) 09:00 am-02:00 pm`

**Action requise:** Nettoyage rapide entre les deux clients (rotation dans la journée)

---

### Statuts Standards

#### `(o)` - Occupé (Stayover)
**Priorité:** BASSE (MOYENNE si DIRTY)
**Couleur:** Vert
**Description:** Client en séjour, reste dans la chambre

**Conditions de détection:**
- Current: "Stayover" / Next: "Stayover"
- OU Current: "Inhouse" / Next: "Stayover"

**Action requise:** Recouche (nettoyage léger) si client autorise

---

#### `(in)` - Client Installé
**Priorité:** BASSE
**Couleur:** Bleu
**Description:** Client déjà arrivé et installé

**Conditions de détection:**
- Current: "Arrived" (sans "Departure")

**Action requise:** Rien à faire, client dans la chambre

---

#### `(out/inc)` - Rotation Prévue
**Priorité:** HAUTE
**Couleur:** Orange
**Description:** Client parti, nouveau client arrive bientôt

**Conditions de détection:**
- Current: "Departed" (sans "Arrival")
- Next: "Arrival"

**Exemple d'affichage:**
- `(out/inc) 02:00 pm`

**Action requise:** Nettoyage complet urgent avant l'arrivée du prochain client

---

#### `(out/dispo)` - Départ Aujourd'hui
**Priorité:** HAUTE
**Couleur:** Jaune
**Description:** Client encore en chambre, part aujourd'hui, pas de nouvelle arrivée

**Conditions de détection:**
- Current: "Due out"
- Next: "Due out" (même client)

**Exemple d'affichage:**
- `(out/dispo) 02:00 pm`

**Action requise:** Attendre le départ puis nettoyage complet

---

#### `(inc)` - Arrivée Prévue
**Priorité:** MOYENNE
**Couleur:** Bleu
**Description:** Nouvelle arrivée attendue, chambre vide

**Conditions de détection:**
- Current: "Arrival" ou "Not Reserved" (chambre vide)
- Next: "Arrival"

**Exemple d'affichage:**
- `(inc) 02:00 pm`

**Action requise:** Préparer la chambre avant l'arrivée

---

#### `(out)` - Client Parti
**Priorité:** MOYENNE (HAUTE si DIRTY)
**Couleur:** Jaune
**Description:** Client déjà parti, pas de nouvelle arrivée imminente

**Conditions de détection:**
- Current: "Departed" (sans "Arrival")
- Next: "Not Reserved" ou "Departed"

**Exemple d'affichage:**
- `(out) OUT`

**Action requise:** Nettoyage complet

---

#### `(dispo)` - Disponible
**Priorité:** BASSE
**Couleur:** Gris
**Description:** Chambre vide et disponible, aucune réservation

**Conditions de détection:**
- Vacant = true
- Current: "Not Reserved" / Next: "Not Reserved"

**Action requise:** Maintenir propre pour disponibilité

---

#### `null` - Statut Non Reconnu
**Priorité:** HAUTE
**Couleur:** Rouge
**Description:** Situation non gérée par le système

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
Check-out time: "02:00 pm"
→ Statut: (out/dispo) 02:00 pm
```

### Exemple 2: Chambre 108 (Day Use)
```
Current: "Arrival" (no-show class)
Next: "Arrival"
Check-in: "2025-11-21"
Check-out: "2025-11-21"
→ Statut: (day-use) 09:00 am-02:00 pm
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
→ Statut: (out) OUT
```

### Exemple 5: Chambre 211 (OOO)
```
Service status: "OOO until 24-11-2025 (Out of Order)"
→ Statut: (OOO) jusqu'au 24-11-2025 (Out of Order)
```

---

## Tableau Récapitulatif

| Statut | Priorité | Couleur | Action |
|--------|----------|---------|--------|
| `(OOO)` | BLOQUÉE | Violet | Attendre fin maintenance |
| `(day-use)` | HAUTE | Orange | Rotation rapide |
| `(out/inc)` | HAUTE | Orange | Nettoyage urgent |
| `(out/dispo)` | HAUTE | Jaune | Départ + nettoyage |
| `(out)` | MOYENNE | Jaune | Nettoyage complet |
| `(inc)` | MOYENNE | Bleu | Préparer chambre |
| `(in)` | BASSE | Bleu | Client installé |
| `(o)` | BASSE | Vert | Recouche |
| `(dispo)` | BASSE | Gris | Maintenir propre |
| `null` | HAUTE | Rouge | Vérification manuelle |

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
