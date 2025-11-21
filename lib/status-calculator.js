// Calculateur de statuts automatiques pour les chambres
// Détermine le statut (in/out/o/dispo) en fonction de la réservation

/**
 * Calculer le statut automatique d'une chambre
 * @param {Object} chambre - Données de la chambre
 * @returns {string} - Statut formaté: (o), (inc), (out), (dispo), (out/inc), (in/inc)
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
  
  // RÈGLE 1: (o) - Client en séjour (Stayover)
  // Current: Stayover / Next: Stayover
  if ((currentStatus.includes('Stayover') && nextStatus.includes('Stayover')) || chambre.is_stayover) {
    return '(o)';
  }
  
  // RÈGLE 2: (in) - Client DÉJÀ arrivé (rotation faite ou nouvelle arrivée)
  // Current: "Arrived / Departed" ou "Arrived" = client dans la chambre
  if (currentStatus.includes('Arrived')) {
    return '(in)';
  }
  
  // RÈGLE 3: (out/inc) - Rotation PRÉVUE, nouveau client PAS ENCORE arrivé
  // Current: Departed / Next: Arrival (futur, pas encore arrivé)
  if (currentStatus.includes('Departed') && nextStatus.includes('Arrival')) {
    const time = checkInTime || '';
    return time ? `(out/inc) ${time}` : '(out/inc)';
  }
  
  // RÈGLE 4: (in/inc) - Client encore présent + rotation prévue
  // Current: Stayover ou Inhouse / Next: Arrival (nouveau va arriver)
  if ((currentStatus.includes('Stayover') || currentStatus.includes('Inhouse')) && 
      nextStatus.includes('Arrival')) {
    const time = checkInTime || '';
    return time ? `(in/inc) ${time}` : '(in/inc)';
  }
  
  
  // RÈGLE 6: (inc) - Arrivée PRÉVUE (pas encore arrivé)
  // Current: Arrival ou Not Reserved / Next: Arrival
  if ((currentStatus.includes('Not Reserved') || currentStatus.includes('Arrival') || isVacant) && 
      nextStatus.includes('Arrival')) {
    const time = checkInTime || '';
    return time ? `(inc) ${time}` : '(inc)';
  }
  
  // RÈGLE 7: (out) - Client parti, pas de nouvelle arrivée
  // Current: Departed / Next: Not Reserved ou Departed
  if (currentStatus.includes('Departed') && 
      (nextStatus.includes('Not Reserved') || nextStatus.includes('Departed'))) {
    const time = checkOutTime || '';
    return time ? `(out) ${time}` : '(out)';
  }
  
  // RÈGLE 8: (dispo) - Chambre vide et disponible
  // Vacant + Next: Not Reserved
  if (isVacant || (currentStatus.includes('Not Reserved') && nextStatus.includes('Not Reserved'))) {
    return '(dispo)';
  }
  
  // Cas par défaut
  return '';
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
  
  if (status.includes('(in/out)')) {
    color = 'orange';
    priority = 'HAUTE';
    description = 'Rotation de client - Nettoyage urgent requis';
  } else if (status.includes('(out)')) {
    color = 'yellow';
    priority = 'MOYENNE';
    description = 'Client parti - Nettoyage requis';
  } else if (status.includes('(in)') && !status.includes('dispo')) {
    color = 'blue';
    priority = 'MOYENNE';
    description = 'Nouvelle arrivée prévue';
  } else if (status.includes('(o)')) {
    color = 'green';
    priority = 'BASSE';
    description = 'Client en séjour - Recouche';
  } else if (status.includes('(dispo)')) {
    color = 'gray';
    priority = 'BASSE';
    description = 'Chambre disponible';
  } else if (status.includes('(in/dispo)')) {
    color = 'yellow';
    priority = 'MOYENNE';
    description = 'Départ prévu - Disponible après';
  }
  
  // Ajuster la priorité si chambre DIRTY
  if (chambre.statut_proprete === 'DIRTY') {
    priority = 'HAUTE';
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

