// Calculateur de statuts automatiques pour les chambres
// Détermine le statut (in/out/o/dispo) en fonction de la réservation
// VERSION AMÉLIORÉE avec détection Day Use, OOO, et statut null

/**
 * Calculer le statut automatique d'une chambre
 * @param {Object} chambre - Données de la chambre
 * @param {Date} customTime - Heure personnalisée pour les tests (optionnel)
 * @returns {string} - Statut formaté: (o), (inc), (out), (dispo), (out/inc), (day-use), null
 */
function calculateRoomStatus(chambre, customTime = null) {
  // Obtenir l'heure actuelle pour la logique temporelle
  const currentTime = customTime || new Date();
  const currentHour = currentTime.getHours();
  // Récupérer les statuts current et next extraits du HTML
  const currentStatus = chambre.current_status || '';
  const nextStatus = chambre.next_status || '';
  const isVacant = chambre.vacant === true;

  // Extraire les heures
  const checkInTime = chambre.check_in_time || '';
  const checkOutTime = chambre.check_out_time || '';

  // Debug retiré pour console propre

  // ====== RÈGLES PRIORITAIRES ======

  // RÈGLE PRIORITAIRE 1: Bloquée (Out of Order)
  // Chambre en maintenance, pas disponible
  if (chambre.is_ooo) {
    return '(bloquée)';
  }

  // RÈGLE PRIORITAIRE 2: Day Use (arrivée et départ le même jour)
  // Détecté UNIQUEMENT par: check_in === check_out (même date)
  // Note: "Departed / Arrival" ne signifie PAS automatiquement day-use!
  if (chambre.is_day_use) {
    return '(day-use)';
  }

  // ====== RÈGLES STANDARDS ======

  // RÈGLE SPÉCIALE 1: Statut combiné "Due out / Arrival" (rotation avec client présent)
  // Current: "Due out / Arrival" = Client encore présent + nouvelle arrivée prévue
  // IMPORTANT: Ce n'est PAS un (out/inc) mais un (in/inc) car le client actuel est ENCORE LÀ
  if (currentStatus.includes('Due out / Arrival')) {
    return '(in/inc)';
  }
  
  // RÈGLE SPÉCIALE 2: Statut combiné "Departed / Arrival" (rotation avec client parti)
  // Current: "Departed / Arrival" = Client déjà parti + nouvelle arrivée prévue
  if (currentStatus.includes('Departed / Arrival')) {
    return '(out/inc)';
  }

  // RÈGLE 1: (o) - Client en séjour (Stayover)
  // Current: Stayover / Next: Stayover
  if ((currentStatus.includes('Stayover') && nextStatus.includes('Stayover')) ||
      (currentStatus.includes('Inhouse') && nextStatus.includes('Stayover'))) {
    return '(o)';
  }

  // RÈGLE 2: (in) - Client DÉJÀ arrivé (rotation faite ou nouvelle arrivée)
  // Current: "Arrived" = client dans la chambre
  if (currentStatus.includes('Arrived') && !currentStatus.includes('Departure')) {
    return '(in)';
  }

  // RÈGLE 3: (out/inc) - Rotation PRÉVUE, client parti, nouveau PAS ENCORE arrivé
  // Current: Departed / Next: Arrival (futur, pas encore arrivé)
  if (currentStatus.includes('Departed') && !currentStatus.includes('Arrival') &&
      nextStatus.includes('Arrival')) {
    return '(out/inc)';
  }

  // RÈGLE 4: (in) - Client présent (Due out), départ prévu aujourd'hui  
  // Current: Due out / Next: Due out (même client encore là physiquement, départ prévu)
  // Client PRÉSENT dans la chambre, contrairement à "Departed" (parti)
  if (currentStatus.includes('Due out') && nextStatus.includes('Due out')) {
    return '(in)';
  }

  // RÈGLE 5: (inc) - Arrivée PRÉVUE (pas encore arrivé), chambre vide
  // Current: Arrival (no-show class) ou Not Reserved / Next: Arrival
  if ((currentStatus.includes('Arrival') || currentStatus.includes('Not Reserved') || isVacant) &&
      nextStatus.includes('Arrival')) {
    return '(inc)';
  }

  // RÈGLE 6: (out)/(dispo) - Client parti (Departed), pas de nouvelle arrivée
  // LOGIQUE TEMPORELLE: Avant 14h = (out), Après 14h = (dispo)
  // Current: Departed / Next: Not Reserved ou Departed
  if (currentStatus.includes('Departed') && !currentStatus.includes('Arrival') &&
      (nextStatus.includes('Not Reserved') || nextStatus.includes('Departed'))) {
    
    // Si après 14h (2 PM), la chambre est considérée comme disponible
    if (currentHour >= 14) {
      return '(dispo)';
    }
    // Sinon, elle est encore en statut "sortie"
    return '(out)';
  }

  // RÈGLE 7: (dispo) - Chambre vide et disponible, pas de réservation
  // Vacant + Next: Not Reserved
  if ((isVacant && nextStatus.includes('Not Reserved')) ||
      (currentStatus.includes('Not Reserved') && nextStatus.includes('Not Reserved'))) {
    return '(dispo)';
  }

  // ====== CAS NON GÉRÉS ======
  // Si aucune règle ne correspond, retourner (null)
  return '(null)';
}

/**
 * Calculer le statut avec détails supplémentaires
 * @param {Object} chambre - Données de la chambre
 * @param {Date} customTime - Heure personnalisée pour les tests (optionnel)
 * @returns {Object} - {status: string, priority: string, description: string}
 */
function calculateDetailedStatus(chambre, customTime = null) {
  const status = calculateRoomStatus(chambre, customTime);

  // Déterminer la priorité et description
  let priority = 'BASSE';
  let description = '';

  // Cas spéciaux prioritaires
  if (status === '(null)') {
    priority = 'HAUTE';
    description = 'Statut non reconnu - Vérification manuelle requise';
  } else if (status.includes('(bloquée)')) {
    priority = 'BLOQUÉE';
    description = 'Chambre en maintenance';
  } else if (status.includes('(day-use)')) {
    priority = 'HAUTE';
    description = 'Rotation rapide';
  } else if (status.includes('(out/inc)')) {
    priority = 'HAUTE';
    description = 'Client parti, nouveau arrive';
  } else if (status.includes('(out/dispo)')) {
    priority = 'HAUTE';
    description = 'Départ aujourd\'hui, pas d\'arrivée';
  } else if (status.includes('(out)')) {
    priority = 'MOYENNE';
    description = 'Client parti (avant 14h)';
  } else if (status.includes('(inc)')) {
    priority = 'MOYENNE';
    description = 'Arrivée prévue et pas de client avant';
  } else if (status.includes('(in)')) {
    priority = 'BASSE';
    description = 'Client présent dans la chambre';
  } else if (status.includes('(o)')) {
    priority = 'BASSE';
    description = 'Client en séjour';
  } else if (status.includes('(dispo)')) {
    priority = 'BASSE';
    description = 'Disponible (vacant ou après 14h)';
  }

  // Ajuster la priorité si chambre DIRTY
  if (chambre.statut_proprete === 'DIRTY') {
    if (priority === 'BASSE') priority = 'MOYENNE';
    if (priority === 'MOYENNE') priority = 'HAUTE';
    // Si déjà HAUTE, reste HAUTE
  }

  // Ajuster si tickets de maintenance
  if (chambre.tickets && chambre.tickets.length > 0) {
    if (priority === 'BASSE') priority = 'MOYENNE';
    const hasUrgent = chambre.tickets.some(t => t.priorite === 'HAUTE');
    if (hasUrgent) priority = 'HAUTE';
  }

  return {
    status: status,
    priority: priority,
    description: description
  };
}

/**
 * Extraire l'heure depuis le texte de réservation
 */
function extractTime(reservationText) {
  if (!reservationText) return null;
  
  // Chercher format "02:00 pm" ou "14:00"
  const timeMatch = reservationText.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
  return timeMatch ? timeMatch[1] : null;
}

/**
 * Fonction de test pour vérifier les statuts selon l'heure
 * @param {Object} chambre - Données de la chambre
 * @returns {Object} - Comparaison avant/après 14h
 */
function testStatusByTime(chambre) {
  // Créer des heures de test
  const morning = new Date();
  morning.setHours(10, 0, 0, 0); // 10h00
  
  const afternoon = new Date();
  afternoon.setHours(16, 0, 0, 0); // 16h00
  
  const statusBefore2PM = calculateRoomStatus(chambre, morning);
  const statusAfter2PM = calculateRoomStatus(chambre, afternoon);
  
  return {
    chambre: chambre.numero,
    avant_14h: statusBefore2PM,
    apres_14h: statusAfter2PM,
    changement: statusBefore2PM !== statusAfter2PM
  };
}

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateRoomStatus,
    calculateDetailedStatus,
    extractTime,
    testStatusByTime
  };
}

// Export global pour le browser (content scripts)
if (typeof window !== 'undefined') {
  window.calculateRoomStatus = calculateRoomStatus;
  window.calculateDetailedStatus = calculateDetailedStatus;
  window.extractTime = extractTime;
  window.testStatusByTime = testStatusByTime;
}

