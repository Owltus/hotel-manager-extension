// Calculateur de statuts automatiques pour les chambres
// Détermine le statut (in/out/o/dispo) en fonction de la réservation
// VERSION AMÉLIORÉE avec détection Day Use, OOO, et statut null

/**
 * Calculer le statut automatique d'une chambre
 * @param {Object} chambre - Données de la chambre
 * @returns {string} - Statut formaté: (o), (inc), (out), (dispo), (out/inc), (day-use), null
 */
function calculateRoomStatus(chambre) {
  // Récupérer les statuts current et next extraits du HTML
  const currentStatus = chambre.current_status || '';
  const nextStatus = chambre.next_status || '';
  const isVacant = chambre.vacant === true;

  // Extraire les heures
  const checkInTime = chambre.check_in_time || '';
  const checkOutTime = chambre.check_out_time || '';

  console.log(`Chambre ${chambre.numero}: current="${currentStatus}" next="${nextStatus}" vacant=${isVacant}`);

  // ====== RÈGLES PRIORITAIRES ======

  // RÈGLE PRIORITAIRE 1: OOO (Out of Order)
  // Chambre en maintenance, pas disponible
  if (chambre.is_ooo) {
    const until = chambre.ooo_until ? ` jusqu'au ${chambre.ooo_until}` : '';
    const reason = chambre.ooo_reason ? ` (${chambre.ooo_reason})` : '';
    return `(OOO)${until}${reason}`;
  }

  // RÈGLE PRIORITAIRE 2: Day Use (arrivée et départ le même jour)
  // Détecté par: "Departed / Arrival" dans le même statut OU check_in === check_out
  if (chambre.is_day_use ||
      (currentStatus.includes('Departed') && currentStatus.includes('Arrival'))) {
    const inTime = checkInTime || '';
    const outTime = checkOutTime || '';
    if (inTime && outTime) {
      return `(day-use) ${inTime}-${outTime}`;
    }
    return '(day-use)';
  }

  // ====== RÈGLES STANDARDS ======

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
    const time = checkInTime || '';
    return time ? `(out/inc) ${time}` : '(out/inc)';
  }

  // RÈGLE 4: (out/dispo) - Client parti (Due out), pas de nouvelle arrivée
  // Current: Due out / Next: Due out (même client encore là, départ aujourd'hui)
  if (currentStatus.includes('Due out') && nextStatus.includes('Due out')) {
    const time = checkOutTime || '';
    return time ? `(out/dispo) ${time}` : '(out/dispo)';
  }

  // RÈGLE 5: (inc) - Arrivée PRÉVUE (pas encore arrivé), chambre vide
  // Current: Arrival (no-show class) ou Not Reserved / Next: Arrival
  if ((currentStatus.includes('Arrival') || currentStatus.includes('Not Reserved') || isVacant) &&
      nextStatus.includes('Arrival')) {
    const time = checkInTime || '';
    return time ? `(inc) ${time}` : '(inc)';
  }

  // RÈGLE 6: (out) - Client parti (Departed), pas de nouvelle arrivée
  // Current: Departed / Next: Not Reserved ou Departed
  if (currentStatus.includes('Departed') && !currentStatus.includes('Arrival') &&
      (nextStatus.includes('Not Reserved') || nextStatus.includes('Departed'))) {
    const time = checkOutTime || 'OUT';
    return `(out) ${time}`;
  }

  // RÈGLE 7: (dispo) - Chambre vide et disponible, pas de réservation
  // Vacant + Next: Not Reserved
  if ((isVacant && nextStatus.includes('Not Reserved')) ||
      (currentStatus.includes('Not Reserved') && nextStatus.includes('Not Reserved'))) {
    return '(dispo)';
  }

  // ====== CAS NON GÉRÉS ======
  // Si aucune règle ne correspond, retourner null
  console.warn(`Chambre ${chambre.numero}: Statut non géré - current="${currentStatus}" next="${nextStatus}"`);
  return 'null';
}

/**
 * Calculer le statut avec détails supplémentaires
 * @param {Object} chambre - Données de la chambre
 * @returns {Object} - {status: string, color: string, priority: string, description: string}
 */
function calculateDetailedStatus(chambre) {
  const status = calculateRoomStatus(chambre);

  // Déterminer la couleur et priorité
  let color = 'default';
  let priority = 'BASSE';
  let description = '';

  // Cas spéciaux prioritaires
  if (status === 'null') {
    color = 'red';
    priority = 'HAUTE';
    description = 'Statut non reconnu - Vérification manuelle requise';
  } else if (status.includes('(OOO)')) {
    color = 'purple';
    priority = 'BLOQUÉE';
    description = 'Chambre hors service - Maintenance en cours';
  } else if (status.includes('(day-use)')) {
    color = 'orange';
    priority = 'HAUTE';
    description = 'Day Use - Rotation rapide aujourd\'hui';
  } else if (status.includes('(out/inc)')) {
    color = 'orange';
    priority = 'HAUTE';
    description = 'Rotation de client - Nettoyage urgent requis';
  } else if (status.includes('(out/dispo)')) {
    color = 'yellow';
    priority = 'HAUTE';
    description = 'Client part aujourd\'hui - Nettoyage requis';
  } else if (status.includes('(out)')) {
    color = 'yellow';
    priority = 'MOYENNE';
    description = 'Client parti - Nettoyage requis';
  } else if (status.includes('(inc)')) {
    color = 'blue';
    priority = 'MOYENNE';
    description = 'Nouvelle arrivée prévue - Préparation requise';
  } else if (status.includes('(in)')) {
    color = 'blue';
    priority = 'BASSE';
    description = 'Client installé - Rien à faire';
  } else if (status.includes('(o)')) {
    color = 'green';
    priority = 'BASSE';
    description = 'Client en séjour - Recouche si nécessaire';
  } else if (status.includes('(dispo)')) {
    color = 'gray';
    priority = 'BASSE';
    description = 'Chambre disponible';
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
    color: color,
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

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateRoomStatus,
    calculateDetailedStatus,
    extractTime
  };
}

