// Content script pour scraper Dmbook Pro
// Extrait les tickets de maintenance depuis la page

console.log('Dmbook scraper chargé');

// Écouter les messages du popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapeTickets') {
    scrapeTickets().then(sendResponse);
    return true; // Async response
  }
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

