// Content script pour scraper Dmbook Pro
// Extrait les tickets de maintenance depuis la page
// ET affiche les statuts de chambres depuis StayNTouch

console.log('Dmbook scraper chargé');

// Le calculateur de statuts est chargé via le manifest.json
// Les fonctions calculateRoomStatus et calculateDetailedStatus sont disponibles globalement

// Variable pour stocker les données de chambres
let chambresData = {};

// Écouter les messages du popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapeTickets') {
    scrapeTickets().then(sendResponse);
    return true; // Async response
  }
});

// Initialiser l'interface au chargement de la page
window.addEventListener('load', () => {
  initDmbookInterface();
});

/**
 * Fonction principale de scraping des tickets
 */
async function scrapeTickets() {
  try {
    console.log('Démarrage du scraping Dmbook...');
    
    // Extraire les données des tickets
    const tickets = extractTicketData();
    
    console.log(`${tickets.length} tickets extraits`);
    
    return {
      success: true,
      data: {
        tickets: tickets,
        timestamp: new Date().toISOString(),
        source: 'dmbook',
        total: tickets.length
      }
    };
  } catch (error) {
    console.error('Erreur scraping Dmbook:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extraire les données de tous les tickets
 */
function extractTicketData() {
  const tickets = [];
  const ticketElements = document.querySelectorAll('tr.entry.ticket');
  
  console.log(`Traitement de ${ticketElements.length} tickets...`);
  
  ticketElements.forEach((ticketEl, index) => {
    try {
      const ticket = extractSingleTicket(ticketEl);
      if (ticket) {
        tickets.push(ticket);
      }
    } catch (error) {
      console.error(`Erreur extraction ticket ${index}:`, error);
    }
  });
  
  return tickets;
}

/**
 * Extraire les données d'un seul ticket
 */
function extractSingleTicket(ticketEl) {
  // Contenu du ticket
  const contentEl = ticketEl.querySelector('.ticket-content .content');
  if (!contentEl) {
    console.warn('Ticket sans contenu ignoré');
    return null;
  }
  
  // Cloner l'élément pour le manipuler sans affecter la page
  const clone = contentEl.cloneNode(true);
  
  // Retirer les éléments qu'on ne veut pas
  const toRemove = clone.querySelectorAll('.author, .icons, .meta, span.ng-binding, br');
  toRemove.forEach(el => el.remove());
  
  // Récupérer le texte nettoyé
  let contenu = clone.textContent;
  
  // Nettoyer agressivement :
  // 1. Supprimer tous les sauts de ligne
  contenu = contenu.replace(/[\n\r]+/g, ' ');
  // 2. Supprimer les espaces multiples
  contenu = contenu.replace(/\s+/g, ' ');
  // 3. Trim
  contenu = contenu.trim();
  
  // Extraire le numéro de chambre du contenu (format: #XXX ou juste XXX au début)
  // Chercher #XXX en premier
  let chambreMatch = contenu.match(/#(\d{3})/);
  let numeroChambre = chambreMatch ? chambreMatch[1] : null;
  
  // Si pas trouvé, chercher XXX au début de la ligne (sans #)
  if (!numeroChambre) {
    chambreMatch = contenu.match(/^(\d{3})\s/);
    numeroChambre = chambreMatch ? chambreMatch[1] : null;
  }
  
  // Métadonnées (numéro de ticket, statut, date)
  const metaEl = ticketEl.querySelector('.meta');
  let numeroTicket = null;
  let dateCreation = null;
  let relativeTime = null;
  
  if (metaEl) {
    const metaText = metaEl.textContent.trim();
    
    // Extraire le numéro de ticket (#XXXX)
    const ticketMatch = metaText.match(/#(\d+)/);
    numeroTicket = ticketMatch ? ticketMatch[1] : null;
    
    // Extraire le temps relatif (ex: "il y a 2 jours")
    const timeMatch = metaText.match(/(il y a .+|Hier|Aujourd'hui)/);
    relativeTime = timeMatch ? timeMatch[1] : null;
    
    // Extraire la date depuis l'attribut title si disponible
    const titleAttr = metaEl.getAttribute('title');
    if (titleAttr) {
      dateCreation = titleAttr;
    }
  }
  
  // Statut du ticket
  const statusIconEl = ticketEl.querySelector('.btn-ticket-status i');
  let statut = 'Inconnu';
  
  if (statusIconEl) {
    const classes = statusIconEl.className;
    
    if (classes.includes('fa-light') || classes.includes('circle')) {
      const style = statusIconEl.getAttribute('style');
      if (style && style.includes('#432975')) {
        statut = 'Ouvert';
      }
    } else if (classes.includes('fa-pause-circle')) {
      statut = 'En cours';
    } else if (classes.includes('fa-check-circle')) {
      statut = 'Fermé';
    }
  }
  
  // Extraire le statut textuel si disponible
  const statusTextEls = ticketEl.querySelectorAll('.meta');
  statusTextEls.forEach(el => {
    const text = el.textContent;
    if (text.includes('Ouvert')) statut = 'Ouvert';
    if (text.includes('En cours')) statut = 'En cours';
    if (text.includes('Fermé')) statut = 'Fermé';
  });
  
  // Auteur
  const authorEl = ticketEl.querySelector('.author');
  const auteur = authorEl ? authorEl.textContent.replace('—', '').trim() : null;
  
  // Déterminer la priorité en fonction du contenu
  let priorite = 'MOYENNE';
  const contenuLower = contenu.toLowerCase();
  
  // Haute priorité pour certains mots-clés
  const motsHautePriorite = [
    'urgent', 'fuite', 'cassé', 'panne', 'danger', 
    'ne fonctionne pas', 'bloqué', 'hors service'
  ];
  
  // Basse priorité pour d'autres
  const motsBassePriorite = [
    'retouche', 'mineur', 'esthétique', 'détail',
    'détartrer', 'nettoyer'
  ];
  
  if (motsHautePriorite.some(mot => contenuLower.includes(mot))) {
    priorite = 'HAUTE';
  } else if (motsBassePriorite.some(mot => contenuLower.includes(mot))) {
    priorite = 'BASSE';
  }
  
  // Vérifier si le ticket a une icône de modification
  const hasEdit = ticketEl.querySelector('.fa-pencil') !== null;
  
  return {
    id: numeroTicket,
    numero_ticket: numeroTicket ? `#${numeroTicket}` : null,
    numero_chambre: numeroChambre,
    contenu: contenu,
    statut: statut,
    auteur: auteur,
    date_creation: dateCreation,
    date_relative: relativeTime,
    priorite: priorite,
    modifie: hasEdit
  };
}

/**
 * Afficher un indicateur visuel sur la page
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
  indicator.textContent = '🎫 Scraping tickets...';
  document.body.appendChild(indicator);

  setTimeout(() => {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }, 3000);
}

// ==================== NOUVELLES FONCTIONNALITÉS ====================

/**
 * Initialiser l'interface Dmbook avec le bouton de scraping et les badges
 */
function initDmbookInterface() {
  console.log('Initialisation de l\'interface Dmbook...');

  // Vérifier si on est sur une page de tickets TECHNIQUE
  const pageHeader = document.querySelector('.page-header');
  if (!pageHeader) {
    console.log('Pas sur une page de tickets');
    return;
  }

  const headerText = pageHeader.textContent;
  if (!headerText.includes('TECHNIQUE')) {
    console.log('Pas sur la page TECHNIQUE');
    return;
  }

  console.log('Page TECHNIQUE détectée, ajout du bouton de scraping');

  // Ajouter le bouton de scraping
  addScrapingButton();

  // Charger les données de chambres si elles existent dans le storage
  loadChambresDataFromStorage().then(() => {
    displayStatusBadges();
  });
}

/**
 * Ajouter le bouton de scraping dans l'interface
 */
function addScrapingButton() {
  const pageHeader = document.querySelector('.page-header');
  if (!pageHeader) return;

  // Vérifier si le bouton existe déjà
  if (document.getElementById('hotel-manager-scrape-btn')) return;

  // Créer le bouton
  const button = document.createElement('button');
  button.id = 'hotel-manager-scrape-btn';
  button.className = 'btn btn-default';
  button.style.cssText = `
    margin-left: 10px;
    background: #1a73e8;
    color: white;
    border: none;
    font-weight: 500;
  `;
  button.innerHTML = '<i class="fa-solid fa-refresh"></i> Scraper StayNTouch';

  button.addEventListener('click', async () => {
    await scrapeStayNTouchAndDisplay();
  });

  // Trouver le container du bouton "Nouveau ticket" et ajouter à côté
  const btnContainer = pageHeader.querySelector('.pull-right');
  if (btnContainer) {
    btnContainer.appendChild(button);
  }
}

/**
 * Scraper StayNTouch et afficher les badges
 */
async function scrapeStayNTouchAndDisplay() {
  const button = document.getElementById('hotel-manager-scrape-btn');
  if (!button) return;

  // Désactiver le bouton pendant le scraping
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Scraping...';

  try {
    // Afficher un indicateur
    showNotification('Scraping StayNTouch en cours...', 'info');

    // Ouvrir StayNTouch dans un nouvel onglet
    const staynTouchTab = await browser.tabs.create({
      url: 'https://app.stayntouch.com/core/room_management/status/dashboard',
      active: false
    });

    // Attendre que la page soit chargée
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Envoyer le message de scraping à l'onglet StayNTouch
    const response = await browser.tabs.sendMessage(staynTouchTab.id, {
      action: 'scrapeRooms'
    });

    if (response && response.success) {
      // Stocker les données
      chambresData = {};
      response.data.chambres.forEach(chambre => {
        chambresData[chambre.numero] = chambre;
      });

      // Sauvegarder dans le storage
      await browser.storage.local.set({ chambresData: chambresData });

      // Afficher les badges
      displayStatusBadges();

      showNotification(`✓ ${response.data.chambres.length} chambres scrapées`, 'success');
    } else {
      showNotification('Erreur lors du scraping', 'error');
    }

    // Fermer l'onglet StayNTouch
    await browser.tabs.remove(staynTouchTab.id);

  } catch (error) {
    console.error('Erreur scraping StayNTouch:', error);
    showNotification('Erreur: ' + error.message, 'error');
  } finally {
    // Réactiver le bouton
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-refresh"></i> Scraper StayNTouch';
  }
}

/**
 * Charger les données de chambres depuis le storage
 */
async function loadChambresDataFromStorage() {
  try {
    const result = await browser.storage.local.get('chambresData');
    if (result.chambresData) {
      chambresData = result.chambresData;
      console.log('Données de chambres chargées:', Object.keys(chambresData).length);
    }
  } catch (error) {
    console.error('Erreur chargement données:', error);
  }
}

/**
 * Afficher les badges de statut pour chaque ticket
 */
function displayStatusBadges() {
  console.log('Affichage des badges de statut...');

  // Supprimer les anciens badges
  document.querySelectorAll('.hotel-manager-status-badge').forEach(el => el.remove());

  // Pour chaque ticket
  const ticketElements = document.querySelectorAll('tr.entry.ticket');

  ticketElements.forEach(ticketEl => {
    try {
      // Extraire le numéro de chambre du ticket
      const contentEl = ticketEl.querySelector('.ticket-content .content');
      if (!contentEl) return;

      const contenu = contentEl.textContent;
      const chambreMatch = contenu.match(/#(\d{3})/);
      const numeroChambre = chambreMatch ? chambreMatch[1] : null;

      if (!numeroChambre) return;

      // Récupérer les données de la chambre
      const chambre = chambresData[numeroChambre];
      if (!chambre) {
        // Afficher un badge "non trouvé"
        addBadgeToTicket(ticketEl, '?', 'Chambre non trouvée', '#999');
        return;
      }

      // Calculer le statut
      let statut = window.calculateRoomStatus ? window.calculateRoomStatus(chambre) : chambre.statut || '?';
      let detailedStatus = window.calculateDetailedStatus ? window.calculateDetailedStatus(chambre) : null;

      // Déterminer la couleur en fonction du statut
      const color = getStatusColor(statut);
      const description = detailedStatus ? detailedStatus.description : statut;

      // Ajouter le badge
      addBadgeToTicket(ticketEl, statut, description, color);

    } catch (error) {
      console.error('Erreur affichage badge:', error);
    }
  });
}

/**
 * Ajouter un badge de statut à un ticket
 */
function addBadgeToTicket(ticketEl, statut, description, color) {
  const contentEl = ticketEl.querySelector('.ticket-content');
  if (!contentEl) return;

  // Créer le badge
  const badge = document.createElement('span');
  badge.className = 'hotel-manager-status-badge';
  badge.style.cssText = `
    display: inline-block;
    background: ${color};
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 8px;
    vertical-align: middle;
  `;
  badge.textContent = statut;
  badge.title = description;

  // Insérer le badge après le lien
  const link = contentEl.querySelector('a');
  if (link) {
    link.appendChild(badge);
  }
}

/**
 * Obtenir la couleur d'un statut
 */
function getStatusColor(statut) {
  const colors = {
    '(o)': '#432975',       // Violet - Occupé
    '(in)': '#86c621',      // Vert - Arrivée
    '(out)': '#ff921e',     // Orange - Départ
    '(dispo)': '#86c621',   // Vert - Disponible
    '(out/inc)': '#ff921e', // Orange - Rotation
    '(out/dispo)': '#ff921e', // Orange - Départ et dispo
    '(inc)': '#86c621',     // Vert - Arrivée prochaine
    '(day-use)': '#1a73e8', // Bleu - Day use
    '(bloquée)': '#d32f2f', // Rouge - Bloquée
    '(null)': '#999',       // Gris - Inconnu
    '?': '#999'             // Gris - Non trouvé
  };

  return colors[statut] || '#999';
}

/**
 * Afficher une notification
 */
function showNotification(message, type = 'info') {
  const colors = {
    'info': '#1a73e8',
    'success': '#86c621',
    'error': '#d32f2f',
    'warning': '#ff921e'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Ajouter les animations CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

