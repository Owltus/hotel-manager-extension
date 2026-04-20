// Configuration de l'extension
// Extension 100% locale - Aucune API externe requise

const CONFIG = {
  // Sites cibles
  SITES: {
    STAYNTOUCH: {
      name: 'StayNTouch PMS',
      pattern: '*://*.stayntouch.com/*'
    },
    DMBOOK: {
      name: 'Dmbook Pro',
      pattern: '*://*.dmbook.pro/*'
    }
  },
  
  // Configuration de scraping (optimisé pour la stabilité)
  SCRAPING: {
    WAIT_TIME: 5000, // Temps d'attente pour le chargement Angular (ms) - augmenté pour stabilité
    MAX_RETRIES: 5, // Nombre de tentatives - augmenté pour fiabilité
    TIMEOUT: 30000
  },
  
  // Volume de chambres
  EXPECTED_ROOM_COUNT: 80,
  
  // Traitement 100% local
  USE_LOCAL_PROCESSING: true
};

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

