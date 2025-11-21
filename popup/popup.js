// Popup script - Gestion de l'interface utilisateur
// Workflow: Tickets → Chambres (multi-pages) → Consolidation → Export
// 100% LOCAL - Pas d'API externe

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🏨 Popup Hotel Manager chargé (100% LOCAL)');
  console.log('📂 Chargement des données persistantes...');
  
  // Charger les données existantes (PERSISTENT STORAGE)
  await loadExistingData();
  
  console.log('✅ Données restaurées');
  
  // Configurer les event listeners
  setupEventListeners();
  
  // Vérifier l'URL actuelle pour activer/désactiver les boutons
  await checkCurrentSite();
});

// Configurer les event listeners
function setupEventListeners() {
  // Scraping (ordre inversé : tickets d'abord)
  document.getElementById('scrape-tickets-btn').addEventListener('click', scrapeTickets);
  document.getElementById('scrape-rooms-btn').addEventListener('click', scrapeRooms);
  
  // Toggle aperçu tickets
  document.getElementById('toggle-preview-btn').addEventListener('click', toggleTicketsPreview);
  
  // Actions
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('refresh-btn').addEventListener('click', refresh);
}

// Scraper les chambres (StayNTouch) - MODE CUMULATIF (géré dans le popup)
async function scrapeRooms() {
  showLoading('Scraping de cette page en cours...');
  
  try {
    // Obtenir l'onglet actif
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    // Vérifier qu'on est sur la bonne page
    if (!activeTab.url.includes('stayntouch.com')) {
      throw new Error('Veuillez naviguer vers la page StayNTouch PMS');
    }
    
    // Envoyer un message au content script pour scraper CETTE PAGE
    const response = await browser.tabs.sendMessage(activeTab.id, { 
      action: 'scrapeRooms' 
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur de scraping');
    }
    
    console.log(`${response.data.count} nouvelles chambres extraites de cette page`);
    
    // CUMUL ICI (dans le popup, pas dans le content script)
    const result = await browser.storage.local.get(['chambres_data']);
    const existingChambres = result.chambres_data?.chambres || [];
    
    console.log(`Chambres existantes dans le storage: ${existingChambres.length}`);
    
    // Fusionner sans doublons
    const allChambres = [...existingChambres];
    const existingNumbers = new Set(existingChambres.map(c => c.numero));
    
    let newCount = 0;
    response.data.chambres.forEach(chambre => {
      if (!existingNumbers.has(chambre.numero)) {
        allChambres.push(chambre);
        newCount++;
      }
    });
    
    console.log(`Total après fusion: ${allChambres.length} chambres (${newCount} nouvelles)`);
    
    // Vérifier contre la liste hardcodée
    const scrapedNumbers = allChambres.map(c => parseInt(c.numero));
    const missing = ROOMS_LIST.filter(room => !scrapedNumbers.includes(room));
    const complete = missing.length === 0;
    const percentage = Math.round((allChambres.length / TOTAL_ROOMS) * 100);
    
    // Sauvegarder les données cumulées
    const cumulativeData = {
      chambres: allChambres,
      timestamp: new Date().toISOString(),
      source: 'stayntouch',
      total: allChambres.length,
      new_count: newCount,
      missing: missing,
      complete: complete,
      percentage: percentage
    };
    
    await browser.storage.local.set({
      chambres_data: cumulativeData,
      last_update_rooms: new Date().toISOString()
    });
    
    console.log('✅ Données sauvegardées:', cumulativeData.total, 'chambres');
    
    // Afficher le résultat
    // Mettre à jour l'affichage
    await loadExistingData();
    
    // Si complet (80/80) ET tickets disponibles → Consolider automatiquement
    if (complete) {
      const ticketsResult = await browser.storage.local.get(['tickets_data']);
      if (ticketsResult.tickets_data) {
        console.log('🎯 80/80 chambres + tickets disponibles → Consolidation automatique');
        // Petit délai pour que l'utilisateur voie la progression à 100%
        setTimeout(() => {
          consolidateData();
        }, 1000);
      }
    }
    
  } catch (error) {
    console.error('Erreur scraping chambres:', error);
    showStatusMessage('rooms-status', 'error', '❌ ' + error.message);
  } finally {
    hideLoading();
  }
}

// Scraper les tickets (Dmbook) - ÉTAPE 1
async function scrapeTickets() {
  showLoading('Scraping et formatage des tickets...');
  
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (!activeTab.url.includes('dmbook.pro')) {
      throw new Error('Veuillez naviguer vers la page Dmbook Pro');
    }
    
    // Scraper les tickets
    const response = await browser.tabs.sendMessage(activeTab.id, { 
      action: 'scrapeTickets' 
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur de scraping');
    }
    
    console.log('Tickets bruts récupérés:', response.data.tickets.length);
    
    // Sauvegarder les tickets bruts
    await browser.storage.local.set({
      tickets_data: response.data,
      last_update_tickets: new Date().toISOString()
    });
    
    // Formater les tickets LOCALEMENT (pas d'API)
    const formatResponse = await browser.runtime.sendMessage({
      action: 'formatTickets',
      data: response.data
    });
    
    if (formatResponse.success) {
      console.log('Formatage réussi');
      console.log('Aperçu:', formatResponse.data.formatted_text.substring(0, 200));
      
      // Sauvegarder le texte formaté
      await browser.storage.local.set({
        tickets_formatted: formatResponse.data.formatted_text,
        tickets_formatted_data: formatResponse.data
      });
      
      // Préparer l'aperçu (masqué par défaut)
      showTicketsPreview(formatResponse.data.formatted_text);
      
      // Mettre à jour l'affichage
      await loadExistingData();
    } else {
      throw new Error(formatResponse.error || 'Erreur de formatage');
    }
  } catch (error) {
    console.error('Erreur scraping/formatage tickets:', error);
    showError('Erreur: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Consolider les données finales (Chambres + Tickets + Statuts)
async function consolidateData() {
  showLoading('Consolidation finale avec calcul des statuts...');
  
  try {
    // Récupérer les données
    const result = await browser.storage.local.get([
      'chambres_data', 
      'tickets_data', 
      'tickets_formatted'
    ]);
    
    if (!result.chambres_data || !result.tickets_data) {
      throw new Error('Données incomplètes. Scrapez les tickets et les chambres (80/80).');
    }
    
    // Consolider LOCALEMENT (pas d'API)
    const response = await browser.runtime.sendMessage({
      action: 'consolidateData'
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur de consolidation');
    }
    
    // Calculer les statuts automatiques pour chaque chambre
    const chambresWithStatus = response.data.chambres.map(chambre => {
      const autoStatus = calculateRoomStatus(chambre);
      const details = calculateDetailedStatus(chambre);
      
      return {
        ...chambre,
        statut_auto: autoStatus,
        statut_details: details
      };
    });
    
    // Enrichir le texte formaté des tickets avec les statuts auto
    let enrichedTicketsText = result.tickets_formatted || '';
    
    // Créer un map des statuts par numéro de chambre
    const statusMap = {};
    chambresWithStatus.forEach(chambre => {
      statusMap[chambre.numero] = chambre.statut_auto || '';
    });
    
    // Ajouter les statuts à la fin de chaque ligne de ticket
    // Format: #213 Description du ticket (out)
    enrichedTicketsText = enrichedTicketsText.replace(
      /#(\d{3})\s+(.+?)(\n|$)/g,
      (match, roomNum, description, newline) => {
        const status = statusMap[roomNum] || '';
        if (status) {
          return `#${roomNum} ${description.trim()} ${status}${newline}`;
        }
        return match;
      }
    );
    
    // Sauvegarder les données consolidées
    const finalData = {
      ...response.data,
      chambres: chambresWithStatus
    };
    
    await browser.storage.local.set({
      consolidated_data: finalData,
      tickets_enriched: enrichedTicketsText,
      last_update: new Date().toISOString()
    });
    
    // Afficher l'aperçu enrichi
    showTicketsPreview(enrichedTicketsText);
    
    await loadExistingData();
    showSuccess('Consolidation réussie ! Vous pouvez exporter.');
    
    // Le bouton export sera activé par loadExistingData() automatiquement
    
  } catch (error) {
    console.error('Erreur consolidation:', error);
    showError('Erreur de consolidation: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Charger les données existantes
async function loadExistingData() {
  try {
    const result = await browser.storage.local.get([
      'consolidated_data',
      'chambres_data',
      'tickets_data',
      'tickets_formatted',
      'last_update'
    ]);
    
    console.log('=== CHARGEMENT DES DONNÉES PERSISTANTES ===');
    console.log('Chambres:', result.chambres_data?.total || 0);
    console.log('Tickets:', result.tickets_data?.tickets.length || 0);
    console.log('Formaté:', result.tickets_formatted ? 'Oui' : 'Non');
    console.log('Consolidé:', result.consolidated_data ? 'Oui' : 'Non');
    
    // ÉTAPE 1 : Tickets
    const ticketsCount = result.tickets_data?.tickets.length || 0;
    document.getElementById('total-tickets').textContent = ticketsCount;
    
    const ticketsBtn = document.getElementById('scrape-tickets-btn');
    if (result.tickets_data) {
      // Tickets scrapés → Bouton vert
      ticketsBtn.classList.remove('btn-primary', 'btn-warning');
      ticketsBtn.classList.add('btn-success');
      ticketsBtn.style.backgroundColor = '#34a853';
      ticketsBtn.style.color = 'white';
      console.log('✅ Bouton Tickets → VERT');
      
      // Préparer l'aperçu (mais MASQUÉ par défaut)
      if (result.tickets_formatted) {
        showTicketsPreview(result.tickets_formatted);
      }
    } else {
      // Pas encore scrapé → Bouton bleu
      ticketsBtn.classList.remove('btn-success', 'btn-warning');
      ticketsBtn.classList.add('btn-primary');
      ticketsBtn.style.backgroundColor = '';
      ticketsBtn.style.color = '';
      console.log('🔵 Bouton Tickets → BLEU');
    }
    
    // ÉTAPE 2 : Chambres
    const chambresCount = result.chambres_data?.total || 0;
    document.getElementById('total-rooms').textContent = `${chambresCount}/80`;
    
    const roomsBtn = document.getElementById('scrape-rooms-btn');
    if (result.chambres_data) {
      const complete = result.chambres_data.complete || false;
      
      if (complete) {
        // 80/80 → Bouton vert
        roomsBtn.classList.remove('btn-primary', 'btn-warning');
        roomsBtn.classList.add('btn-success');
        roomsBtn.style.backgroundColor = '#34a853';
        roomsBtn.style.color = 'white';
        console.log('✅ Bouton Chambres → VERT (80/80)');
      } else {
        // En cours (50/80) → Bouton orange
        roomsBtn.classList.remove('btn-primary', 'btn-success');
        roomsBtn.classList.add('btn-warning');
        roomsBtn.style.backgroundColor = '#fbbc04';
        roomsBtn.style.color = '#333';
        console.log('🟠 Bouton Chambres → ORANGE (' + chambresCount + '/80)');
      }
    } else {
      // Pas encore scrapé → Bouton bleu
      roomsBtn.classList.remove('btn-success', 'btn-warning');
      roomsBtn.classList.add('btn-primary');
      roomsBtn.style.backgroundColor = '';
      roomsBtn.style.color = '';
      console.log('🔵 Bouton Chambres → BLEU (0/80)');
    }
    
    // ÉTAPE 3 : Export
    // Activer SEULEMENT si données consolidées ET tickets ET 80 chambres
    const hasTickets = result.tickets_data !== undefined;
    const hasAllRooms = result.chambres_data?.complete === true;
    const isConsolidated = result.consolidated_data !== undefined;
    
    if (isConsolidated && hasTickets && hasAllRooms) {
      document.getElementById('consolidation-status').textContent = '✅ OK';
      document.getElementById('export-csv-btn').disabled = false;
    } else {
      document.getElementById('export-csv-btn').disabled = true;
      
      if (hasTickets && hasAllRooms) {
        document.getElementById('consolidation-status').textContent = '⏳ ...';
      } else if (hasTickets || hasAllRooms) {
        document.getElementById('consolidation-status').textContent = '...';
      } else {
        document.getElementById('consolidation-status').textContent = '-';
      }
    }
    
  } catch (error) {
    console.error('Erreur chargement données:', error);
  }
}

// Remplir le tableau avec statuts automatiques
function fillTable(data) {
  const tbody = document.getElementById('rooms-table-body');
  tbody.innerHTML = '';
  
  if (!data || !data.chambres) return;
  
  data.chambres.forEach(chambre => {
    const row = tbody.insertRow();
    
    // Numéro
    row.insertCell().textContent = chambre.numero || chambre.id;
    
    // Statut propreté
    const statusCell = row.insertCell();
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge badge-${chambre.statut_proprete === 'CLEAN' ? 'clean' : 'dirty'}`;
    statusBadge.textContent = chambre.statut_proprete || 'N/A';
    statusCell.appendChild(statusBadge);
    
    // Type
    row.insertCell().textContent = chambre.type || 'N/A';
    
    // Statut automatique (NOUVEAU)
    const autoStatusCell = row.insertCell();
    if (chambre.statut_auto) {
      const autoStatus = document.createElement('span');
      autoStatus.className = 'badge badge-status';
      autoStatus.textContent = chambre.statut_auto;
      autoStatus.title = chambre.statut_details?.description || '';
      autoStatusCell.appendChild(autoStatus);
    } else {
      autoStatusCell.textContent = '-';
    }
    
    // Réservation (texte)
    const reservCell = row.insertCell();
    if (chambre.statut_reservation) {
      reservCell.textContent = chambre.statut_reservation;
      reservCell.style.fontSize = '11px';
    } else {
      reservCell.textContent = 'N/A';
    }
    
    // Tickets
    const ticketsCell = row.insertCell();
    if (chambre.tickets && chambre.tickets.length > 0) {
      ticketsCell.textContent = `${chambre.tickets.length}`;
      ticketsCell.title = chambre.tickets.map(t => t.contenu || t.content).join('\n');
      ticketsCell.style.fontWeight = 'bold';
      ticketsCell.style.color = '#c5221f';
    } else {
      ticketsCell.textContent = '0';
      ticketsCell.style.color = '#999';
    }
  });
}

// Toggle affichage tableau
function toggleTable() {
  const tableSection = document.getElementById('table-section');
  const btn = document.getElementById('view-table-btn');
  
  if (tableSection.classList.contains('hidden')) {
    tableSection.classList.remove('hidden');
    btn.textContent = 'Masquer le tableau';
    loadExistingData(); // Rafraîchir le tableau
  } else {
    tableSection.classList.add('hidden');
    btn.textContent = 'Voir le tableau';
  }
}

// Exporter en CSV avec statuts automatiques
async function exportCSV() {
  try {
    const result = await browser.storage.local.get([
      'consolidated_data', 
      'chambres_data',
      'tickets_enriched', 
      'tickets_formatted'
    ]);
    
    // Utiliser consolidated_data si disponible, sinon chambres_data brutes
    const data = result.consolidated_data || result.chambres_data;
    const ticketsText = result.tickets_enriched || result.tickets_formatted;
    
    if (!data || !data.chambres) {
      throw new Error('Aucune donnée de chambres à exporter.');
    }
    
    console.log('Export de', data.chambres.length, 'chambres');
    
    // Créer le CSV avec la nouvelle colonne Statut_Auto
    let csv = 'Chambre,Statut_Proprete,Type,Statut_Auto,Reservation,Tickets,Priorite\n';
    
    data.chambres.forEach(chambre => {
      const tickets = chambre.tickets ? chambre.tickets.length : 0;
      const priority = chambre.statut_details?.priority || chambre.priority || 'BASSE';
      const reservation = chambre.statut_reservation || 'N/A';
      const statutAuto = chambre.statut_auto || '';
      
      csv += `"${chambre.numero}","${chambre.statut_proprete}","${chambre.type}","${statutAuto}","${reservation}",${tickets},"${priority}"\n`;
    });
    
    // Télécharger le CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hotel-chambres-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Télécharger les tickets formatés ENRICHIS avec statuts
    if (ticketsText) {
      const ticketsBlob = new Blob([ticketsText], { type: 'text/plain;charset=utf-8;' });
      const ticketsUrl = URL.createObjectURL(ticketsBlob);
      const ticketsLink = document.createElement('a');
      ticketsLink.href = ticketsUrl;
      ticketsLink.download = `hotel-tickets-${new Date().toISOString().split('T')[0]}.txt`;
      ticketsLink.click();
      URL.revokeObjectURL(ticketsUrl);
    }
    
    showSuccess('Export réussi ! CSV des chambres + TXT des tickets (avec statuts) téléchargés.');
  } catch (error) {
    showError('Erreur export: ' + error.message);
  }
}

// Rafraîchir tout
async function refresh() {
  if (!confirm('Voulez-vous vraiment réinitialiser toutes les données ?')) {
    return;
  }
  
  try {
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
    
    // Réinitialiser l'interface
    document.getElementById('tickets-preview').classList.add('hidden');
    
    document.getElementById('export-csv-btn').disabled = true;
    document.getElementById('toggle-preview-btn').classList.add('hidden');
    
    // Réinitialiser les couleurs des boutons
    const ticketsBtn = document.getElementById('scrape-tickets-btn');
    const roomsBtn = document.getElementById('scrape-rooms-btn');
    ticketsBtn.className = 'btn btn-primary';
    ticketsBtn.style.backgroundColor = '';
    ticketsBtn.style.color = '';
    roomsBtn.className = 'btn btn-primary';
    roomsBtn.style.backgroundColor = '';
    roomsBtn.style.color = '';
    
    document.getElementById('total-rooms').textContent = '0/80';
    document.getElementById('total-tickets').textContent = '0';
    document.getElementById('consolidation-status').textContent = 'En attente';
    
    showSuccess('✅ Données effacées.');
  } catch (error) {
    showError('Erreur refresh: ' + error.message);
  }
}

// Afficher message de statut
function showStatusMessage(elementId, type, message) {
  const element = document.getElementById(elementId);
  element.className = `status-message ${type}`;
  element.textContent = message;
}

// Afficher erreur
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}

// Afficher succès
function showSuccess(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.style.backgroundColor = '#e6f4ea';
  errorDiv.style.color = '#137333';
  errorDiv.style.borderColor = '#c6e1c6';
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => {
    errorDiv.classList.add('hidden');
    errorDiv.style.backgroundColor = '';
    errorDiv.style.color = '';
    errorDiv.style.borderColor = '';
  }, 3000);
}

// Mettre à jour la barre de progression
function updateProgressBar(current, total) {
  const progressContainer = document.getElementById('rooms-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  
  progressContainer.classList.remove('hidden');
  
  const percentage = Math.round((current / total) * 100);
  progressFill.style.width = percentage + '%';
  progressText.textContent = `${current}/${total}`;
  progressPercent.textContent = `${percentage}%`;
}

// Afficher l'aperçu complet des tickets formatés (MASQUÉ par défaut)
function showTicketsPreview(formattedText) {
  const preview = document.getElementById('tickets-preview');
  const toggleBtn = document.getElementById('toggle-preview-btn');
  
  // Nettoyer le texte (enlever markdown si présent)
  let cleanText = formattedText;
  
  // Enlever les code blocks markdown si Claude en a ajouté
  if (cleanText.includes('```')) {
    cleanText = cleanText.replace(/```plaintext\n?/g, '').replace(/```plain\n?/g, '').replace(/```\n?/g, '');
  }
  
  // Stocker le texte dans le preview mais le garder MASQUÉ
  preview.textContent = cleanText;
  
  // Afficher le bouton toggle
  toggleBtn.classList.remove('hidden');
}

// Vérifier le site actuel et activer/désactiver les boutons
async function checkCurrentSite() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const url = activeTab.url || '';
    
    console.log('URL actuelle:', url);
    
    // Bouton Dmbook
    const dmbookBtn = document.getElementById('scrape-tickets-btn');
    if (url.includes('dmbook.pro')) {
      dmbookBtn.disabled = false;
      dmbookBtn.title = '';
    } else {
      dmbookBtn.disabled = true;
      dmbookBtn.title = 'Naviguer vers Dmbook Pro pour activer';
    }
    
    // Bouton Stayntouch
    const stayntouchBtn = document.getElementById('scrape-rooms-btn');
    if (url.includes('stayntouch.com')) {
      stayntouchBtn.disabled = false;
      stayntouchBtn.title = '';
    } else {
      stayntouchBtn.disabled = true;
      stayntouchBtn.title = 'Naviguer vers StayNTouch pour activer';
    }
    
  } catch (error) {
    console.error('Erreur vérification site:', error);
  }
}

// Toggle affichage de l'aperçu tickets
function toggleTicketsPreview() {
  const preview = document.getElementById('tickets-preview');
  
  // Juste toggle, le texte du bouton reste "Aperçu"
  if (preview.classList.contains('hidden')) {
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
}

// Afficher loading
function showLoading(message) {
  document.getElementById('loading-text').textContent = message;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

// Masquer loading
function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

