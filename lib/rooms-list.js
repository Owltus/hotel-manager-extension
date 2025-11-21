// Liste hardcodée de toutes les chambres de l'hôtel (80 chambres)
// Utilisée pour vérifier qu'aucune chambre n'est manquante lors du scraping

const ROOMS_LIST = [
  // Niveau 100 (13 chambres)
  102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
  
  // Niveau 200 (14 chambres)
  201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214,
  
  // Niveau 300 (14 chambres)
  301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314,
  
  // Niveau 400 (14 chambres)
  401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
  
  // Niveau 500 (14 chambres)
  501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514,
  
  // Niveau 600 (11 chambres)
  621, 622, 623, 624, 625, 626, 627, 628, 629, 630, 631
];

// Organisation par niveaux
const ROOMS_BY_LEVEL = {
  100: [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
  200: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214],
  300: [301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314],
  400: [401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414],
  500: [501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514],
  600: [621, 622, 623, 624, 625, 626, 627, 628, 629, 630, 631]
};

// Nombre total de chambres
const TOTAL_ROOMS = ROOMS_LIST.length; // 80

/**
 * Obtenir le niveau d'une chambre
 * @param {number} roomNumber - Numéro de la chambre (ex: 102)
 * @returns {number} - Niveau (100, 200, etc.)
 */
function getRoomLevel(roomNumber) {
  const num = parseInt(roomNumber);
  if (num >= 100 && num < 200) return 100;
  if (num >= 200 && num < 300) return 200;
  if (num >= 300 && num < 400) return 300;
  if (num >= 400 && num < 500) return 400;
  if (num >= 500 && num < 600) return 500;
  if (num >= 600 && num < 700) return 600;
  return 0; // Inconnu
}

/**
 * Vérifier quelles chambres manquent
 * @param {Array} scrapedRooms - Tableau des numéros de chambres scrapés
 * @returns {Object} - {missing: [...], missingByLevel: {...}, complete: boolean}
 */
function checkMissingRooms(scrapedRooms) {
  const scrapedNumbers = scrapedRooms.map(r => parseInt(r));
  const missing = ROOMS_LIST.filter(room => !scrapedNumbers.includes(room));
  
  // Organiser par niveau
  const missingByLevel = {};
  missing.forEach(room => {
    const level = getRoomLevel(room);
    if (!missingByLevel[level]) {
      missingByLevel[level] = [];
    }
    missingByLevel[level].push(room);
  });
  
  return {
    missing: missing,
    missingByLevel: missingByLevel,
    complete: missing.length === 0,
    total: ROOMS_LIST.length,
    scraped: scrapedNumbers.length,
    percentage: Math.round((scrapedNumbers.length / ROOMS_LIST.length) * 100)
  };
}

/**
 * Formater les chambres manquantes pour affichage
 */
function formatMissingRooms(checkResult) {
  if (checkResult.complete) {
    return '✅ Toutes les chambres ont été récupérées !';
  }
  
  let message = `⚠️ ${checkResult.missing.length} chambre(s) manquante(s) :\n`;
  
  for (const [level, rooms] of Object.entries(checkResult.missingByLevel)) {
    message += `\nNiveau ${level} : ${rooms.map(r => '#' + r).join(', ')}`;
  }
  
  return message;
}

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROOMS_LIST,
    ROOMS_BY_LEVEL,
    TOTAL_ROOMS,
    getRoomLevel,
    checkMissingRooms,
    formatMissingRooms
  };
}

