// Content script pour scraper Dmbook Pro.

// Timer pending pour addImportantRoomsToList — annulable sur re-init pour éviter qu'une passe précédente ne race avec la nouvelle.
let pendingImportantRoomsTimer = null;

if (document.readyState === 'complete') {
  initDmbookInterface();
} else {
  window.addEventListener('load', initDmbookInterface, { once: true });
}

/**
 * Initialiser l'interface Dmbook
 */
async function initDmbookInterface() {
  // Chercher le titre TECHNIQUE 👨‍🔧🛠
  const titleElement = document.querySelector('h2');
  if (!titleElement || !titleElement.textContent.includes('TECHNIQUE 👨‍🔧🛠')) {
    return;
  }

  
  // Supprimer les boutons existants s'ils existent
  const existing = document.getElementById('hotel-manager-scrap-btn');
  if (existing) {
    existing.remove();
  }
  const existingPdf = document.getElementById('hotel-manager-pdf-btn');
  if (existingPdf) {
    existingPdf.remove();
  }
  const existingRooming = document.getElementById('hotel-manager-rooming-btn');
  if (existingRooming) {
    existingRooming.remove();
  }
  const existingCustom = document.getElementById('hotel-manager-custom-btn');
  if (existingCustom) {
    existingCustom.remove();
  }
  const existingReset = document.getElementById('hotel-manager-reset-btn');
  if (existingReset) {
    existingReset.remove();
  }
  const existingData = document.getElementById('hotel-manager-data-btn');
  if (existingData) {
    existingData.remove();
  }
  const existingDataModal = document.getElementById('hotel-manager-data-modal');
  if (existingDataModal) {
    if (existingDataModal._cleanup) existingDataModal._cleanup(null);
    else existingDataModal.remove();
  }
  const existingNamePrompt = document.getElementById('hotel-manager-name-prompt');
  if (existingNamePrompt) {
    if (existingNamePrompt._cleanup) existingNamePrompt._cleanup(null);
    else existingNamePrompt.remove();
  }
  const existingModal = document.getElementById('hotel-manager-modal');
  if (existingModal) {
    if (existingModal._cleanup) existingModal._cleanup(null);
    else existingModal.remove();
  }

  await addSimpleButton();
}

// Icônes Lucide en données structurées (évite innerHTML, compatible validator AMO).
const SVG_NS = 'http://www.w3.org/2000/svg';
const BUTTON_ICONS = {
  ticket: [
    { tag: 'path', attrs: { d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z' } },
    { tag: 'path', attrs: { d: 'M13 5v2' } },
    { tag: 'path', attrs: { d: 'M13 17v2' } },
    { tag: 'path', attrs: { d: 'M13 11v2' } }
  ],
  bedDouble: [
    { tag: 'path', attrs: { d: 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8' } },
    { tag: 'path', attrs: { d: 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4' } },
    { tag: 'path', attrs: { d: 'M12 4v6' } },
    { tag: 'path', attrs: { d: 'M2 18h20' } }
  ],
  clipboardList: [
    { tag: 'rect', attrs: { width: '8', height: '4', x: '8', y: '2', rx: '1', ry: '1' } },
    { tag: 'path', attrs: { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' } },
    { tag: 'path', attrs: { d: 'M12 11h4' } },
    { tag: 'path', attrs: { d: 'M12 16h4' } },
    { tag: 'path', attrs: { d: 'M8 11h.01' } },
    { tag: 'path', attrs: { d: 'M8 16h.01' } }
  ],
  rotateCcw: [
    { tag: 'path', attrs: { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' } },
    { tag: 'path', attrs: { d: 'M3 3v5h5' } }
  ],
  database: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '5', rx: '9', ry: '3' } },
    { tag: 'path', attrs: { d: 'M3 5V19A9 3 0 0 0 21 19V5' } },
    { tag: 'path', attrs: { d: 'M3 12A9 3 0 0 0 21 12' } }
  ]
};

function buildLucideSvg(iconName) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const { tag, attrs } of BUTTON_ICONS[iconName] || []) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

// Factory pour les boutons carrés de l'extension (icône SVG Lucide + tooltip natif).
function createHotelManagerButton({ id, title, bgColor, iconName, onClick }) {
  const btn = document.createElement('a');
  btn.id = id;
  btn.href = '#';
  btn.className = 'btn btn-default';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.appendChild(buildLucideSvg(iconName));
  btn.style.cssText = `
    margin-left: 8px;
    width: 34px;
    height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${bgColor};
    border-color: ${bgColor};
    color: white;
  `;
  btn.addEventListener('click', async function(e) {
    e.preventDefault();
    await onClick(this);
  });
  return btn;
}

/**
 * Ajouter un bouton simple après le titre TECHNIQUE
 */
async function addSimpleButton() {
  // Trouver le container avec le titre et le bouton "Nouveau ticket"
  const pullRightElement = document.querySelector('h2 p.pull-right');
  if (!pullRightElement) {
    return;
  }

  // SCRAPING AUTOMATIQUE au chargement de la page
  try {
    await performAutoScraping();
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur scraping automatique:', error);
  }

  const pdfButton = createHotelManagerButton({
    id: 'hotel-manager-pdf-btn',
    title: 'Tickets de maintenance',
    bgColor: '#dc3545',
    iconName: 'ticket',
    onClick: handlePDFExport
  });

  const roomingButton = createHotelManagerButton({
    id: 'hotel-manager-rooming-btn',
    title: 'Rooming list',
    bgColor: '#6f42c1',
    iconName: 'bedDouble',
    onClick: handleRoomingExport
  });

  const customButton = createHotelManagerButton({
    id: 'hotel-manager-custom-btn',
    title: 'Liste personnalisée',
    bgColor: '#fd7e14',
    iconName: 'clipboardList',
    onClick: handleCustomListExport
  });

  const dataButton = createHotelManagerButton({
    id: 'hotel-manager-data-btn',
    title: 'Listes de données (checklist persistante)',
    bgColor: '#198754',
    iconName: 'database',
    onClick: handleDataListsExport
  });

  const resetButton = createHotelManagerButton({
    id: 'hotel-manager-reset-btn',
    title: 'Réinitialiser les données',
    bgColor: '#6c757d',
    iconName: 'rotateCcw',
    onClick: handleReset
  });

  pullRightElement.appendChild(pdfButton);
  pullRightElement.appendChild(roomingButton);
  pullRightElement.appendChild(customButton);
  pullRightElement.appendChild(dataButton);
  pullRightElement.appendChild(resetButton);

  // Ajouter le bouton Filtre à côté du Total
  addFilterButton();

  // Améliorer l'affichage des tickets avec statuts colorés
  enhanceTicketDisplay();

  // Interface initialisée
}

/**
 * Effectuer le scraping automatique des tickets
 */
async function performAutoScraping() {
  try {
    // Scraper les tickets de la page courante
    const result = await scrapeTickets();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    const tickets = result.data.tickets;
    
    if (tickets.length === 0) {
      return; // Aucun ticket trouvé
    }
    
    // Stocker les données complètes retournées par scrapeTickets
    await browser.storage.local.set({ 
      tickets_data: result.data,
      last_update_tickets: new Date().toISOString()
    });
    
    // Scraping terminé silencieusement
    
    // Logger tous les tickets de manière simple
    
    if (pendingImportantRoomsTimer !== null) clearTimeout(pendingImportantRoomsTimer);
    pendingImportantRoomsTimer = setTimeout(() => {
      pendingImportantRoomsTimer = null;
      addImportantRoomsToList();
    }, 1500);
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur lors du scraping automatique:', error);
    throw error;
  }
}

/**
 * Ajouter les chambres importantes directement dans la liste DMbook
 */
async function addImportantRoomsToList() {
  try {
    // Récupérer les données des chambres
    const data = await browser.storage.local.get(['chambres_data', 'tickets_data']);
    
    if (!data.chambres_data?.chambres) {
      return;
    }
    
    const chambres = data.chambres_data.chambres;
    const existingTickets = data.tickets_data?.tickets || [];
    
    // Analyser les chambres importantes
    let importantRooms = [];
    
    chambres.forEach(chambre => {
      const status = calculateRoomStatus(chambre);
      const hasTicket = existingTickets.some(ticket => 
        ticket.numero_chambre === chambre.numero
      );
      
      // Collecter les chambres importantes (pas dispo ou null) sans ticket
      if (status && !status.includes('(null)') && !status.includes('(dispo)') && !hasTicket) {
        importantRooms.push(chambre);
      }
    });
    
    // Ajouter les chambres importantes dans le DOM
    if (importantRooms.length > 0) {
      addImportantRoomsToDom(chambres, existingTickets);
    }
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur ajout chambres importantes:', error);
  }
}

/**
 * Ajouter réellement les chambres importantes dans le DOM DMbook
 */
function addImportantRoomsToDom(chambres, existingTickets) {
  try {
    // Trouver le container des tickets
    const ticketContainer = document.querySelector('#ticket');
    if (!ticketContainer) {
      return;
    }
    
    let addedCount = 0;
    
    chambres.forEach(chambre => {
      const status = calculateRoomStatus(chambre);
      
      // Filtrer pour les statuts importants seulement
      if (status && !status.includes('(null)') && !status.includes('(dispo)')) {
        
        // Vérifier si cette chambre a déjà un ticket
        const hasTicket = existingTickets.some(ticket => 
          ticket.numero_chambre === chambre.numero
        );
        
        // Si pas de ticket, ajouter une ligne pour cette chambre
        if (!hasTicket) {
          addRoomStatusLineToDom(chambre, status, ticketContainer);
          addedCount++;
        }
      }
    });
    
    
  } catch (error) {
    console.error('❌ [DOM] Erreur ajout DOM:', error);
  }
}

/**
 * Ajouter une ligne de statut pour une chambre sans ticket dans le DOM
 */
function addRoomStatusLineToDom(chambre, status, container) {
  // Éviter les doublons
  const existingLine = document.querySelector(`#room-status-${chambre.numero}`);
  if (existingLine) return;
  
  // Créer l'élément de ligne avec le même style que les tickets existants
  const lineDiv = document.createElement('div');
  lineDiv.id = `room-status-${chambre.numero}`;
  lineDiv.style.cssText = `
    border-left: 3px solid #007bff;
    padding: 12px;
    margin: 8px 0;
    background: #f8f9fa;
    border-radius: 0 4px 4px 0;
    font-family: inherit;
    line-height: 1.4;
  `;
  
  // Description du statut
  const statusDescription = getStatusDescription(status);

  // Créer le contenu avec des éléments DOM sécurisés
  const mainDiv = document.createElement('div');
  mainDiv.style.fontSize = '14px';

  // Ajouter les badges et description
  const contentDiv = createVisualTicketContentDOM(chambre.numero, statusDescription, status, chambre);
  mainDiv.appendChild(contentDiv);

  // Ajouter les infos complémentaires
  const infoDiv = document.createElement('div');
  infoDiv.style.fontSize = '11px';
  infoDiv.style.color = '#666';
  infoDiv.style.marginTop = '6px';
  infoDiv.textContent = `Statut automatique • ${chambre.type || 'Standard'} • ${chambre.current_status} → ${chambre.next_status}`;
  mainDiv.appendChild(infoDiv);

  lineDiv.appendChild(mainDiv);

  // Ajouter à la fin de la liste des tickets
  container.appendChild(lineDiv);
}

/**
 * Ajouter une ligne de statut pour une chambre sans ticket
 */
function addRoomStatusLine(chambre, status, container) {
  // Éviter les doublons
  const existingLine = document.querySelector(`#room-status-${chambre.numero}`);
  if (existingLine) return;
  
  // Créer l'élément de ligne
  const lineDiv = document.createElement('div');
  lineDiv.id = `room-status-${chambre.numero}`;
  lineDiv.style.cssText = `
    border-left: 3px solid #007bff;
    padding: 8px 12px;
    margin: 8px 0;
    background: #f8f9fa;
    border-radius: 0 4px 4px 0;
  `;
  
  // Créer le contenu avec le même style que les vrais tickets
  const statusDescription = getStatusDescription(status);

  const mainDiv = document.createElement('div');
  mainDiv.style.fontSize = '14px';
  mainDiv.style.lineHeight = '1.4';

  const contentDiv = createVisualTicketContentDOM(chambre.numero, statusDescription, status, chambre);
  mainDiv.appendChild(contentDiv);

  const infoDiv = document.createElement('div');
  infoDiv.style.fontSize = '11px';
  infoDiv.style.color = '#666';
  infoDiv.style.marginTop = '4px';
  infoDiv.textContent = `Statut automatique • Type: ${chambre.type || 'Standard'}`;
  mainDiv.appendChild(infoDiv);

  lineDiv.appendChild(mainDiv);

  // Ajouter à la fin de la liste
  container.appendChild(lineDiv);
}

/**
 * Obtenir une description pour le statut
 */
function getStatusDescription(status) {
  const cleanStatus = status.replace(/[()]/g, '');
  
  switch (cleanStatus) {
    case 'inc': return 'Arrivée prévue';
    case 'in': return 'Client présent'; 
    case 'o': return 'Client en séjour';
    case 'out': return 'Départ effectué';
    case 'out/inc': return 'Rotation en cours';
    case 'day-use': return 'Day Use';
    case 'bloquée': return 'Out of Order';
    case 'oos': return 'Out of Service';
    default: return 'Statut à vérifier';
  }
}

/**
 * Ajouter le bouton Filtre à côté du Total
 */
function addFilterButton() {
  // Trouver l'élément Total
  const totalElement = document.querySelector('p');
  const totalElements = Array.from(document.querySelectorAll('p')).filter(p => 
    p.textContent.includes('Total :')
  );

  if (totalElements.length === 0) {
    return;
  }

  const totalElement2 = totalElements[0];
  
  // Supprimer le bouton existant s'il existe
  const existingFilter = document.getElementById('hotel-manager-filter-btn');
  if (existingFilter) {
    existingFilter.remove();
  }

  // Créer le bouton Filtre
  const filterButton = document.createElement('button');
  filterButton.id = 'hotel-manager-filter-btn';

  // Créer le SVG de manière sécurisée
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.73-4.8 5.75-7.39A1.003 1.003 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z');

  svg.appendChild(path);
  filterButton.appendChild(svg);
  filterButton.className = 'btn btn-default btn-sm';
  filterButton.style.cssText = `
    margin-left: 15px;
    font-size: 12px;
    padding: 6px 8px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    color: #495057;
    float: right;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;

  // Action du bouton filtre
  filterButton.addEventListener('click', async function(e) {
    e.preventDefault();
    await handleFilterToggle(this);
  });

  // Garder le style original du Total et ajouter le bouton avec position relative
  totalElement2.style.cssText = `
    position: relative;
  `;

  // Ajuster le style du bouton pour qu'il soit positionné à droite
  filterButton.style.cssText = `
    position: absolute;
    right: 0;
    top: 0;
    font-size: 12px;
    padding: 6px 8px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    color: #495057;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;

  // Ajouter le bouton dans l'élément Total
  totalElement2.appendChild(filterButton);

  // Bouton filtre ajouté
}

// Variable globale pour sauvegarder l'ordre original
let originalTicketsOrder = null;
let isFiltered = false;

/**
 * Gérer le toggle du filtrage des tickets
 */
async function handleFilterToggle(button) {
  // Visual feedback
  const originalOpacity = button.style.opacity;
  const originalBackground = button.style.background;
  
  button.style.opacity = '0.6';
  
  try {
    if (!isFiltered) {
      await activateFilter(button, originalBackground);
    } else {
      await deactivateFilter(button, originalBackground);
    }
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur lors du toggle filtrage:', error);
    
    // Flash rouge pour indiquer l'erreur
    button.style.background = '#dc3545';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 500);
  } finally {
    // Restaurer l'opacité
    button.style.opacity = originalOpacity;
  }
}

/**
 * Activer le filtrage
 */
async function activateFilter(button, originalBackground) {
  // D'abord, s'assurer que tous les tickets sont améliorés (pour avoir les data attributes)
  await enhanceTicketDisplay();
  
  // Sauvegarder l'ordre original avant de filtrer
  const ticketRows = document.querySelectorAll('tr.entry.ticket');
  if (ticketRows.length === 0) {
    return;
  }
  
  // Sauvegarder l'ordre original
  originalTicketsOrder = Array.from(ticketRows).map(row => ({
    element: row.cloneNode(true),
    originalIndex: Array.from(row.parentNode.children).indexOf(row)
  }));
  
  // Extraire les infos de chaque ticket pour le tri
  const ticketsData = [];
  ticketRows.forEach((row, index) => {
    let roomNumber = null;
    
    // Méthode 1: Utiliser l'attribut data-room-number que j'ai ajouté lors de l'amélioration
    if (row.dataset.roomNumber) {
      roomNumber = row.dataset.roomNumber;
    }
    
    // Méthode 2: Chercher le label de chambre que j'ai créé (class="label label-primary")
    if (!roomNumber) {
      const roomLabel = row.querySelector('.label.label-primary');
      if (roomLabel) {
        const labelText = roomLabel.textContent || '';
        const labelMatch = labelText.match(/#(\d{3})$/); // $ = fin du texte pour éviter #6131 -> #613
        if (labelMatch) {
          roomNumber = labelMatch[1];
        }
      }
    }
    
    // Méthode 3: Chercher dans le CONTENU du ticket uniquement (pas dans l'ID)
    // Le contenu est dans .ticket-content .content, pas dans .meta
    if (!roomNumber) {
      const contentEl = row.querySelector('.ticket-content .content');
      if (contentEl) {
        // Prendre seulement le premier noeud texte ou le texte avant les spans
        const firstText = contentEl.childNodes[0];
        if (firstText && firstText.nodeType === Node.TEXT_NODE) {
          const text = firstText.textContent || '';
          // Chercher #XXX au DÉBUT du texte (numéro de chambre)
          const textMatch = text.match(/^#(\d{3})\b/);
          if (textMatch) {
            roomNumber = textMatch[1];
          }
        }
      }
    }
    
    ticketsData.push({
      element: row,
      roomNumber: roomNumber,
      fullText: row.textContent || ''
    });
  });
  
  // Séparer : tickets avec numéro de chambre vs sans
  const ticketsWithRooms = ticketsData.filter(t => t.roomNumber !== null);
  const ticketsWithoutRooms = ticketsData.filter(t => t.roomNumber === null);
  
  // Trier les tickets avec chambre par numéro croissant
  ticketsWithRooms.sort((a, b) => {
    const numA = parseInt(a.roomNumber, 10);
    const numB = parseInt(b.roomNumber, 10);
    return numA - numB;
  });
  
  // Réorganiser le DOM : d'abord les chambres triées, puis le reste à la fin
  reorganizeTicketsInDOMDirect(ticketsWithRooms, ticketsWithoutRooms);
  
  // Marquer comme filtré et changer l'apparence du bouton
  isFiltered = true;
  button.style.background = '#007bff'; // Bleu pour indiquer "activé"
  button.style.color = 'white';

  // Recréer le SVG de manière sécurisée
  button.textContent = ''; // Vider le bouton
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.73-4.8 5.75-7.39A1.003 1.003 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z');

  svg.appendChild(path);
  button.appendChild(svg);

}

/**
 * Désactiver le filtrage (retour à l'ordre original)
 */
async function deactivateFilter(button, originalBackground) {
  if (!originalTicketsOrder) {
    return;
  }
  
  const tableBody = document.querySelector('table.tickets tbody');
  if (!tableBody) {
    return;
  }
  
  // Créer un nouveau tbody avec l'ordre original
  const newTableBody = document.createElement('tbody');
  
  // Restaurer l'ordre original
  originalTicketsOrder.forEach(ticketData => {
    newTableBody.appendChild(ticketData.element.cloneNode(true));
  });
  
  // Remplacer le tbody
  tableBody.parentNode.replaceChild(newTableBody, tableBody);
  
  // Rétablir les améliorations visuelles
  enhanceTicketDisplay();
  
  // Marquer comme non filtré et restaurer l'apparence du bouton
  isFiltered = false;
  button.style.background = originalBackground;
  button.style.color = '#495057';

  // Recréer le SVG de manière sécurisée
  button.textContent = ''; // Vider le bouton
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.73-4.8 5.75-7.39A1.003 1.003 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z');

  svg.appendChild(path);
  button.appendChild(svg);
}

/**
 * Gérer le filtrage des tickets (ancienne version)
 */
async function handleFilter(button) {
  // Visual feedback
  const originalOpacity = button.style.opacity;
  const originalBackground = button.style.background;
  
  button.style.opacity = '0.6';
  
  try {
    // Récupérer tous les tickets visibles dans le DOM
    const ticketRows = document.querySelectorAll('tr.entry.ticket');
    
    if (ticketRows.length === 0) {
      return;
    }
    
    // Extraire les infos de chaque ticket pour le tri
    const ticketsData = [];
    ticketRows.forEach(row => {
      // Extraire le numéro de chambre depuis le texte du ticket
      const ticketContent = row.textContent || '';
      const roomMatch = ticketContent.match(/#(\d{3})/);
      const roomNumber = roomMatch ? roomMatch[1] : null;
      
      ticketsData.push({
        element: row,
        roomNumber: roomNumber,
        fullText: ticketContent
      });
    });
    
    // Séparer les tickets avec et sans numéro de chambre
    const ticketsWithRooms = ticketsData.filter(t => t.roomNumber);
    const ticketsWithoutRooms = ticketsData.filter(t => !t.roomNumber);
    
    // Trier les tickets avec chambre par numéro croissant (exactement comme dans l'export)
    ticketsWithRooms.sort((a, b) => {
      const numA = parseInt(a.roomNumber);
      const numB = parseInt(b.roomNumber);
      return numA - numB;
    });
    
    // Réorganiser le DOM
    reorganizeTicketsInDOMDirect(ticketsWithRooms, ticketsWithoutRooms);
    
    // Flash vert pour indiquer le succès
    button.style.background = '#28a745';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 200);
    
    // Filtrage terminé
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur lors du filtrage:', error);
    
    // Flash rouge pour indiquer l'erreur
    button.style.background = '#dc3545';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 500);
  } finally {
    // Restaurer l'opacité
    button.style.opacity = originalOpacity;
  }
}

/**
 * Réorganiser les tickets dans le DOM - Version directe pour le filtrage
 * Ordre : 1) Tickets avec numéro de chambre (triés) 2) Tickets sans numéro à la fin
 */
function reorganizeTicketsInDOMDirect(ticketsWithRooms, ticketsWithoutRooms) {
  const tableBody = document.querySelector('table.tickets tbody');
  if (!tableBody) return;
  
  // Créer un nouveau tbody
  const newTableBody = document.createElement('tbody');
  
  // 1) D'ABORD : tickets AVEC numéro de chambre (déjà triés par numéro croissant)
  ticketsWithRooms.forEach((ticketData) => {
    newTableBody.appendChild(ticketData.element.cloneNode(true));
  });
  
  // 2) ENSUITE : tickets SANS numéro de chambre (à la fin)
  ticketsWithoutRooms.forEach((ticketData) => {
    newTableBody.appendChild(ticketData.element.cloneNode(true));
  });
  
  // Remplacer l'ancien tbody par le nouveau
  tableBody.parentNode.replaceChild(newTableBody, tableBody);
  
  // Rétablir les améliorations visuelles sur les nouveaux éléments
  enhanceTicketDisplay();
}

/**
 * Réorganiser les tickets dans le DOM - Version ancienne pour le scraping
 */
function reorganizeTicketsInDOM(ticketsWithRooms, ticketsWithoutRooms) {
  const tableBody = document.querySelector('table.tickets tbody');
  if (!tableBody) return;
  
  // Créer un nouveau tbody
  const newTableBody = document.createElement('tbody');
  
  // Ajouter d'abord tous les tickets avec numéro de chambre (triés par ordre croissant)
  ticketsWithRooms.forEach(ticket => {
    const ticketRow = document.getElementById(`entry_${ticket.id}`);
    if (ticketRow) {
      newTableBody.appendChild(ticketRow.cloneNode(true));
    }
  });
  
  // Ajouter ensuite tous les tickets sans numéro de chambre
  ticketsWithoutRooms.forEach(ticket => {
    const ticketRow = document.getElementById(`entry_${ticket.id}`);
    if (ticketRow) {
      newTableBody.appendChild(ticketRow.cloneNode(true));
    }
  });
  
  // Remplacer l'ancien tbody par le nouveau
  tableBody.parentNode.replaceChild(newTableBody, tableBody);
  
  // Rétablir les améliorations visuelles sur les nouveaux éléments
  enhanceTicketDisplay();
  
  // DOM réorganisé
}

/**
 * Créer un bouton stylé
 */
function createButton(text, color, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.cssText = `
    background: ${color};
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  `;

  button.addEventListener('click', onClick);

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '0.9';
    button.style.transform = 'translateY(-1px)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.opacity = '1';
    button.style.transform = 'translateY(0)';
  });

  return button;
}

/**
 * Mise à jour du statut
 */
function updateStatus(message) {
  const statusEl = document.getElementById('hotel-manager-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

/**
 * Scraping rapide avec le bouton dans le titre
 */
async function handleQuickScrapping(button) {
  const originalText = button.innerHTML;
  const originalBackground = button.style.background;
  
  try {
    // Désactiver le bouton sans changer le texte
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.6';

    const result = await scrapeTickets();
    
    if (result.success) {
      // Sauvegarder dans le storage
      await browser.storage.local.set({
        tickets_data: result.data,
        last_update_tickets: new Date().toISOString()
      });
      
      // Flash vert temporaire sans changer le texte
      const flashOriginalBg = button.style.background;
      button.style.background = '#28a745';
      
      // Retour couleur originale après flash
      setTimeout(() => {
        button.style.background = flashOriginalBg;
      }, 2000);
      
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur scrapping:', error);
    // Flash rouge temporaire
    const flashOriginalBg = button.style.background;
    button.style.background = '#dc3545';
    setTimeout(() => {
      button.style.background = flashOriginalBg;
    }, 2000);
  }
  
  // Rafraîchir l'affichage après scraping
  setTimeout(() => {
    enhanceTicketDisplay();
  }, 1500);
  
  // Réactiver le bouton après 3 secondes
  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}


/**
 * Gérer l'export PDF via l'interface d'impression Firefox
 */
async function handlePDFExport(button) {
  const originalBackground = button.style.background;
  
  try {
    // Désactiver le bouton
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.6';

    // Récupérer toutes les données
    const result = await browser.storage.local.get(['tickets_data', 'chambres_data']);
    
    const hasTickets = result.tickets_data && result.tickets_data.tickets;
    const hasChambres = result.chambres_data && result.chambres_data.chambres;

    let htmlContent = '';

    if (hasTickets && hasChambres) {
      // Export consolidé tickets + chambres
      const consolidatedData = await consolidateData(result.tickets_data, result.chambres_data);
      
      htmlContent = formatConsolidatedToHTML(consolidatedData);
    } else if (hasTickets) {
      // Export tickets seulement
      htmlContent = formatTicketsToHTML(result.tickets_data);
    } else {
      // Pas de données → Scraper automatiquement les tickets d'abord
      const scrapeResult = await scrapeTickets();
      
      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error);
      }
      
      if (scrapeResult.data.tickets.length === 0) {
        throw new Error('Aucun ticket trouvé sur cette page');
      }
      
      // Stocker les tickets scrapés
      await browser.storage.local.set({ 
        tickets_data: scrapeResult.data,
        last_update_tickets: new Date().toISOString()
      });
      
      // Export tickets seuls
      htmlContent = formatTicketsToHTML(scrapeResult.data);
    }
    
    // Ouvrir une fenêtre popup avec le contenu formaté pour l'impression
    openPrintWindow(htmlContent);
    
    // Flash vert pour indiquer succès
    button.style.background = '#28a745';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 2000);
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur export PDF:', error);
    // Flash rouge pour indiquer erreur
    button.style.background = '#dc3545';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 2000);
  }
  
  // Réactiver le bouton
  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}

/**
 * Gérer l'export PDF de la Rooming List (tableaux par étage)
 */
async function handleRoomingExport(button) {
  const originalBackground = button.style.background;

  try {
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.6';

    const result = await browser.storage.local.get(['chambres_data']);
    const chambres = result.chambres_data?.chambres || [];

    if (chambres.length === 0) {
      throw new Error('Aucune donnée chambre — ouvrir StayNTouch pour rafraîchir avant export');
    }

    const htmlContent = formatRoomingToHTML(chambres);
    openPrintWindow(htmlContent, 'Rooming List');

    button.style.background = '#28a745';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 2000);

  } catch (error) {
    console.error('❌ [DMBOOK] Erreur export rooming list:', error);
    button.style.background = '#dc3545';
    setTimeout(() => {
      button.style.background = originalBackground;
    }, 2000);
  }

  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}

/**
 * Gérer l'export PDF d'une liste personnalisée (2 colonnes, titre saisi par l'utilisateur).
 */
async function handleCustomListExport(button) {
  const originalBackground = button.style.background;

  // Désactiver AVANT await pour empêcher la re-entrance (double-modale).
  button.style.pointerEvents = 'none';
  button.style.opacity = '0.6';

  try {
    const customTitle = await promptCustomTitle();
    if (!customTitle) return;

    const htmlContent = formatCustomListToHTML(customTitle);
    openPrintWindow(htmlContent, customTitle);

    button.style.background = '#28a745';
    setTimeout(() => { button.style.background = originalBackground; }, 2000);

  } catch (error) {
    console.error('❌ [DMBOOK] Erreur export liste personnalisée:', error);
    button.style.background = '#dc3545';
    setTimeout(() => { button.style.background = originalBackground; }, 2000);
  }

  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}

function promptTextInput(options = {}) {
  const {
    id = 'hotel-manager-text-prompt',
    title = 'Saisir',
    placeholder = '',
    currentValue = '',
    okLabel = 'Valider',
    okBgColor = '#198754',
    zIndex = 999999
  } = options;

  return new Promise((resolve) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing._cleanup) existing._cleanup(null);
      else { console.warn('[DMBOOK] Overlay sans _cleanup détecté, remove direct'); existing.remove(); }
    }

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: ${zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      padding: 20px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      min-width: 380px;
      max-width: 90vw;
    `;

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.cssText = 'margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #333;';
    card.appendChild(titleEl);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 100;
    input.placeholder = placeholder;
    input.value = currentValue;
    input.style.cssText = 'width: 100%; padding: 8px 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; outline: none;';
    card.appendChild(input);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Annuler';
    cancelBtn.style.cssText = 'padding: 6px 14px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 13px;';
    actions.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = okLabel;
    okBtn.style.cssText = `padding: 6px 14px; border: none; background: ${okBgColor}; color: white; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;`;
    actions.appendChild(okBtn);

    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    setTimeout(() => { input.focus(); if (currentValue) input.select(); }, 0);

    let resolved = false;
    const cleanup = (value) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value);
    };

    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cleanup(input.value.trim() || null); }
      else if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
    };

    overlay._cleanup = cleanup;
    okBtn.addEventListener('click', () => cleanup(input.value.trim() || null));
    cancelBtn.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    document.addEventListener('keydown', onKey);
  });
}

function promptCustomTitle() {
  return promptTextInput({
    id: 'hotel-manager-modal',
    title: 'Titre de la liste',
    placeholder: 'Ex: Chambres à contrôler',
    okLabel: 'Générer PDF',
    okBgColor: '#fd7e14'
  });
}

// Liste personnalisée : en-tête = uniquement le titre saisi. 2 colonnes (checkbox + numéro).
function formatCustomListToHTML(customTitle) {
  const levels = [100, 200, 300, 400, 500, 600];
  let grid = '';

  for (const level of levels) {
    const roomsForLevel = ROOMS_BY_LEVEL[level] || [];
    if (roomsForLevel.length === 0) continue;

    grid += `<div class="floor-section"><table><tbody>`;
    roomsForLevel.forEach((roomNum, index) => {
      const rowClass = index === roomsForLevel.length - 1 ? 'floor-last' : '';
      grid += `
        <tr class="${rowClass}">
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-chambre"><span class="room-label">${roomNum}</span></td>
        </tr>
      `;
    });
    grid += `</tbody></table></div>`;
  }

  return `
    <div class="header" style="justify-content: center;">
      <h1>${escapeHTML(customTitle)}</h1>
    </div>
    <div class="floors-grid compact">${grid}</div>
  `;
}

/**
 * Formater la rooming list en HTML : un tableau par étage,
 * 3 colonnes (case à cocher, numéro de chambre, statut).
 */
function formatRoomingToHTML(chambres) {
  const now = new Date();
  const today = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  const chambresByNumero = new Map();
  chambres.forEach(c => {
    if (c.numero != null) {
      chambresByNumero.set(String(c.numero).trim(), c);
    }
  });

  const isMorning = now.getHours() >= 2 && now.getHours() < 14;
  const levels = [100, 200, 300, 400, 500, 600];
  let availableNow = 0;
  let grid = '';

  for (const level of levels) {
    const roomsForLevel = ROOMS_BY_LEVEL[level] || [];
    if (roomsForLevel.length === 0) continue;

    grid += `<div class="floor-section"><table><tbody>`;

    roomsForLevel.forEach((roomNum, index) => {
      const numeroStr = String(roomNum);
      const info = chambresByNumero.get(numeroStr) || null;

      if (info && isRoomAvailableNow(info, isMorning)) {
        availableNow++;
      }

      const roomLabelClass = info && info.is_pickup ? 'room-label pickup' : 'room-label';
      const statusBadge = info ? getStatusBadgeFromChambre(info) : '';
      const rowClass = index === roomsForLevel.length - 1 ? 'floor-last' : '';

      grid += `
        <tr class="${rowClass}">
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-chambre"><span class="${roomLabelClass}">${numeroStr}</span></td>
          <td class="col-statut">${statusBadge}</td>
        </tr>
      `;
    });

    grid += `</tbody></table></div>`;
  }

  return `
    <div class="header">
      <div class="date">${today}</div>
      <h1>Rooming List</h1>
      <span class="total">${availableNow} dispo</span>
    </div>
    <div class="floors-grid">${grid}</div>
  `;
}

// Chambre accessible = pas de client présent. DAY-USE exclu, OOO/OOS inclus (vides).
function isRoomAvailableNow(info, isMorning) {
  if (info.is_day_use) return false;
  if (info.is_ooo || info.is_oos) return true;
  const statuses = analyzeStayNTouchStatuses(
    info.current_status || '',
    info.next_status || '',
    info.check_out_time || null,
    info.check_in_time || null
  );
  const nowStatus = isMorning ? statuses.morning : statuses.afternoon;
  return nowStatus === 'OUT' || nowStatus === 'DISPO' || nowStatus === 'INC';
}

// Feuille de style partagée par tous les exports PDF — construite une seule fois.
const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.3; color: #222; padding: 8mm; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #333; }
  .header .date { font-size: 9pt; color: #666; text-align: left; }
  .header h1 { font-size: 14pt; font-weight: 600; letter-spacing: -0.5px; text-align: center; }
  .header .total { font-size: 10pt; font-weight: 600; color: #333; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead th { text-align: left; padding: 6px 8px; background: #f5f5f5; border-bottom: 2px solid #333; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  tbody tr { border-bottom: 1px solid #eee; }
  tbody tr.floor-last { border-bottom: 2px solid #333; }
  tbody tr:hover { background: #fafafa; }
  td { padding: 5px 8px; vertical-align: top; }
  .col-check { width: 24px; text-align: center; vertical-align: middle; }
  .checkbox { display: inline-block; width: 14px; height: 14px; border: 2px solid #333; border-radius: 2px; }
  tr.row-checked .checkbox { background: #000; border-color: #000; }
  .col-chambre { width: 50px; vertical-align: middle; text-align: center; }
  .room-label { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 9pt; font-weight: 700; color: #333; background-color: #f0f0f0; border: 1px solid #ccc; }
  .room-label.pickup { background-color: #ff8c00; color: white; border-color: #ff8c00; }
  .col-statut { width: 100px; text-align: center; vertical-align: middle; padding: 5px 4px !important; }
  .col-description { color: #333; }
  .status-badge { display: block; width: 100%; box-sizing: border-box; padding: 4px 2px; border-radius: 3px; font-size: 8pt; font-weight: 700; color: white; text-transform: uppercase; white-space: nowrap; text-align: center; }
  .status-badge.orange { background-color: #ff8c00; }
  .status-badge.yellow { background-color: #ffc107; color: #333; }
  .status-badge.red { background-color: #dc3545; }
  .status-badge.blue { background-color: #007bff; }
  .status-badge.green { background-color: #28a745; }
  .status-badge.gray { background-color: #6c757d; }
  .floors-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px 0; }
  .floor-section { page-break-inside: avoid; break-inside: avoid; padding: 0 8px; border-right: 1px solid #e5e5e5; }
  .floor-section:last-child { border-right: none; }
  .floors-grid table { font-size: 8pt; }
  .floors-grid td { padding: 2px 4px; }
  .floors-grid .col-check { width: 18px; }
  .floors-grid .checkbox { width: 10px; height: 10px; border-width: 1px; }
  .floors-grid .col-chambre { width: 40px; }
  .floors-grid .room-label { padding: 1px 5px; font-size: 8pt; }
  .floors-grid .col-statut { width: auto; padding: 2px !important; }
  .floors-grid .status-badge { padding: 2px 1px; font-size: 5pt; }
  .floors-grid tbody tr { border-bottom: 1px solid #eee; }
  .floors-grid tbody tr.floor-last { border-bottom: none; }
  .floors-grid.compact { gap: 4px 24px; }
  .floors-grid.compact .floor-section { padding: 0; border-right: none; }
  .floors-grid.compact table { width: auto; margin: 0 auto; }
  .floors-grid.compact td { padding: 2px 2px; }
  .floors-grid.compact .col-check { padding-right: 4px; }
  .floors-grid.compact .col-chambre { padding-left: 0; }
  .section-divers { margin-top: 10px; }
  .section-divers h2 { font-size: 10pt; font-weight: 600; color: #666; margin-bottom: 8px; }
  .divers-item { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 9pt; display: flex; align-items: center; gap: 8px; }
  .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #333; text-align: right; font-size: 9pt; font-weight: 600; color: #555; }
  @media print {
    body { padding: 5mm; }
    @page { margin: 5mm; }
    tbody tr { page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  }
  .room-label, .status-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
`;

/**
 * Imprimer le contenu via un iframe avec srcdoc
 * Affiche directement la boîte de dialogue d'impression sans ouvrir un nouvel onglet
 */
function openPrintWindow(htmlContent, title = 'Tickets de Maintenance') {
  const existingFrame = document.getElementById('hotel-manager-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>${htmlContent}</body>
</html>`;
  
  // Créer un iframe avec srcdoc (évite les problèmes cross-origin)
  const printFrame = document.createElement('iframe');
  printFrame.id = 'hotel-manager-print-frame';
  printFrame.style.cssText = 'position: fixed; top: -10000px; left: -10000px; width: 800px; height: 600px; border: none;';
  printFrame.srcdoc = fullHTML;
  
  // Événement de chargement pour lancer l'impression
  printFrame.onload = function() {
    setTimeout(() => {
      try {
        printFrame.contentWindow.print();
      } catch (e) {
        console.error('Erreur impression iframe:', e);
        // Fallback: ouvrir dans un nouvel onglet
        fallbackPrintNewTab(fullHTML);
      }
      
      // Supprimer l'iframe après un délai
      setTimeout(() => {
        if (printFrame.parentNode) {
          printFrame.remove();
        }
      }, 2000);
    }, 300);
  };
  
  document.body.appendChild(printFrame);
}

/**
 * Fallback: ouvrir dans un nouvel onglet si l'iframe ne fonctionne pas
 */
function fallbackPrintNewTab(fullHTML) {
  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  
  const printWindow = window.open(blobUrl, '_blank');
  
  if (printWindow) {
    // Nettoyer après un délai
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  } else {
    alert('Veuillez autoriser les popups pour générer le PDF');
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Formater les tickets en HTML pour l'impression (sans données StayNTouch)
 */
function formatTicketsToHTML(ticketsData) {
  const today = new Date().toLocaleDateString('fr-FR');
  const tickets = ticketsData.tickets || [];
  
  // Regrouper par niveau
  const byLevel = {
    100: [],
    200: [],
    300: [],
    400: [],
    500: [],
    600: [],
    DIVERS: []
  };
  
  tickets.forEach(ticket => {
    const match = ticket.contenu.match(/^#?(\d{3})\s+(.+)/);
    
    if (match) {
      const roomNum = match[1];
      let description = match[2].split(/[\n\r]+/)[0].trim();
      description = cleanDescription(description);
      
      const level = Math.floor(parseInt(roomNum) / 100) * 100;
      
      if (byLevel[level]) {
        byLevel[level].push({ numero: roomNum, description: description });
      } else {
        byLevel.DIVERS.push({ description: description });
      }
    } else {
      const cleanDesc = ticket.contenu.split(/[\n\r]+/)[0].trim();
      if (cleanDesc && cleanDesc.length > 3) {
        byLevel.DIVERS.push({ description: cleanDescription(cleanDesc) });
      }
    }
  });
  
  // Trier par numéro dans chaque niveau
  for (const level in byLevel) {
    if (level !== 'DIVERS') {
      byLevel[level].sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    }
  }
  
  // Compter le total de tickets d'abord
  const levels = [100, 200, 300, 400, 500, 600];
  let totalTickets = 0;
  for (const level of levels) {
    totalTickets += byLevel[level].length;
  }
  totalTickets += byLevel.DIVERS.length;
  
  // Construire le HTML - Format tableau minimaliste
  let html = `
    <div class="header">
      <div class="date">${today}</div>
      <h1>Tickets de Maintenance</h1>
      <span class="total">${totalTickets} tickets</span>
    </div>
    <table>
      <tbody>
  `;
  
  for (const level of levels) {
    if (byLevel[level].length > 0) {
      const ticketsInLevel = byLevel[level];
      ticketsInLevel.forEach((ticket, index) => {
        const isLastOfFloor = index === ticketsInLevel.length - 1;
        const rowClass = isLastOfFloor ? 'floor-last' : '';
        
        html += `
          <tr class="${rowClass}">
            <td class="col-check"><span class="checkbox"></span></td>
            <td class="col-chambre"><span class="room-label">${ticket.numero}</span></td>
            <td class="col-description">${escapeHTML(ticket.description)}</td>
          </tr>
        `;
      });
    }
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  // Section DIVERS (sans titre)
  if (byLevel.DIVERS.length > 0) {
    html += `<div class="section-divers">`;
    
    byLevel.DIVERS.forEach(ticket => {
      html += `<div class="divers-item"><span class="checkbox"></span>${escapeHTML(ticket.description)}</div>`;
    });
    
    html += `</div>`;
  }
  
  return html;
}

/**
 * Formater les données consolidées en HTML pour l'impression
 */
function formatConsolidatedToHTML(consolidatedData) {
  const today = new Date().toLocaleDateString('fr-FR');
  
  // Récupérer les tickets des chambres scrapées
  const ticketsFromChambres = consolidatedData.chambres.flatMap(chambre => 
    chambre.tickets.map(ticket => ({
      ...ticket,
      chambre_info: chambre
    }))
  );
  
  // Récupérer les tickets sans chambre ou dont la chambre n'a pas été scrapée
  const ticketsOrphelins = consolidatedData.tickets_sans_chambre || [];
  
  // Combiner tous les tickets
  const tickets = ticketsFromChambres.concat(ticketsOrphelins);
  
  // Regrouper par niveau
  const byLevel = {
    100: [],
    200: [],
    300: [],
    400: [],
    500: [],
    600: [],
    DIVERS: []
  };
  
  tickets.forEach(ticket => {
    let cleanContent = ticket.contenu || ticket.content || '';
    const match = cleanContent.match(/^#?(\d{3})\s+(.+)/);
    
    if (match) {
      const roomNum = match[1];
      let description = match[2].split(/[\n\r]+/)[0].trim();
      description = cleanDescription(description);
      
      // Calculer le statut (seulement si on a les infos de la chambre)
      let roomStatus = null;
      let isPickup = false;
      if (ticket.chambre_info) {
        roomStatus = calculateRoomStatus(ticket.chambre_info);
        isPickup = ticket.chambre_info.is_pickup || false;
      }
      
      const level = Math.floor(parseInt(roomNum) / 100) * 100;
      
      if (byLevel[level]) {
        byLevel[level].push({ 
          numero: roomNum, 
          description: description,
          status: roomStatus,
          isPickup: isPickup,
          chambreInfo: ticket.chambre_info || null
        });
      } else {
        byLevel.DIVERS.push({ description: description });
      }
    } else {
      const cleanDesc = cleanContent.split(/[\n\r]+/)[0].trim();
      if (cleanDesc && cleanDesc.length > 3) {
        byLevel.DIVERS.push({ description: cleanDescription(cleanDesc) });
      }
    }
  });
  
  // Trier par numéro dans chaque niveau
  for (const level in byLevel) {
    if (level !== 'DIVERS') {
      byLevel[level].sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    }
  }
  
  // Compter le total de tickets d'abord
  const levels = [100, 200, 300, 400, 500, 600];
  let totalTickets = 0;
  for (const level of levels) {
    totalTickets += byLevel[level].length;
  }
  totalTickets += byLevel.DIVERS.length;
  
  // Construire le HTML - Format tableau minimaliste
  let html = `
    <div class="header">
      <div class="date">${today}</div>
      <h1>Tickets de Maintenance</h1>
      <span class="total">${totalTickets} tickets</span>
    </div>
    <table>
      <tbody>
  `;
  
  for (const level of levels) {
    if (byLevel[level].length > 0) {
      const ticketsInLevel = byLevel[level];
      ticketsInLevel.forEach((ticket, index) => {
        const roomLabelClass = ticket.isPickup ? 'room-label pickup' : 'room-label';
        const statusBadge = getStatusBadgeHTML(ticket.status, ticket.chambreInfo);
        const isLastOfFloor = index === ticketsInLevel.length - 1;
        const rowClass = isLastOfFloor ? 'floor-last' : '';
        
        html += `
          <tr class="${rowClass}">
            <td class="col-check"><span class="checkbox"></span></td>
            <td class="col-chambre"><span class="${roomLabelClass}">${ticket.numero}</span></td>
            <td class="col-statut">${statusBadge}</td>
            <td class="col-description">${escapeHTML(ticket.description)}</td>
          </tr>
        `;
      });
    }
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  // Section DIVERS (sans titre)
  if (byLevel.DIVERS.length > 0) {
    html += `<div class="section-divers">`;
    
    byLevel.DIVERS.forEach(ticket => {
      html += `<div class="divers-item"><span class="checkbox"></span>${escapeHTML(ticket.description)}</div>`;
    });
    
    html += `</div>`;
  }
  
  return html;
}

/**
 * Générer le badge HTML pour un statut
 */
function getStatusBadgeHTML(status, chambreInfo = null) {
  // Si on a les infos de la chambre, utiliser le format CURRENT → NEXT
  if (chambreInfo && chambreInfo.current_status !== undefined) {
    return getStatusBadgeFromChambre(chambreInfo);
  }
  
  // Sinon, utiliser l'ancien format basé sur le statut calculé
  if (!status || status === '(null)') {
    return '';
  }
  
  const cleanStatus = status.replace(/[()]/g, '');
  let colorClass = 'gray';
  let displayText = cleanStatus.toUpperCase();
  
  if (cleanStatus === 'o') {
    displayText = 'RECOUCHE';
    colorClass = 'blue';
  } else if (cleanStatus === 'bloquée' || cleanStatus === 'ooo') {
    displayText = 'OUT OF ORDER';
    colorClass = 'gray';
  } else if (cleanStatus === 'oos') {
    displayText = 'OUT OF SERVICE';
    colorClass = 'gray';
  } else if (cleanStatus === 'in') {
    colorClass = 'red';
  } else if (cleanStatus.includes('inc')) {
    colorClass = 'orange';
  } else if (cleanStatus === 'out' || cleanStatus === 'dispo') {
    colorClass = 'green';
  }
  
  return `<span class="status-badge ${colorClass}">${displayText}</span>`;
}

/**
 * Convertir une heure au format "02:00 pm" ou "14:00" en nombre d'heures (0-23)
 * @param {string} timeStr - L'heure au format texte
 * @returns {number|null} - L'heure en format 24h ou null si invalide
 */
function parseCheckTime(timeStr) {
  if (!timeStr) return null;
  
  const str = timeStr.trim().toLowerCase();
  
  // Format "02:00 pm" ou "2:00 am"
  const match12h = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12h) {
    let hours = parseInt(match12h[1], 10);
    const minutes = parseInt(match12h[2], 10);
    const period = match12h[3].toLowerCase();
    
    // Conversion 12h → 24h
    if (period === 'am') {
      if (hours === 12) hours = 0; // 12:00 am = 00:00
    } else { // pm
      if (hours !== 12) hours += 12; // 2:00 pm = 14:00, 12:00 pm = 12:00
    }
    
    return hours;
  }
  
  // Format "14:00" (24h)
  const match24h = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24h) {
    return parseInt(match24h[1], 10);
  }
  
  return null;
}

/**
 * Analyser la COMBINAISON de current_status et next_status
 * pour déterminer la TRANSITION matin → après-midi
 * Prend en compte les horaires EARLY/LATE
 * 
 * @param {string} currentRaw - Statut actuel StayNTouch
 * @param {string} nextRaw - Statut suivant StayNTouch
 * @param {string} checkOutTime - Heure de départ prévue (ex: "12:00 pm")
 * @param {string} checkInTime - Heure d'arrivée prévue (ex: "02:00 pm")
 * @returns {Object} - { morning, afternoon, isEarly, isLate }
 */
function analyzeStayNTouchStatuses(currentRaw, nextRaw, checkOutTime = null, checkInTime = null) {
  const current = currentRaw || '';
  const next = nextRaw || '';
  
  // Helpers
  const currentHas = (text) => current.includes(text);
  const nextHas = (text) => next.includes(text);
  
  // Détecter EARLY/LATE
  const checkOutHour = parseCheckTime(checkOutTime);
  const checkInHour = parseCheckTime(checkInTime);

  // LATE CHECK-OUT : départ prévu après 14h00 (strictement supérieur)
  const isLate = checkOutHour !== null && checkOutHour > 14;
  // EARLY CHECK-IN : arrivée prévue avant 14h00
  const isEarly = checkInHour !== null && checkInHour < 14;
  
  // Résultat par défaut
  let result = { morning: 'DISPO', afternoon: 'DISPO', isEarly: false, isLate: false };
  
  // Cas spécial: "Arrived / Departed" = rotation (quelqu'un part, quelqu'un arrive)
  if (currentHas('Arrived') && currentHas('Departed')) {
    result = { morning: 'OUT', afternoon: 'IN', isEarly, isLate };
    return result;
  }
  
  // Stayover = recouche (client déjà là depuis hier, reste aujourd'hui)
  if (currentHas('Stayover')) {
    result = { morning: 'RECOUCHE', afternoon: 'RECOUCHE', isEarly: false, isLate: false };
    return result;
  }
  
  // Due out = départ prévu (client là le matin, part dans la journée)
  if (currentHas('Due out') || currentHas('Due Out')) {
    if (nextHas('Arrival') || nextHas('Arrived')) {
      // Départ puis arrivée = rotation IN → INC
      result = { morning: 'IN', afternoon: 'INC', isEarly, isLate };
    } else {
      // Départ sans arrivée = IN → DISPO
      result = { morning: 'IN', afternoon: 'DISPO', isEarly: false, isLate };
    }
    return result;
  }
  
  // Departed = départ effectué (client parti)
  if (currentHas('Departed')) {
    if (nextHas('Arrival') || nextHas('Arrived')) {
      // Départ puis arrivée = rotation OUT → INC
      result = { morning: 'OUT', afternoon: 'INC', isEarly, isLate: false };
    } else {
      // Départ sans arrivée = OUT → DISPO (chambre sera disponible après ménage)
      result = { morning: 'OUT', afternoon: 'DISPO', isEarly: false, isLate: false };
    }
    return result;
  }
  
  // Arrived = arrivée effectuée (client arrivé)
  if (currentHas('Arrived')) {
    // Transition: DISPO → IN
    result = { morning: 'DISPO', afternoon: 'IN', isEarly, isLate: false };
    return result;
  }
  
  // Arrival = arrivée prévue (pas encore arrivé)
  if (currentHas('Arrival')) {
    result = { morning: 'DISPO', afternoon: 'INC', isEarly, isLate: false };
    return result;
  }
  
  // Not Reserved = disponible
  if (currentHas('Not Reserved') || current === '') {
    if (nextHas('Arrival') || nextHas('Arrived')) {
      // Arrivée prévue
      result = { morning: 'DISPO', afternoon: 'INC', isEarly, isLate: false };
    } else {
      // Stable: reste DISPO
      result = { morning: 'DISPO', afternoon: 'DISPO', isEarly: false, isLate: false };
    }
    return result;
  }
  
  return result;
}

/**
 * Déterminer la couleur d'un statut simple
 */
function getStatusColor(status) {
  if (status === 'RECOUCHE') return 'blue';
  if (status === 'IN') return 'red';
  if (status === 'INC') return 'orange';
  return 'green'; // DISPO, OUT
}

/**
 * Générer le badge de statut à partir des infos de chambre
 * Utilise CURRENT pour le matin et NEXT pour l'après-midi
 * Format: [EARLY/LATE] MATIN / APREM si différent, sinon juste le statut unique
 * La couleur dépend de l'heure: matin (02h-14h) = couleur matin, après-midi (14h-02h) = couleur après-midi
 * Exception: si INC présent → orange prioritaire (sauf si IN le matin)
 */
function computeStatusBadge(chambre) {
  if (!chambre) return null;

  if (chambre.is_ooo) return { text: 'OUT OF ORDER', colorClass: 'gray' };
  if (chambre.is_oos) return { text: 'OUT OF SERVICE', colorClass: 'gray' };
  if (chambre.is_day_use) return { text: 'DAY-USE', colorClass: 'yellow' };

  const currentStatusRaw = chambre.current_status || '';
  const nextStatusRaw = chambre.next_status || '';
  const checkOutTime = chambre.check_out_time || null;
  const checkInTime = chambre.check_in_time || null;

  const statuses = analyzeStayNTouchStatuses(currentStatusRaw, nextStatusRaw, checkOutTime, checkInTime);
  const morningStatus = statuses.morning;
  const afternoonStatus = statuses.afternoon;
  const isEarly = statuses.isEarly;
  const isLate = statuses.isLate;

  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 2 && currentHour < 14;

  let prefix = '';
  if (isLate && morningStatus === 'IN') prefix = 'LATE ';
  else if (isEarly && afternoonStatus === 'IN') prefix = 'EARLY ';
  else if (isEarly && afternoonStatus === 'INC') prefix = 'EARLY ';

  if (morningStatus === afternoonStatus) {
    return { text: prefix + morningStatus, colorClass: getStatusColor(morningStatus) };
  }

  let colorClass;
  if (isMorning) {
    colorClass = getStatusColor(morningStatus);
    if (morningStatus !== 'IN' && afternoonStatus === 'INC') colorClass = 'orange';
  } else {
    colorClass = getStatusColor(afternoonStatus);
    if (afternoonStatus === 'INC') colorClass = 'orange';
  }
  return { text: `${prefix}${morningStatus} / ${afternoonStatus}`, colorClass };
}

function getStatusBadgeFromChambre(chambre) {
  const info = computeStatusBadge(chambre);
  if (!info) return '';
  return `<span class="status-badge ${info.colorClass}">${info.text}</span>`;
}

// KEEP IN SYNC with .status-badge.<color> rules in PRINT_CSS — rendering divergence sinon entre modale et PDF.
const STATUS_BADGE_COLORS = {
  orange: { bg: '#ff8c00', color: 'white' },
  yellow: { bg: '#ffc107', color: '#333' },
  red:    { bg: '#dc3545', color: 'white' },
  blue:   { bg: '#007bff', color: 'white' },
  green:  { bg: '#28a745', color: 'white' },
  gray:   { bg: '#6c757d', color: 'white' }
};

function buildStatusBadgeElement(chambre) {
  const info = computeStatusBadge(chambre);
  if (!info) return null;
  const color = STATUS_BADGE_COLORS[info.colorClass] || STATUS_BADGE_COLORS.gray;
  const span = document.createElement('span');
  span.textContent = info.text;
  // Bloc pleine largeur de sa colonne + centré : mêmes règles que .status-badge de PRINT_CSS.
  span.style.cssText = `
    display: block;
    width: 100%;
    padding: 3px 4px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    line-height: 1.3;
    text-align: center;
    background: ${color.bg};
    color: ${color.color};
    white-space: nowrap;
    box-sizing: border-box;
  `;
  return span;
}

/**
 * Nettoyer une description de ticket
 * - Retire les # isolés (non suivis d'un numéro de chambre)
 * - Retire // et tout ce qui suit
 */
function cleanDescription(description) {
  if (!description) return '';
  
  let cleaned = description;
  
  // Retirer // et tout ce qui suit
  if (cleaned.includes('//')) {
    cleaned = cleaned.split('//')[0];
  }
  
  // Retirer les # isolés (non suivis de 3 chiffres)
  cleaned = cleaned.replace(/#(?!\d{3})/g, '');
  
  // Nettoyer les espaces multiples et trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Échapper les caractères HTML pour éviter les injections
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gérer le reset des données et rafraîchir la page
 */
async function handleReset(button) {
  try {
    // Désactiver le bouton
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.6';

    // Supprimer toutes les données du storage (y compris StayNTouch)
    await browser.storage.local.remove([
      'chambres_data',
      'tickets_data', 
      'tickets_formatted',
      'tickets_formatted_data',
      'consolidated_data',
      'last_update',
      'last_update_rooms',
      'last_update_tickets'
    ]);

    // Flash vert pour confirmer puis rafraîchir la page
    button.style.background = '#28a745';

    setTimeout(() => {
      // Rafraîchir la page comme F5
      location.reload();
    }, 300);
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur reset:', error);
    // Flash rouge en cas d'erreur
    button.style.background = '#dc3545';
  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
    }, 2000);
  }
}

/**
 * Télécharger un fichier TXT
 */
function downloadTXT(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.txt`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formater les tickets en TXT
 */
function formatTicketsToTXT(ticketsData) {
  const today = new Date().toLocaleDateString('fr-FR');
  const tickets = ticketsData.tickets || [];
  
  // Regrouper par niveau
  const byLevel = {
    100: [],
    200: [],
    300: [],
    400: [],
    500: [],
    600: [],
    DIVERS: []
  };
  
  tickets.forEach(ticket => {
    const match = ticket.contenu.match(/^#?(\d{3})\s+(.+)/);
    
    if (match) {
      const roomNum = match[1];
      let description = match[2].split(/[\n\r]+/)[0].trim();
      description = cleanDescription(description);
      
      const level = Math.floor(parseInt(roomNum) / 100) * 100;
      
      if (byLevel[level]) {
        byLevel[level].push({ numero: roomNum, description: description });
      } else {
        byLevel.DIVERS.push({ description: description });
      }
    } else {
      const cleanDesc = ticket.contenu.split(/[\n\r]+/)[0].trim();
      if (cleanDesc && cleanDesc.length > 3) {
        byLevel.DIVERS.push({ description: cleanDescription(cleanDesc) });
      }
    }
  });
  
  // Trier par numéro dans chaque niveau
  for (const level in byLevel) {
    if (level !== 'DIVERS') {
      byLevel[level].sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    }
  }
  
  // Construire le texte
  let output = `LISTE DES TICKETS DE MAINTENANCE\nDate : ${today}\n\n`;
  
  const levels = [100, 200, 300, 400, 500, 600];
  let hasTickets = false;
  
  for (const level of levels) {
    if (byLevel[level].length > 0) {
      if (hasTickets) output += '----------\n\n';
      
      byLevel[level].forEach(ticket => {
        output += `#${ticket.numero} - ${ticket.description}\n\n`;
      });
      
      hasTickets = true;
    }
  }
  
  // Section DIVERS
  if (byLevel.DIVERS.length > 0) {
    if (hasTickets) output += '----------\n\n';
    output += 'DIVERS\n\n';
    byLevel.DIVERS.forEach(ticket => {
      output += `${ticket.description}\n\n`;
    });
  }
  
  output += `Total de tickets : ${tickets.length}`;
  return output;
}

/**
 * Consolidation simple des données
 */
async function consolidateData(ticketsData, chambresData) {
  // Créer un set des numéros de chambres scrapées (convertis en string)
  const chambresScrapees = new Set(chambresData.chambres.map(c => String(c.numero).trim()));
  
  const chambres = chambresData.chambres.map(chambre => {
    const chambreNumero = String(chambre.numero).trim();
    
    // Trouver les tickets associés à cette chambre (comparaison string)
    const ticketsAssocies = ticketsData.tickets.filter(ticket => {
      const ticketNumero = ticket.numero_chambre ? String(ticket.numero_chambre).trim() : null;
      return ticketNumero === chambreNumero;
    });
    
    // Calculer la priorité
    let priority = 'BASSE';
    if (chambre.statut_proprete === 'DIRTY') {
      priority = 'HAUTE';
    } else if (ticketsAssocies.length > 0) {
      priority = 'MOYENNE';
    }
    
    return {
      ...chambre,
      tickets: ticketsAssocies,
      priority: priority,
      nb_tickets: ticketsAssocies.length
    };
  });
  
  // Tickets sans chambre associée OU dont la chambre n'a pas été scrapée
  const ticketsSansChambre = ticketsData.tickets.filter(ticket => {
    if (!ticket.numero_chambre) return true;
    const ticketNumero = String(ticket.numero_chambre).trim();
    return !chambresScrapees.has(ticketNumero);
  });
  
  return {
    chambres: chambres,
    tickets_sans_chambre: ticketsSansChambre,
    timestamp: new Date().toISOString(),
    total_chambres: chambres.length,
    total_tickets: ticketsData.tickets.length
  };
}

/**
 * Formater les données consolidées en TXT - utilise la base du ticket seul + statuts
 */
function formatConsolidatedToTXT(consolidatedData) {
  const today = new Date().toLocaleDateString('fr-FR');
  const tickets = consolidatedData.chambres.flatMap(chambre => 
    chambre.tickets.map(ticket => ({
      ...ticket,
      chambre_info: chambre
    }))
  ).concat(consolidatedData.tickets_sans_chambre || []);
  
  // Utiliser exactement la même logique que formatTicketsToTXT mais avec les statuts
  const byLevel = {
    100: [],
    200: [],
    300: [],
    400: [],
    500: [],
    600: [],
    DIVERS: []
  };
  
  tickets.forEach(ticket => {
    let cleanContent = ticket.contenu || ticket.content || '';
    
    // Extraire le numéro de chambre au début du contenu
    const match = cleanContent.match(/^#?(\d{3})\s+(.+)/);
    
    if (match) {
      const roomNum = match[1];
      let description = match[2];
      
      // Nettoyer la description (enlever tout après un saut de ligne)
      description = description.split(/[\n\r]+/)[0].trim();
      description = cleanDescription(description);
      
      // Ajouter le statut entre parenthèses si disponible + PU si PICKUP
      let statusText = '';
      if (ticket.chambre_info) {
        const roomStatus = calculateRoomStatus(ticket.chambre_info);
        if (roomStatus && roomStatus !== '(null)') {
          statusText = ` ${roomStatus}`;
          
          // Ajouter (P.U) si la chambre est en PICKUP
          if (ticket.chambre_info.is_pickup) {
            statusText += ' (P.U)';
          }
        }
      }
      
      const level = Math.floor(parseInt(roomNum) / 100) * 100;
      
      if (byLevel[level]) {
        byLevel[level].push({
          numero: roomNum,
          description: description + statusText
        });
      } else {
        byLevel.DIVERS.push({ description: description + statusText });
      }
    } else {
      // Pas de numéro de chambre détecté → DIVERS
      const cleanDesc = cleanContent.split(/[\n\r]+/)[0].trim();
      if (cleanDesc && cleanDesc.length > 3) {
        byLevel.DIVERS.push({ description: cleanDescription(cleanDesc) });
      }
    }
  });
  
  // Trier dans chaque niveau
  for (const level in byLevel) {
    if (level !== 'DIVERS') {
      byLevel[level].sort((a, b) => {
        const numA = parseInt(a.numero);
        const numB = parseInt(b.numero);
        return numA - numB;
      });
    }
  }
  
  // Construire le texte formaté (même structure que ticket seul)
  let output = `LISTE DES TICKETS DE MAINTENANCE\nDate : ${today}\n\n`;
  
  const levels = [100, 200, 300, 400, 500, 600];
  let hasTickets = false;
  
  for (const level of levels) {
    if (byLevel[level].length > 0) {
      if (hasTickets) output += '----------\n\n';
      
      byLevel[level].forEach(ticket => {
        output += `#${ticket.numero} - ${ticket.description}\n\n`;
      });
      
      hasTickets = true;
    }
  }
  
  // Section DIVERS
  if (byLevel.DIVERS.length > 0) {
    if (hasTickets) output += '----------\n\n';
    output += 'DIVERS\n\n';
    byLevel.DIVERS.forEach(ticket => {
      output += `${ticket.description}\n\n`;
    });
    if (hasTickets) output += '----------\n\n';
  }
  
  output += `Total de tickets : ${tickets.length}`;
  
  return output;
}

/**
 * Améliorer l'affichage simple des tickets - juste numéro + statut
 */
async function enhanceTicketDisplay() {
  try {
    const result = await browser.storage.local.get(['chambres_data']);
    const chambresData = result.chambres_data?.chambres || [];

    // Map O(1) au lieu de .find() O(N) par ticket — 80 chambres × 50 tickets sinon.
    const chambresByNumero = new Map();
    chambresData.forEach(c => {
      if (c.numero != null) chambresByNumero.set(String(c.numero), c);
    });

    const ticketContents = document.querySelectorAll('.ticket-content .content');
    let ticketsAmeliores = 0;

    ticketContents.forEach((contentEl, index) => {
      try {
        let textNode = contentEl.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

        const originalText = textNode.textContent.trim();
        if (contentEl.dataset.enhanced === 'true') return;

        const roomMatch = originalText.match(/^#(\d{3})\b(.*)$/);

        if (roomMatch) {
          const roomNumber = roomMatch[1];
          const description = roomMatch[2].trim();

          const chambreInfo = chambresByNumero.get(roomNumber) || null;
          
          // Calculer le vrai statut avec la fonction de l'export
          let roomStatus = null;
          if (chambreInfo && typeof calculateRoomStatus === 'function') {
            roomStatus = calculateRoomStatus(chambreInfo);
          }
          
          // Sauvegarder les éléments author et meta existants
          const authorEl = contentEl.querySelector('.author');
          const iconsEl = contentEl.querySelector('.icons');
          const metaEl = contentEl.querySelector('.meta');

          // Créer le nouveau contenu avec labels visuels (version DOM sécurisée)
          const visualContent = createVisualTicketContentDOM(roomNumber, description, roomStatus, chambreInfo);

          // Vider le contenu existant et ajouter le nouveau contenu sécurisé
          contentEl.textContent = '';
          contentEl.appendChild(visualContent);

          // Rajouter les éléments author, icons et meta s'ils existaient
          if (authorEl) contentEl.appendChild(authorEl.cloneNode(true));
          if (iconsEl) contentEl.appendChild(iconsEl.cloneNode(true));
          if (metaEl) {
            contentEl.appendChild(document.createElement('br'));
            contentEl.appendChild(metaEl.cloneNode(true));
          }

          contentEl.dataset.enhanced = 'true';
          contentEl.dataset.roomNumber = roomNumber; // Sauvegarder pour le tri
          
          // Aussi sur la ligne parente (tr) pour le tri
          const parentRow = contentEl.closest('tr');
          if (parentRow) {
            parentRow.dataset.roomNumber = roomNumber;
          }
          
          ticketsAmeliores++;
        } else {
          // Ticket SANS numéro de chambre valide - nettoyer quand même
          // Sauvegarder les éléments author et meta existants
          const authorEl = contentEl.querySelector('.author');
          const iconsEl = contentEl.querySelector('.icons');
          const metaEl = contentEl.querySelector('.meta');
          
          // Créer le contenu nettoyé
          const visualContent = createVisualTicketContentWithoutRoom(originalText);
          
          // Vider le contenu existant et ajouter le nouveau contenu sécurisé
          contentEl.textContent = '';
          contentEl.appendChild(visualContent);
          
          // Rajouter les éléments author, icons et meta s'ils existaient
          if (authorEl) contentEl.appendChild(authorEl.cloneNode(true));
          if (iconsEl) contentEl.appendChild(iconsEl.cloneNode(true));
          if (metaEl) {
            contentEl.appendChild(document.createElement('br'));
            contentEl.appendChild(metaEl.cloneNode(true));
          }
          
          contentEl.dataset.enhanced = 'true';
          ticketsAmeliores++;
        }
      } catch (error) {
        // Ignorer les erreurs silencieusement
      }
    });
    
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur amélioration affichage:', error);
  }
}

/**
 * Créer le contenu visuel pour un ticket SANS numéro de chambre
 * Nettoie le texte et extrait le tag après //
 */
function createVisualTicketContentWithoutRoom(text) {
  const container = document.createElement('span');

  let cleanedDesc = text || '';
  let tagAfterSlash = null;
  
  // Extraire le contenu après "//" pour créer un label gris
  if (cleanedDesc.includes('//')) {
    const parts = cleanedDesc.split('//');
    cleanedDesc = parts[0].trim();
    tagAfterSlash = parts.slice(1).join('//').trim();
  }
  
  // Retirer les # isolés (non suivis de 3 chiffres = numéro de chambre)
  cleanedDesc = cleanedDesc.replace(/#(?!\d{3})/g, '').trim();
  
  // Nettoyer les espaces multiples
  cleanedDesc = cleanedDesc.replace(/\s+/g, ' ').trim();
  
  // Ajouter la description nettoyée
  if (cleanedDesc) {
    const descText = document.createTextNode(cleanedDesc);
    container.appendChild(descText);
  }
  
  // Ajouter le label gris pour le tag après "//" (si présent)
  if (tagAfterSlash) {
    const tagLabel = document.createElement('span');
    tagLabel.style.cssText = `
      background-color: #6c757d;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
      margin-left: 6px;
      display: inline-block;
    `;
    tagLabel.textContent = tagAfterSlash.toUpperCase();
    container.appendChild(tagLabel);
  }
  
  return container;
}

/**
 * Créer le contenu visuel d'un ticket avec de beaux labels (version DOM sécurisée)
 * Utilise la même logique que le PDF pour les statuts (EARLY/LATE, couleurs dynamiques)
 */
function createVisualTicketContentDOM(roomNumber, description, roomStatus, chambreInfo = null) {
  const container = document.createElement('span');

  // Label numéro de chambre - orange si PICKUP, sinon blanc/gris
  const isPickup = chambreInfo && chambreInfo.is_pickup;
  const roomLabel = document.createElement('span');
  roomLabel.className = 'label label-primary';
  
  if (isPickup) {
    roomLabel.style.cssText = `margin-right: 6px; font-size: 11px; padding: 3px 8px; background-color: #ff8c00; border-color: #ff8c00; color: white; border-radius: 3px;`;
  } else {
    roomLabel.style.cssText = `margin-right: 6px; font-size: 11px; padding: 3px 8px; background-color: #f0f0f0; border: 1px solid #ccc; color: #333; border-radius: 3px;`;
  }
  roomLabel.textContent = `#${roomNumber}`;
  container.appendChild(roomLabel);

  // Label statut - utiliser la logique avancée si chambreInfo disponible
  if (chambreInfo && chambreInfo.current_status !== undefined) {
    // Utiliser la logique avancée avec EARLY/LATE et couleurs dynamiques
    const statusInfo = getStatusInfoFromChambre(chambreInfo);
    
    const statusLabel = document.createElement('span');
    statusLabel.style.cssText = `
      background-color: ${statusInfo.color};
      color: ${statusInfo.textColor || 'white'};
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      margin-right: 6px;
      display: inline-block;
    `;
    statusLabel.textContent = statusInfo.text;
    container.appendChild(statusLabel);
  } else if (roomStatus) {
    // Fallback : logique simple basée sur roomStatus
    let backgroundColor = '#dc3545';
    let statusText = roomStatus.replace(/[()]/g, '');
    let displayText = statusText;

    if (statusText === 'o') displayText = 'recouche';
    if (statusText === 'bloquée' || statusText === 'ooo') displayText = 'out of order';
    if (statusText === 'oos') displayText = 'out of service';

    switch (statusText) {
      case 'bloquée': case 'ooo': case 'oos': backgroundColor = '#6c757d'; break;
      case 'inc': backgroundColor = '#ff8c00'; break;
      case 'day-use': backgroundColor = '#ffc107'; break;
      case 'in': case 'null': backgroundColor = '#dc3545'; break;
      case 'o': backgroundColor = '#007bff'; break;
      case 'out': case 'out/inc': case 'out/dispo': case 'dispo': backgroundColor = '#28a745'; break;
      default: backgroundColor = '#dc3545';
    }

    const statusLabel = document.createElement('span');
    statusLabel.style.cssText = `
      background-color: ${backgroundColor};
      color: ${statusText === 'day-use' ? '#333' : 'white'};
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      margin-right: 6px;
      display: inline-block;
    `;
    statusLabel.textContent = displayText.toUpperCase();
    container.appendChild(statusLabel);
  }

  // Nettoyer et traiter la description
  let cleanedDesc = description || '';
  let tagAfterSlash = null;
  
  // Extraire le contenu après "//" pour créer un label gris
  if (cleanedDesc.includes('//')) {
    const parts = cleanedDesc.split('//');
    cleanedDesc = parts[0].trim();
    tagAfterSlash = parts.slice(1).join('//').trim(); // Récupérer tout après le premier //
  }
  
  // Retirer les # isolés (non suivis de 3 chiffres = numéro de chambre)
  cleanedDesc = cleanedDesc.replace(/#(?!\d{3})/g, '').trim();
  
  // Nettoyer les espaces multiples
  cleanedDesc = cleanedDesc.replace(/\s+/g, ' ').trim();
  
  // Ajouter la description nettoyée
  if (cleanedDesc) {
    const descText = document.createTextNode(cleanedDesc);
  container.appendChild(descText);
  }
  
  // Ajouter le label gris pour le tag après "//" (si présent)
  if (tagAfterSlash) {
    const tagLabel = document.createElement('span');
    tagLabel.style.cssText = `
      background-color: #6c757d;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
      margin-left: 6px;
      display: inline-block;
    `;
    tagLabel.textContent = tagAfterSlash.toUpperCase();
    container.appendChild(tagLabel);
  }

  return container;
}

/**
 * Obtenir les infos de statut formatées pour le DOM (même logique que PDF)
 * Retourne { text, color, textColor }
 */
function getStatusInfoFromChambre(chambre) {
  if (!chambre) return { text: '', color: '#6c757d', textColor: 'white' };
  
  // Cas spéciaux prioritaires
  if (chambre.is_ooo) {
    return { text: 'OUT OF ORDER', color: '#6c757d', textColor: 'white' };
  }
  
  if (chambre.is_oos) {
    return { text: 'OUT OF SERVICE', color: '#6c757d', textColor: 'white' };
  }
  
  if (chambre.is_day_use) {
    return { text: 'DAY-USE', color: '#ffc107', textColor: '#333' };
  }
  
  const currentStatusRaw = chambre.current_status || '';
  const nextStatusRaw = chambre.next_status || '';
  const checkOutTime = chambre.check_out_time || null;
  const checkInTime = chambre.check_in_time || null;
  
  // Analyser avec détection EARLY/LATE
  const statuses = analyzeStayNTouchStatuses(currentStatusRaw, nextStatusRaw, checkOutTime, checkInTime);
  
  const morningStatus = statuses.morning;
  const afternoonStatus = statuses.afternoon;
  const isEarly = statuses.isEarly;
  const isLate = statuses.isLate;
  
  // Heure actuelle (matin = 02h-14h)
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 2 && currentHour < 14;
  
  // Construire le préfixe EARLY/LATE
  let prefix = '';
  if (isLate && morningStatus === 'IN') {
    prefix = 'LATE ';
  } else if (isEarly && (afternoonStatus === 'IN' || afternoonStatus === 'INC')) {
    prefix = 'EARLY ';
  }
  
  let displayText = '';
  let color = '#28a745'; // vert par défaut
  
  // Couleurs par statut
  const colorMap = {
    'RECOUCHE': '#007bff',
    'IN': '#dc3545',
    'INC': '#ff8c00',
    'OUT': '#28a745',
    'DISPO': '#28a745'
  };
  
  if (morningStatus === afternoonStatus) {
    displayText = prefix + morningStatus;
    color = colorMap[morningStatus] || '#28a745';
  } else {
    displayText = `${prefix}${morningStatus} / ${afternoonStatus}`;
    
    if (isMorning) {
      color = colorMap[morningStatus] || '#28a745';
      if (morningStatus !== 'IN' && afternoonStatus === 'INC') {
        color = '#ff8c00';
      }
    } else {
      color = colorMap[afternoonStatus] || '#28a745';
      if (afternoonStatus === 'INC') {
        color = '#ff8c00';
      }
    }
  }
  
  return { text: displayText, color: color, textColor: 'white' };
}

async function scrapeTickets() {
  try {
    const tableBody = document.querySelector('tbody');
    if (!tableBody) {
      throw new Error('Table des tickets non trouvée');
    }

    const rows = tableBody.querySelectorAll('tr');
    
    const tickets = [];
    
    rows.forEach((row, index) => {
      try {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          const numeroTicket = cells[0]?.textContent?.trim();
          const contenu = cells[1]?.textContent?.trim();
          const statut = cells[2]?.textContent?.trim();
          const dateCreation = cells[3]?.textContent?.trim();
          const dateRelative = cells[4]?.textContent?.trim();
          
          if (contenu && contenu.length > 3) {
            // Extraire le numéro de chambre depuis le contenu
            const match = contenu.match(/^#?(\d{3})/);
            const numeroChambre = match ? match[1] : null;
            
            tickets.push({
              numero_ticket: numeroTicket,
              contenu: contenu,
              numero_chambre: numeroChambre,
              statut: statut,
              date_creation: dateCreation,
              date_relative: dateRelative,
              priorite: 'MOYENNE' // Valeur par défaut
            });
          }
        }
      } catch (error) {
        console.error(`Erreur ligne ${index}:`, error);
      }
    });
    
    return {
      success: true,
      data: {
        tickets: tickets,
        total: tickets.length,
        timestamp: new Date().toISOString(),
        source: 'dmbook'
      }
    };
    
  } catch (error) {
    console.error('Erreur scraping:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Checklists persistantes : state coché en storage.local, statuts chambres lus en live à chaque render.

const DATA_LISTS_STORAGE_KEY = 'hotel_manager_data_lists';

// Sérialise toutes les mutations pour éviter qu'un clic rapide ne clobber la précédente écriture (read-modify-write race).
let dataListsWriteQueue = Promise.resolve();
function enqueueDataListsMutation(mutate) {
  const next = dataListsWriteQueue.then(async () => {
    const lists = await getDataLists();
    const result = await mutate(lists);
    await saveDataLists(lists);
    return result;
  });
  dataListsWriteQueue = next.catch(() => {});
  return next;
}

async function getDataLists() {
  const result = await browser.storage.local.get([DATA_LISTS_STORAGE_KEY]);
  return Array.isArray(result[DATA_LISTS_STORAGE_KEY]) ? result[DATA_LISTS_STORAGE_KEY] : [];
}

async function saveDataLists(lists) {
  await browser.storage.local.set({ [DATA_LISTS_STORAGE_KEY]: lists });
}

// Empêche les noms multi-ligne qui pourraient spoofer un window.confirm (ex: '\n\nCliquez OK pour autre chose').
function sanitizeListName(name) {
  return String(name).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100);
}

function createDataList(name) {
  const clean = sanitizeListName(name);
  return enqueueDataListsMutation((lists) => {
    const now = new Date().toISOString();
    const newList = {
      id: `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: clean,
      createdAt: now,
      updatedAt: now,
      checkedRooms: []
    };
    lists.push(newList);
    return newList;
  });
}

function renameDataListById(id, newName) {
  const clean = sanitizeListName(newName);
  return enqueueDataListsMutation((lists) => {
    const list = lists.find(l => l.id === id);
    if (!list) return null;
    list.name = clean;
    list.updatedAt = new Date().toISOString();
    return list;
  });
}

function deleteDataListById(id) {
  return enqueueDataListsMutation((lists) => {
    const idx = lists.findIndex(l => l.id === id);
    if (idx !== -1) lists.splice(idx, 1);
  });
}

function toggleRoomInDataList(listId, roomNumber) {
  return enqueueDataListsMutation((lists) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return null;
    const roomStr = String(roomNumber);
    const idx = list.checkedRooms.indexOf(roomStr);
    if (idx === -1) list.checkedRooms.push(roomStr);
    else list.checkedRooms.splice(idx, 1);
    list.updatedAt = new Date().toISOString();
    return list;
  });
}

function setRoomsCheckedInDataList(listId, roomNumbers, shouldCheck) {
  return enqueueDataListsMutation((lists) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return null;
    const set = new Set(list.checkedRooms.map(String));
    roomNumbers.forEach(r => {
      const s = String(r);
      if (shouldCheck) set.add(s);
      else set.delete(s);
    });
    list.checkedRooms = Array.from(set);
    list.updatedAt = new Date().toISOString();
    return list;
  });
}

function getTotalRoomsCount() {
  const levels = [100, 200, 300, 400, 500, 600];
  return levels.reduce((sum, lvl) => sum + (ROOMS_BY_LEVEL[lvl]?.length || 0), 0);
}

async function handleDataListsExport(button) {
  const originalBackground = button.style.background;

  button.style.pointerEvents = 'none';
  button.style.opacity = '0.6';

  try {
    await openDataListsManager();
    button.style.background = '#28a745';
    setTimeout(() => { button.style.background = originalBackground; }, 2000);
  } catch (error) {
    console.error('❌ [DMBOOK] Erreur listes de données:', error);
    button.style.background = '#dc3545';
    setTimeout(() => { button.style.background = originalBackground; }, 2000);
  }

  setTimeout(() => {
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
  }, 3000);
}

async function openDataListsManager() {
  while (true) {
    const action = await showListsManagerModal();
    if (!action || action.type === 'close') return;
    if (action.type === 'open') {
      await openDataListEditor(action.id);
    }
  }
}

function showListsManagerModal() {
  return new Promise((resolve) => {
    const existing = document.getElementById('hotel-manager-data-modal');
    if (existing) {
      if (existing._cleanup) existing._cleanup({ type: 'close' });
      else { console.warn('[DMBOOK] Overlay sans _cleanup détecté, remove direct'); existing.remove(); }
    }

    const overlay = document.createElement('div');
    overlay.id = 'hotel-manager-data-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      padding: 20px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      width: 640px;
      max-width: 95vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;';

    const titleEl = document.createElement('h3');
    titleEl.textContent = 'Mes listes de données';
    titleEl.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #333;';
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Fermer';
    closeBtn.style.cssText = 'padding: 2px 10px; border: none; background: transparent; color: #666; cursor: pointer; font-size: 20px; line-height: 1;';
    header.appendChild(closeBtn);

    card.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'flex: 1; overflow-y: auto; margin-bottom: 14px;';
    card.appendChild(body);

    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; justify-content: flex-end;';
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.textContent = '+ Nouvelle liste';
    createBtn.style.cssText = 'padding: 8px 16px; border: none; background: #198754; color: white; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;';
    footer.appendChild(createBtn);
    card.appendChild(footer);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let resolved = false;
    const cleanup = (value) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(value || { type: 'close' });
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup({ type: 'close' }); }
    };

    overlay._cleanup = cleanup;
    closeBtn.addEventListener('click', () => cleanup({ type: 'close' }));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup({ type: 'close' }); });
    document.addEventListener('keydown', onKey);

    const totalRooms = getTotalRoomsCount();

    const renderBody = async () => {
      while (body.firstChild) body.removeChild(body.firstChild);
      const lists = await getDataLists();

      if (lists.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Aucune liste. Cliquez sur "+ Nouvelle liste" pour en créer une.';
        empty.style.cssText = 'color: #888; font-size: 14px; text-align: center; padding: 30px 10px; margin: 0;';
        body.appendChild(empty);
        return;
      }

      lists.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      const table = document.createElement('table');
      table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px;';

      lists.forEach((list) => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid #eee;';

        const tdName = document.createElement('td');
        tdName.style.cssText = 'padding: 10px 8px; vertical-align: middle;';
        const nameSpan = document.createElement('div');
        nameSpan.textContent = list.name;
        nameSpan.style.cssText = 'font-weight: 600; color: #333;';
        tdName.appendChild(nameSpan);
        const dateSpan = document.createElement('div');
        try {
          const d = new Date(list.updatedAt);
          dateSpan.textContent = 'Modifiée le ' + d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } catch (_) {
          dateSpan.textContent = '';
        }
        dateSpan.style.cssText = 'font-size: 11px; color: #999; margin-top: 2px;';
        tdName.appendChild(dateSpan);
        tr.appendChild(tdName);

        const tdProgress = document.createElement('td');
        tdProgress.style.cssText = 'padding: 10px 8px; vertical-align: middle; width: 90px; text-align: center; color: #555; font-variant-numeric: tabular-nums;';
        tdProgress.textContent = `${list.checkedRooms.length} / ${totalRooms}`;
        tr.appendChild(tdProgress);

        const tdActions = document.createElement('td');
        tdActions.style.cssText = 'padding: 10px 8px; vertical-align: middle; width: 260px; text-align: right; white-space: nowrap;';

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.textContent = 'Ouvrir';
        openBtn.style.cssText = 'padding: 6px 12px; border: none; background: #198754; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; margin-right: 4px;';
        openBtn.addEventListener('click', () => cleanup({ type: 'open', id: list.id }));
        tdActions.appendChild(openBtn);

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.textContent = 'Renommer';
        renameBtn.style.cssText = 'padding: 6px 10px; border: 1px solid #ccc; background: white; color: #333; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;';
        renameBtn.addEventListener('click', async () => {
          const newName = await promptDataListName({ currentName: list.name, title: 'Renommer la liste' });
          if (newName && newName !== list.name) {
            await renameDataListById(list.id, newName);
            await renderBody();
          }
        });
        tdActions.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.style.cssText = 'padding: 6px 10px; border: 1px solid #dc3545; background: white; color: #dc3545; border-radius: 4px; cursor: pointer; font-size: 12px;';
        deleteBtn.addEventListener('click', async () => {
          if (window.confirm(`Supprimer la liste "${list.name}" ? Cette action est définitive.`)) {
            await deleteDataListById(list.id);
            await renderBody();
          }
        });
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdActions);
        table.appendChild(tr);
      });

      body.appendChild(table);
    };

    createBtn.addEventListener('click', async () => {
      const name = await promptDataListName({ currentName: '', title: 'Nouvelle liste' });
      if (name) {
        const newList = await createDataList(name);
        cleanup({ type: 'open', id: newList.id });
      }
    });

    renderBody().catch((err) => console.error('❌ [DMBOOK] renderBody erreur:', err));
  });
}

function openDataListEditor(listId) {
  return new Promise(async (resolve) => {
    const existing = document.getElementById('hotel-manager-data-modal');
    if (existing) {
      if (existing._cleanup) existing._cleanup({ type: 'close' });
      else { console.warn('[DMBOOK] Overlay sans _cleanup détecté, remove direct'); existing.remove(); }
    }

    const lists = await getDataLists();
    const list = lists.find(l => l.id === listId);
    if (!list) { resolve(); return; }

    const chambresData = await browser.storage.local.get(['chambres_data']);
    const chambres = chambresData.chambres_data?.chambres || [];
    const chambresByNumero = new Map();
    chambres.forEach(c => { if (c.numero != null) chambresByNumero.set(String(c.numero).trim(), c); });

    const overlay = document.createElement('div');
    overlay.id = 'hotel-manager-data-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      width: 1100px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eee;';

    const leftGroup = document.createElement('div');
    leftGroup.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '←';
    backBtn.title = 'Retour aux listes';
    backBtn.style.cssText = 'padding: 4px 12px; border: 1px solid #ccc; background: white; color: #333; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600;';
    leftGroup.appendChild(backBtn);

    const titleEl = document.createElement('h3');
    titleEl.textContent = list.name;
    titleEl.style.cssText = 'margin: 0; font-size: 17px; font-weight: 600; color: #333;';
    leftGroup.appendChild(titleEl);

    header.appendChild(leftGroup);

    const rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const progressEl = document.createElement('span');
    progressEl.style.cssText = 'font-size: 13px; color: #555; font-variant-numeric: tabular-nums;';
    rightGroup.appendChild(progressEl);

    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = 'Générer PDF';
    pdfBtn.style.cssText = 'padding: 6px 14px; border: none; background: #198754; color: white; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;';
    rightGroup.appendChild(pdfBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Fermer';
    closeBtn.style.cssText = 'padding: 2px 10px; border: none; background: transparent; color: #666; cursor: pointer; font-size: 20px; line-height: 1;';
    rightGroup.appendChild(closeBtn);

    header.appendChild(rightGroup);
    card.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(6, 1fr); gap: 0 12px;';
    card.appendChild(body);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    };
    overlay._cleanup = cleanup;

    const checkedSet = new Set(list.checkedRooms.map(String));
    const totalRoomsCount = getTotalRoomsCount();

    const refreshProgress = () => {
      progressEl.textContent = `${checkedSet.size} / ${totalRoomsCount} cochées`;
    };
    refreshProgress();

    const levels = [100, 200, 300, 400, 500, 600];
    levels.forEach((level) => {
      const roomsForLevel = ROOMS_BY_LEVEL[level] || [];
      if (roomsForLevel.length === 0) return;

      const col = document.createElement('div');
      col.style.cssText = 'display: flex; flex-direction: column;';

      const levelHeader = document.createElement('div');
      levelHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 4px; border-bottom: 1px solid #ddd; margin-bottom: 4px;';

      const levelTitle = document.createElement('span');
      levelTitle.textContent = `Étage ${String(level).charAt(0)}`;
      levelTitle.style.cssText = 'font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px;';
      levelHeader.appendChild(levelTitle);

      const floorToggleBtn = document.createElement('button');
      floorToggleBtn.type = 'button';
      floorToggleBtn.title = 'Cocher ou décocher tout l\'étage';
      floorToggleBtn.style.cssText = 'padding: 1px 6px; border: 1px solid #ccc; background: white; color: #555; border-radius: 3px; cursor: pointer; font-size: 10px; line-height: 1.3; white-space: nowrap;';
      levelHeader.appendChild(floorToggleBtn);

      col.appendChild(levelHeader);

      const roomRefs = [];
      const refreshFloorToggleBtn = () => {
        const allChecked = roomRefs.length > 0 && roomRefs.every(r => r.cb.checked);
        floorToggleBtn.textContent = allChecked ? 'Tout décocher' : 'Tout cocher';
      };

      roomsForLevel.forEach((roomNum) => {
        const roomStr = String(roomNum);
        const info = chambresByNumero.get(roomStr) || null;
        const isChecked = checkedSet.has(roomStr);

        // Mirror du layout PDF : col-check / col-chambre / col-statut.
        const row = document.createElement('label');
        row.style.cssText = 'display: grid; grid-template-columns: 22px 50px 1fr; column-gap: 6px; align-items: center; padding: 3px 2px; border-radius: 3px; cursor: pointer;';
        row.addEventListener('mouseenter', () => { row.style.background = '#f5f5f5'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isChecked;
        cb.style.cssText = 'margin: 0; cursor: pointer; accent-color: #198754; width: 14px; height: 14px; justify-self: center;';
        row.appendChild(cb);

        const numSpan = document.createElement('span');
        numSpan.textContent = roomStr;
        const numStyle = info && info.is_pickup
          ? 'background: #ff8c00; color: white; border: 1px solid #ff8c00;'
          : 'background: #f0f0f0; color: #333; border: 1px solid #ccc;';
        numSpan.style.cssText = `
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          justify-self: center;
          min-width: 38px;
          box-sizing: border-box;
          ${numStyle}
        `;
        row.appendChild(numSpan);

        let statusEl = buildStatusBadgeElement(info);
        if (!statusEl) {
          statusEl = document.createElement('span');
          statusEl.textContent = '—';
          statusEl.style.cssText = 'color: #ccc; font-size: 11px; text-align: center; display: block;';
        }
        row.appendChild(statusEl);

        // Transparence seule (pref utilisateur, pas de barré).
        const applyVisualState = () => {
          if (cb.checked) {
            numSpan.style.opacity = '0.45';
            statusEl.style.opacity = '0.55';
          } else {
            numSpan.style.opacity = '1';
            statusEl.style.opacity = '1';
          }
        };
        applyVisualState();

        cb.addEventListener('change', async () => {
          cb.disabled = true;
          try {
            const updated = await toggleRoomInDataList(list.id, roomStr);
            if (updated) {
              if (cb.checked) checkedSet.add(roomStr);
              else checkedSet.delete(roomStr);
              applyVisualState();
              refreshProgress();
              refreshFloorToggleBtn();
            }
          } catch (err) {
            console.error('❌ [DMBOOK] toggle room erreur:', err);
            cb.checked = !cb.checked;
          }
          cb.disabled = false;
        });

        roomRefs.push({ cb, roomStr, applyVisualState });

        col.appendChild(row);
      });

      refreshFloorToggleBtn();

      floorToggleBtn.addEventListener('click', async () => {
        floorToggleBtn.disabled = true;
        const allChecked = roomRefs.every(r => r.cb.checked);
        const shouldCheck = !allChecked;
        try {
          await setRoomsCheckedInDataList(list.id, roomRefs.map(r => r.roomStr), shouldCheck);
          roomRefs.forEach(r => {
            r.cb.checked = shouldCheck;
            if (shouldCheck) checkedSet.add(r.roomStr);
            else checkedSet.delete(r.roomStr);
            r.applyVisualState();
          });
          refreshProgress();
          refreshFloorToggleBtn();
        } catch (err) {
          console.error('❌ [DMBOOK] toggle étage erreur:', err);
        }
        floorToggleBtn.disabled = false;
      });

      body.appendChild(col);
    });

    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      try {
        const snapshot = { ...list, checkedRooms: Array.from(checkedSet) };
        const htmlContent = formatDataListToHTML(snapshot, chambres);
        openPrintWindow(htmlContent, snapshot.name);
      } catch (err) {
        console.error('❌ [DMBOOK] Export PDF liste de données erreur:', err);
      }
      pdfBtn.disabled = false;
    });

    backBtn.addEventListener('click', () => cleanup());
    closeBtn.addEventListener('click', () => cleanup());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    document.addEventListener('keydown', onKey);
  });
}

function promptDataListName(options = {}) {
  const { currentName = '', title = 'Nom de la liste' } = options;
  return promptTextInput({
    id: 'hotel-manager-name-prompt',
    title,
    placeholder: 'Ex: Ménage étage 2',
    currentValue: currentName,
    okLabel: 'Valider',
    okBgColor: '#198754',
    zIndex: 1000001
  });
}

function formatDataListToHTML(list, chambres) {
  const now = new Date();
  const today = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  const chambresByNumero = new Map();
  chambres.forEach(c => {
    if (c.numero != null) chambresByNumero.set(String(c.numero).trim(), c);
  });

  const checkedSet = new Set((list.checkedRooms || []).map(String));
  const levels = [100, 200, 300, 400, 500, 600];
  let grid = '';

  for (const level of levels) {
    const roomsForLevel = ROOMS_BY_LEVEL[level] || [];
    if (roomsForLevel.length === 0) continue;

    grid += `<div class="floor-section"><table><tbody>`;
    roomsForLevel.forEach((roomNum, index) => {
      const numeroStr = String(roomNum);
      const info = chambresByNumero.get(numeroStr) || null;
      const roomLabelClass = info && info.is_pickup ? 'room-label pickup' : 'room-label';
      const statusBadge = info ? getStatusBadgeFromChambre(info) : '';
      const isChecked = checkedSet.has(numeroStr);
      const classes = [];
      if (index === roomsForLevel.length - 1) classes.push('floor-last');
      if (isChecked) classes.push('row-checked');
      grid += `
        <tr class="${classes.join(' ')}">
          <td class="col-check"><span class="checkbox"></span></td>
          <td class="col-chambre"><span class="${roomLabelClass}">${numeroStr}</span></td>
          <td class="col-statut">${statusBadge}</td>
        </tr>
      `;
    });
    grid += `</tbody></table></div>`;
  }

  const totalRooms = getTotalRoomsCount();
  const doneCount = checkedSet.size;
  return `
    <div class="header">
      <div class="date">${today}</div>
      <h1>${escapeHTML(list.name)}</h1>
      <span class="total">${doneCount} / ${totalRooms} cochées</span>
    </div>
    <div class="floors-grid">${grid}</div>
  `;
}