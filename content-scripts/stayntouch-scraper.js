// Content script pour scraper StayNTouch PMS
// Extrait les données des chambres depuis la page de statuts
// MODE CUMULATIF : Accumule les chambres de plusieurs pages

console.log('StayNTouch scraper chargé (mode cumulatif)');

// Écouter les messages du popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapeRooms') {
    scrapeRoomsCumulative().then(sendResponse);
    return true; // Async response
  }
});

/**
 * Fonction principale de scraping des chambres
 * Extrait SEULEMENT les chambres de cette page (le cumul est géré par le popup)
 */
async function scrapeRoomsCumulative() {
  try {
    console.log('Démarrage du scraping StayNTouch...');
    
    // Attendre que le contenu Angular soit chargé
    await waitForAngularLoad();
    
    // Extraire les données de CETTE PAGE seulement
    const chambres = extractRoomData();
    console.log(`${chambres.length} chambres extraites de cette page`);
    
    // Retourner SEULEMENT les nouvelles chambres
    // Le cumul sera géré par le popup
    return {
      success: true,
      data: {
        chambres: chambres,
        count: chambres.length,
        timestamp: new Date().toISOString(),
        source: 'stayntouch'
      }
    };
  } catch (error) {
    console.error('Erreur scraping StayNTouch:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Attendre que le contenu Angular soit chargé
 */
function waitForAngularLoad() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 20;
    let attempts = 0;
    
    const checkLoaded = setInterval(() => {
      attempts++;
      
      // Vérifier si les éléments de chambres sont présents
      const rooms = document.querySelectorAll('li.room.with-checkbox.ng-scope');
      
      if (rooms.length > 0) {
        clearInterval(checkLoaded);
        console.log('Contenu Angular chargé, chambres trouvées:', rooms.length);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkLoaded);
        reject(new Error('Timeout: Impossible de détecter les chambres. Vérifiez que la page est complètement chargée.'));
      }
    }, 500);
  });
}

/**
 * Extraire les données de toutes les chambres
 */
function extractRoomData() {
  const chambres = [];
  const roomElements = document.querySelectorAll('li.room.with-checkbox.ng-scope');
  
  console.log(`Traitement de ${roomElements.length} chambres...`);
  
  roomElements.forEach((roomEl, index) => {
    try {
      const chambre = extractSingleRoom(roomEl);
      if (chambre) {
        chambres.push(chambre);
      }
    } catch (error) {
      console.error(`Erreur extraction chambre ${index}:`, error);
    }
  });
  
  return chambres;
}

/**
 * Extraire les données d'une seule chambre
 */
function extractSingleRoom(roomEl) {
  // Numéro de chambre
  const numeroEl = roomEl.querySelector('.room-info h2 span.ng-binding');
  const numero = numeroEl ? numeroEl.textContent.trim() : null;
  
  if (!numero) {
    console.warn('Chambre sans numéro ignorée');
    return null;
  }
  
  // Statut de propreté
  const statusEl = roomEl.querySelector('.room-status');
  let statutProprete = 'UNKNOWN';
  if (statusEl) {
    const statusText = statusEl.textContent.trim();
    if (statusText === 'CLEAN') statutProprete = 'CLEAN';
    else if (statusText === 'DIRTY') statutProprete = 'DIRTY';
    else if (statusEl.classList.contains('clean')) statutProprete = 'CLEAN';
    else if (statusEl.classList.contains('out')) statutProprete = 'DIRTY';
  }
  
  // Type de chambre
  const typeEl = roomEl.querySelector('.room-type.ng-binding');
  const type = typeEl ? typeEl.textContent.trim() : null;
  
  // Statuts current et next (pour calcul automatique)
  const currentStatusEl = roomEl.querySelector('.current .guest-status');
  const nextStatusEl = roomEl.querySelector('.next .guest-status');
  
  let currentStatus = currentStatusEl ? currentStatusEl.textContent.trim() : 'Not Reserved';
  let nextStatus = nextStatusEl ? nextStatusEl.textContent.trim() : 'Not Reserved';
  
  console.log(`Chambre ${numero}: current="${currentStatus}" next="${nextStatus}"`);
  
  // Extraire les heures depuis .reservation-time
  const currentTimeEl = roomEl.querySelector('.current .reservation-time');
  const nextTimeEl = roomEl.querySelector('.next .reservation-time');
  
  let checkOutTime = null;
  let checkInTime = null;
  
  if (currentTimeEl) {
    const text = currentTimeEl.textContent;
    // Chercher format "12:00 am" ou "02:00 pm" ou juste "OUT"
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
    if (timeMatch) {
      checkOutTime = timeMatch[1];
    }
  }
  
  if (nextTimeEl) {
    const text = nextTimeEl.textContent;
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
    if (timeMatch) {
      checkInTime = timeMatch[1];
    }
  }
  
  console.log(`Times: checkout="${checkOutTime}" checkin="${checkInTime}"`);
  
  // Statut de réservation (pour affichage)
  const guestStatusEls = roomEl.querySelectorAll('.guest-status');
  let statutReservation = null;
  if (guestStatusEls.length > 0) {
    const statuses = Array.from(guestStatusEls).map(el => el.textContent.trim());
    statutReservation = statuses.join(' / ');
  }
  
  // Dates (check-in et check-out)
  const dateEls = roomEl.querySelectorAll('time[datetime]');
  let checkIn = null;
  let checkOut = null;
  if (dateEls.length >= 2) {
    checkIn = dateEls[0].getAttribute('datetime');
    checkOut = dateEls[1].getAttribute('datetime');
  }
  
  // Occupancy (adultes, enfants, bébés)
  const occupancy = { adults: 0, children: 0, babies: 0 };
  const occupancyEls = roomEl.querySelectorAll('.occupancy-number');
  occupancyEls.forEach(el => {
    const text = el.textContent.trim();
    const number = parseInt(text.match(/\d+/)?.[0] || '0');
    
    if (el.innerHTML.includes('icon-adult')) {
      occupancy.adults = number;
    } else if (el.innerHTML.includes('icon-student')) {
      occupancy.children = number;
    } else if (el.innerHTML.includes('icon-baby')) {
      occupancy.babies = number;
    }
  });
  
  // Vacant
  const vacantEl = roomEl.querySelector('.show-vacant');
  const vacant = vacantEl !== null;
  
  // Détection "Stayover"
  const isStayover = statutReservation && statutReservation.includes('Stayover');
  
  return {
    id: numero,
    numero: numero,
    statut_proprete: statutProprete,
    type: type,
    statut_reservation: statutReservation,
    current_status: currentStatus,
    next_status: nextStatus,
    check_in: checkIn,
    check_out: checkOut,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    occupancy: occupancy,
    vacant: vacant,
    is_stayover: isStayover
  };
}

/**
 * Afficher un indicateur visuel sur la page (optionnel)
 */
function showScrapingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'hotel-manager-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a73e8;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  indicator.textContent = '🏨 Scraping en cours...';
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
}

