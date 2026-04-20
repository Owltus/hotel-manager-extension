// Content script pour scraper StayNTouch PMS
// Extrait les données des chambres depuis la page de statuts
// MODE CUMULATIF : Accumule les chambres de plusieurs pages

// Content script STAYNTOUCH chargé

/**
 * Afficher une notification toast sur la page
 * @param {string} message - Le message à afficher
 * @param {string} type - Le type: 'success', 'error', 'info'
 * @param {number} duration - Durée en ms (défaut: 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
  // Supprimer les toasts existants
  const existingToast = document.getElementById('hotel-manager-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Créer le toast
  const toast = document.createElement('div');
  toast.id = 'hotel-manager-toast';
  
  // Couleurs selon le type
  let bgColor = '#28a745'; // vert par défaut (success)
  let icon = '✅';
  if (type === 'error') {
    bgColor = '#dc3545';
    icon = '❌';
  } else if (type === 'info') {
    bgColor = '#17a2b8';
    icon = 'ℹ️';
  }
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideInLeft 0.3s ease-out;
  `;
  
  // Ajouter l'animation CSS (seulement si pas déjà présente)
  if (!document.getElementById('hotel-manager-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'hotel-manager-toast-styles';
    style.textContent = `
      @keyframes slideInLeft {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutLeft {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Utiliser textContent au lieu de innerHTML pour la sécurité
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  document.body.appendChild(toast);
  
  // Retirer après la durée
  setTimeout(() => {
    toast.style.animation = 'slideOutLeft 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Variable pour éviter les appels multiples simultanés
let autoScrapingInProgress = false;
let lastAutoScrapingTime = 0;

// Initialiser la détection automatique de page Room Status
setTimeout(() => {
  initAutoScraping();
}, 1000);

// Écouter les messages du popup ET d'autres content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Message de ping pour vérifier que le script est chargé
  if (message.action === 'ping') {
    sendResponse({ pong: true, ready: true, timestamp: new Date().toISOString() });
    return false; // Réponse synchrone
  }
  
  if (message.action === 'scrapeRooms') {
    scrapeRoomsCumulative().then(sendResponse);
    return true; // Async response
  }
  
  if (message.action === 'scrapeCurrentPage') {
    scrapeCurrentPageOnly().then(sendResponse);
    return true;
  }
  
  if (message.action === 'scrapeAllPages') {
    scrapeAllPagesIntelligent().then(sendResponse);
    return true;
  }
});

/**
 * Fonction principale de scraping des chambres
 * Extrait SEULEMENT les chambres de cette page (le cumul est géré par le popup)
 */
async function scrapeRoomsCumulative() {
  try {
    // Attendre que le contenu Angular soit chargé
    await waitForAngularLoad();
    
    // Extraire les données de CETTE PAGE seulement
    const chambres = extractRoomData();
    
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
    console.error('❌ [STAYNTOUCH] Erreur scraping:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialiser le scraping automatique sur détection de page Room Status
 */
function initAutoScraping() {
  // Vérifier immédiatement si on est sur une page Room Status
  if (isRoomStatusPage()) {
    performAutoScraping();
  }

  // Observer les changements de DOM pour détecter les navigations Angular
  observePageChanges();
}

/**
 * Détecter si on est sur une page Room Status
 */
function isRoomStatusPage() {
  // Méthode 1: Vérifier le titre de la page
  if (document.title && document.title.includes('Room Status')) {
    return true;
  }

  // Méthode 2: Vérifier le H1 avec "Room Status"  
  const h1Element = document.querySelector('h1.ng-binding');
  if (h1Element && h1Element.textContent.includes('Room Status')) {
    return true;
  }

  // Méthode 3: Vérifier la présence des éléments caractéristiques
  const roomsSection = document.querySelector('#rooms');
  const searchResults = document.querySelector('.search-results');
  const roomElements = document.querySelectorAll('li.room.with-checkbox');

  return roomsSection && searchResults && roomElements.length > 0;
}

/**
 * Observer les changements de page pour Angular SPA
 */
function observePageChanges() {
  // Observer les mutations DOM pour détecter les changements Angular
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    mutations.forEach((mutation) => {
      // Vérifier si des nœuds ont été ajoutés (navigation Angular)
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Vérifier si des éléments de chambres ont été ajoutés
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches('li.room, .search-results, #rooms')) {
              shouldCheck = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldCheck) {
      // Attendre un peu que Angular finisse le rendu
      setTimeout(() => {
        if (isRoomStatusPage()) {
          performAutoScraping();
        }
      }, 1500);
    }
  });

  // Observer tout le document
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Effectuer le scraping automatique avec throttling
 */
async function performAutoScraping() {
  try {
    // Empêcher les appels multiples simultanés (throttling)
    const now = Date.now();
    const timeSinceLastScraping = now - lastAutoScrapingTime;
    
    if (autoScrapingInProgress) {
      return;
    }
    
    if (timeSinceLastScraping < 3000) { // Minimum 3 secondes entre les appels
      return;
    }
    
    autoScrapingInProgress = true;
    lastAutoScrapingTime = now;
    
    // Attendre que les données soient chargées
    await waitForRoomsLoaded();
    
    // Scraper la page actuelle
    const result = await scrapeCurrentPageOnly();
    
    if (result.success && result.data.chambres.length > 0) {
      // Récupérer les données existantes pour cumuler
      const existing = await browser.storage.local.get(['chambres_data']);
      let allChambres = result.data.chambres;
      
      if (existing.chambres_data && existing.chambres_data.chambres) {
        // Fusionner avec les chambres existantes (éviter les doublons par numéro)
        const existingChambres = existing.chambres_data.chambres;
        const newChambres = result.data.chambres;
        
        // Créer une map pour éviter les doublons
        const chambresMap = new Map();
        
        // Ajouter les chambres existantes
        existingChambres.forEach(chambre => {
          chambresMap.set(chambre.numero, chambre);
        });
        
        // Ajouter/remplacer avec les nouvelles chambres
        newChambres.forEach(chambre => {
          chambresMap.set(chambre.numero, chambre);
        });
        
        // Convertir en array
        allChambres = Array.from(chambresMap.values());
      }
      
      // Stocker les données cumulées avec gestion d'erreur
      try {
        await browser.storage.local.set({
          chambres_data: {
            chambres: allChambres,
            count: allChambres.length,
            timestamp: new Date().toISOString(),
            source: 'stayntouch_cumulative',
            total: allChambres.length
          },
          last_update_rooms: new Date().toISOString()
        });

        // Afficher un toast de confirmation avec détails
        const totalExpected = 80; // Nombre total de chambres attendu
        const pageChambres = result.data.chambres.length;
        showToast(`${allChambres.length}/${totalExpected} chambres • +${pageChambres} cette page`, 'success');
      } catch (storageError) {
        console.error('❌ [STAYNTOUCH] Erreur sauvegarde:', storageError);
        showToast('Erreur: impossible de sauvegarder les données', 'error');
      }
    }
  } catch (error) {
    console.error('❌ [STAYNTOUCH] Erreur auto-scraping:', error);
    showToast('Erreur lors du scraping', 'error');
  } finally {
    autoScrapingInProgress = false;
  }
}

/**
 * Attendre que les chambres soient chargées dans le DOM
 */
function waitForRoomsLoaded() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 20;
    let attempts = 0;
    
    const checkLoaded = setInterval(() => {
      attempts++;
      
      const rooms = document.querySelectorAll('li.room.with-checkbox.ng-scope');
      
      if (rooms.length > 0) {
        clearInterval(checkLoaded);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkLoaded);
        reject(new Error('Timeout: Aucune chambre détectée'));
      }
    }, 500);
  });
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
  let isPickup = false;
  
  if (statusEl) {
    const statusText = statusEl.textContent.trim();
    if (statusText === 'CLEAN') statutProprete = 'CLEAN';
    else if (statusText === 'DIRTY') statutProprete = 'DIRTY';
    else if (statusText === 'PICKUP') {
      statutProprete = 'PICKUP';
      isPickup = true;
    }
    else if (statusEl.classList.contains('clean')) statutProprete = 'CLEAN';
    else if (statusEl.classList.contains('dirty')) statutProprete = 'DIRTY';
    else if (statusEl.classList.contains('pickup')) {
      statutProprete = 'PICKUP';
      isPickup = true;
    }
  }
  
  // Type de chambre
  const typeEl = roomEl.querySelector('.room-type.ng-binding');
  const type = typeEl ? typeEl.textContent.trim() : null;
  
  // Statuts current et next (pour calcul automatique)
  const currentStatusEl = roomEl.querySelector('.current .guest-status');
  const nextStatusEl = roomEl.querySelector('.next .guest-status');

  let currentStatus = currentStatusEl ? currentStatusEl.textContent.trim() : 'Not Reserved';
  let nextStatus = nextStatusEl ? nextStatusEl.textContent.trim() : 'Not Reserved';

  // Extraire les classes CSS pour plus de contexte
  const currentClasses = currentStatusEl ? Array.from(currentStatusEl.classList) : [];
  const nextClasses = nextStatusEl ? Array.from(nextStatusEl.classList) : [];

  // Détecter les statuts combinés (ex: "Departed / Arrival" pour day use)
  const isCombinedStatus = currentStatus.includes('/') || nextStatus.includes('/');
  
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

  // Détection OOO (Out of Order) et OOS (Out of Service)
  const serviceStatusEl = roomEl.querySelector('.service-status');
  let isOOO = false;
  let isOOS = false;
  let oooReason = null;
  let oooUntil = null;
  
  if (serviceStatusEl) {
    const statusText = serviceStatusEl.textContent.toLowerCase();
    // Détecter si c'est OOO ou OOS
    if (statusText.includes('out of order') || statusText.includes('ooo')) {
      isOOO = true;
    } else if (statusText.includes('out of service') || statusText.includes('oos')) {
      isOOS = true;
    } else {
      // Par défaut, si .service-status existe mais type inconnu → OOO
      isOOO = true;
    }
    
    const reasonEl = serviceStatusEl.querySelector('.service-status-reason');
    oooReason = reasonEl ? reasonEl.textContent.trim() : null;
    const untilMatch = serviceStatusEl.textContent.match(/until\s+\*\*(\d{2}-\d{2}-\d{4})\*\*/);
    oooUntil = untilMatch ? untilMatch[1] : null;
  }

  // Détection "Stayover"
  const isStayover = statutReservation && statutReservation.includes('Stayover');

  // Détection "Day Use" (arrivée et départ le même jour)
  // Conditions STRICTES:
  // 1. Dates check-in === check-out (même jour)
  // 2. Statuts contiennent "Arrival" (nouveau client arrive)
  // 3. Statuts NE contiennent PAS "Departed" (sinon c'est une rotation)
  // 4. Statuts NE contiennent PAS "Due out" (sinon c'est une rotation avec client encore présent)
  const isDayUse = (checkIn === checkOut && checkIn !== null) &&
                   currentStatus.includes('Arrival') &&
                   nextStatus.includes('Arrival') &&
                   !currentStatus.includes('Departed') &&
                   !nextStatus.includes('Departed') &&
                   !currentStatus.includes('Due out') &&
                   !nextStatus.includes('Due out');

  return {
    id: numero,
    numero: numero,
    statut_proprete: statutProprete,
    is_pickup: isPickup,
    type: type,
    statut_reservation: statutReservation,
    current_status: currentStatus,
    next_status: nextStatus,
    current_classes: currentClasses,
    next_classes: nextClasses,
    is_combined_status: isCombinedStatus,
    check_in: checkIn,
    check_out: checkOut,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    occupancy: occupancy,
    vacant: vacant,
    is_stayover: isStayover,
    is_day_use: isDayUse,
    is_ooo: isOOO,
    is_oos: isOOS,
    ooo_reason: oooReason,
    ooo_until: oooUntil
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


/**
 * Scraper seulement la page actuelle (unifiée pour auto-scraping et communication)
 */
async function scrapeCurrentPageOnly() {
  try {
    // Vérifier que nous sommes connectés
    if (!document.querySelector('.hotel')) {
      throw new Error('❌ Non connecté à StayNTouch ou page non chargée');
    }
    
    await waitForAngularLoad();
    const chambres = extractRoomData();
    
    return {
      success: true,
      data: {
        chambres: chambres,
        count: chambres.length,
        timestamp: new Date().toISOString(),
        source: 'stayntouch_current',
        total: chambres.length
      }
    };
    
  } catch (error) {
    console.error('❌ [STAYNTOUCH] Erreur scraping:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Scraper toutes les pages de StayNTouch automatiquement
 */
async function scrapeAllPagesIntelligent() {
  try {
    // Vérifier que nous sommes connectés
    if (!document.querySelector('.hotel')) {
      throw new Error('❌ Non connecté à StayNTouch ou page non chargée');
    }
    
    await waitForAngularLoad();
    
    // Extraire info de pagination
    const paginationInfo = getPaginationInfo();
    
    let allChambres = [];
    let currentPage = 1;
    
    // Scraper toutes les pages automatiquement
    while (currentPage <= paginationInfo.pages) {
      // Attendre que les données se chargent
      await waitForAngularLoad();
      
      // Extraire les chambres de la page actuelle
      const currentPageChambres = extractRoomData();
      allChambres = allChambres.concat(currentPageChambres);
      
      // Vérifier s'il y a une page suivante
      if (currentPage < paginationInfo.pages) {
        const nextPageSuccess = await navigateToNextPage();
        if (!nextPageSuccess) {
          break;
        }
        
        // Attendre le chargement de la nouvelle page
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      currentPage++;
    }
    
    const finalData = {
      chambres: allChambres,
      timestamp: new Date().toISOString(),
      source: 'stayntouch_intelligent',
      total: allChambres.length,
      complete: allChambres.length >= paginationInfo.total * 0.9, // 90% du total attendu
      pages_scraped: currentPage - 1
    };
    
    return {
      success: true,
      data: finalData
    };
    
  } catch (error) {
    console.error('❌ [STAYNTOUCH] Erreur scraping intelligent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Naviguer vers la page suivante
 */
async function navigateToNextPage() {
  try {
    // Chercher le bouton "Next" ou "Suivant"
    const nextButton = document.querySelector('a[href*="page"]:contains("Next"), .pagination a:contains(">"), .pagination .next, button:contains("Next")');
    
    if (!nextButton) {
      return false;
    }
    
    if (nextButton.disabled || nextButton.classList.contains('disabled')) {
      return false;
    }
    
    nextButton.click();
    return true;
    
  } catch (error) {
    console.error('❌ [STAYNTOUCH] Erreur navigation:', error);
    return false;
  }
}

/**
 * Extraire les informations de pagination
 */
function getPaginationInfo() {
  // Chercher "Showing 1-50 of 80 items"
  const paginationText = document.querySelector('.page-count')?.textContent || '';
  const match = paginationText.match(/Showing\s+(\d+)-(\d+)\s+of\s+(\d+)/);
  
  if (match) {
    const [, from, to, total] = match;
    const itemsPerPage = parseInt(to) - parseInt(from) + 1;
    const totalItems = parseInt(total);
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return {
      from: parseInt(from),
      to: parseInt(to),
      total: totalItems,
      pages: totalPages,
      itemsPerPage: itemsPerPage
    };
  }
  
  // Fallback
  return {
    from: 1,
    to: 50,
    total: 80,
    pages: 2,
    itemsPerPage: 50
  };
}

/**
 * Calculer un statut simple directement dans StayNTouch
 */
function calculateSimpleStatus(chambre) {
  const currentStatus = chambre.current_status || '';
  const nextStatus = chambre.next_status || '';
  const isVacant = chambre.vacant === true;
  
  // OOO (bloquée)
  if (chambre.is_ooo) {
    return 'bloquée';
  }
  
  // Day Use
  if (chambre.is_day_use) {
    return 'day-use';
  }
  
  // Rotation avec client présent "Due out / Arrival"
  // Client encore dans la chambre + nouvelle arrivée = (in/inc)
  if (currentStatus.includes('Due out / Arrival')) {
    return 'in/inc';
  }
  
  // Rotation avec client parti "Departed / Arrival"
  // Client déjà parti + nouvelle arrivée = (out/inc)
  if (currentStatus.includes('Departed / Arrival')) {
    return 'out/inc';
  }
  
  // Client en séjour (Stayover)
  if ((currentStatus.includes('Stayover') && nextStatus.includes('Stayover')) ||
      (currentStatus.includes('Inhouse') && nextStatus.includes('Stayover'))) {
    return 'o';
  }
  
  // Client déjà arrivé
  if (currentStatus.includes('Arrived') && !currentStatus.includes('Departure')) {
    return 'in';
  }
  
  // Rotation prévue (client parti, nouveau pas encore arrivé)
  if (currentStatus.includes('Departed') && !currentStatus.includes('Arrival') &&
      nextStatus.includes('Arrival')) {
    return 'out/inc';
  }
  
  // Client présent (Due out)
  if (currentStatus.includes('Due out') && nextStatus.includes('Due out')) {
    return 'in';
  }
  
  // Arrivée prévue
  if ((currentStatus.includes('Arrival') || currentStatus.includes('Not Reserved') || isVacant) &&
      nextStatus.includes('Arrival')) {
    return 'inc';
  }
  
  // Client parti, pas de nouvelle arrivée
  if (currentStatus.includes('Departed') && !currentStatus.includes('Arrival') &&
      (nextStatus.includes('Not Reserved') || nextStatus.includes('Departed'))) {
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
    // Si après 14h, disponible, sinon sortie
    if (currentHour >= 14) {
      return 'dispo';
    }
    return 'out';
  }
  
  // Chambre vide et disponible
  if ((isVacant && nextStatus.includes('Not Reserved')) ||
      (currentStatus.includes('Not Reserved') && nextStatus.includes('Not Reserved'))) {
    return 'dispo';
  }
  
  // Cas non géré
  return 'null';
}


