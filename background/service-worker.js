// Service Worker (Manifest V3)
// Gère la communication entre le popup et les content scripts
// 100% LOCAL - Pas d'API externe

console.log('Service Worker Hotel Manager démarré (100% LOCAL)');

/**
 * Écouter les messages du popup ET des content scripts
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`🔔 [SERVICE-WORKER] Message reçu: ${message.action}`, {
    action: message.action,
    source: message.source || 'unknown',
    senderTab: sender.tab?.id,
    senderUrl: sender.tab?.url
  });
  
  if (message.action === 'formatTickets') {
    handleFormatTicketsLocal(message.data).then(sendResponse);
    return true; // Async response
  }
  
  if (message.action === 'consolidateData') {
    handleConsolidationLocal().then(sendResponse);
    return true;
  }
  
  // NOUVELLES ACTIONS pour StayNTouch
  if (message.action === 'scrapeStayNTouchIntelligent') {
    handleStayNTouchIntelligent(message).then(sendResponse);
    return true;
  }
  
  if (message.action === 'checkStayNTouchTab') {
    handleCheckStayNTouchTab(message).then(sendResponse);
    return true;
  }
  
  if (message.action === 'communicateWithStayNTouch') {
    handleCommunicateWithStayNTouch(message).then(sendResponse);
    return true;
  }

  // Aucune action reconnue — retourner false pour éviter que le sender attende une réponse qui ne viendra pas.
  return false;
});

/**
 * Gérer le formatage des tickets par niveaux (100% LOCAL)
 */
async function handleFormatTicketsLocal(ticketsData) {
  console.log('Formatage local des tickets par niveaux...');
  
  // Utiliser directement le formatage manuel (pas d'API)
  const formattedText = manualTicketFormatting(ticketsData);
  
  console.log('✅ Tickets formatés localement');
  
  return {
    success: true,
    data: {
      formatted_text: formattedText,
      raw_tickets: ticketsData,
      timestamp: new Date().toISOString(),
      method: 'local'
    }
  };
}

/**
 * Gérer la consolidation des données (100% LOCAL)
 */
async function handleConsolidationLocal() {
  try {
    console.log('Démarrage de la consolidation locale...');
    
    // Récupérer les données du storage
    const result = await browser.storage.local.get(['chambres_data', 'tickets_data']);
    
    if (!result.chambres_data) {
      throw new Error('Aucune donnée de chambres disponible.');
    }
    
    if (!result.tickets_data) {
      throw new Error('Aucune donnée de tickets disponible.');
    }
    
    console.log('Données récupérées:', {
      chambres: result.chambres_data.chambres?.length || 0,
      tickets: result.tickets_data.tickets?.length || 0
    });
    
    // Utiliser directement la consolidation manuelle (pas d'API)
    const consolidatedData = manualConsolidation(result.chambres_data, result.tickets_data);
    
    console.log('✅ Consolidation locale réussie');
    
    return {
      success: true,
      data: consolidatedData
    };
  } catch (error) {
    console.error('Erreur consolidation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Consolidation manuelle locale
 */
function manualConsolidation(chambresData, ticketsData) {
  console.log('Consolidation manuelle des données...');
  
  const chambres = chambresData.chambres.map(chambre => {
    // Trouver les tickets associés
    const ticketsAssocies = ticketsData.tickets.filter(ticket => {
      return ticket.numero_chambre === chambre.numero;
    });
    
    // Calculer la priorité
    let priority = 'BASSE';
    if (chambre.statut_proprete === 'DIRTY') {
      priority = 'HAUTE';
    } else if (ticketsAssocies.length > 0) {
      const hasHautePriorite = ticketsAssocies.some(t => t.priorite === 'HAUTE');
      if (hasHautePriorite) {
        priority = 'HAUTE';
      } else {
        priority = 'MOYENNE';
      }
    }
    
    return {
      ...chambre,
      tickets: ticketsAssocies.map(t => ({
        numero: t.numero_ticket,
        contenu: t.contenu,
        statut: t.statut,
        date: t.date_relative || t.date_creation,
        priorite: t.priorite
      })),
      priority: priority,
      nb_tickets: ticketsAssocies.length
    };
  });
  
  // Tickets sans chambre
  const ticketsSansChambre = ticketsData.tickets.filter(ticket => 
    !ticket.numero_chambre
  );
  
  // Statistiques
  const chambresAvecTickets = chambres.filter(c => c.nb_tickets > 0).length;
  const prioriteHaute = chambres.filter(c => c.priority === 'HAUTE').length;
  const prioriteMoyenne = chambres.filter(c => c.priority === 'MOYENNE').length;
  const prioriteBasse = chambres.filter(c => c.priority === 'BASSE').length;
  
  return {
    chambres: chambres,
    tickets_sans_chambre: ticketsSansChambre,
    statistiques: {
      total_chambres: chambres.length,
      chambres_avec_tickets: chambresAvecTickets,
      tickets_total: ticketsData.tickets.length,
      priorite_haute: prioriteHaute,
      priorite_moyenne: prioriteMoyenne,
      priorite_basse: prioriteBasse
    },
    timestamp: new Date().toISOString(),
    method: 'local'
  };
}

/**
 * Formatage manuel des tickets par niveaux
 */
function manualTicketFormatting(ticketsData) {
  const today = new Date().toLocaleDateString('fr-FR');
  const tickets = ticketsData.tickets || [];
  
  // Nettoyer et regrouper par niveau
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
    // Nettoyer le contenu complètement
    let cleanContent = ticket.contenu;
    
    // Extraire le numéro de chambre au début du contenu
    const match = cleanContent.match(/^#?(\d{3})\s+(.+)/);
    
    if (match) {
      const roomNum = match[1];
      let description = match[2];
      
      // Nettoyer la description (enlever tout après un saut de ligne)
      description = description.split(/[\n\r]+/)[0].trim();
      
      const level = Math.floor(parseInt(roomNum) / 100) * 100;
      
      if (byLevel[level]) {
        byLevel[level].push({
          numero: roomNum,
          description: description
        });
      } else {
        byLevel.DIVERS.push({ description: description });
      }
    } else {
      // Pas de numéro de chambre détecté → DIVERS
      const cleanDesc = cleanContent.split(/[\n\r]+/)[0].trim();
      if (cleanDesc && cleanDesc.length > 3) {
        byLevel.DIVERS.push({ description: cleanDesc });
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
  
  // Construire le texte formaté
  let output = `LISTE DES TICKETS DE MAINTENANCE\nDate : ${today}\n\n`;
  
  const levels = [100, 200, 300, 400, 500, 600];
  let hasTickets = false;
  
  for (const level of levels) {
    if (byLevel[level].length > 0) {
      if (hasTickets) output += '----------\n\n';
      
      byLevel[level].forEach(ticket => {
        output += `#${ticket.numero} ${ticket.description}\n\n`;
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
 * NOUVELLES FONCTIONS pour StayNTouch
 */

/**
 * Gérer le scrapping intelligent de StayNTouch
 */
async function handleStayNTouchIntelligent(message) {
  try {
    console.log('🤖 [SERVICE-WORKER] Démarrage scrapping StayNTouch intelligent');
    
    // Vérifier si un onglet StayNTouch existe déjà
    const tabs = await browser.tabs.query({url: ['*://app.stayntouch.com/*', '*://app.eu1.stayntouch.com/*']});
    console.log(`📊 [SERVICE-WORKER] Onglets StayNTouch trouvés: ${tabs.length}`);
    
    let targetTab = null;
    
    if (tabs.length === 0) {
      // Créer un nouvel onglet StayNTouch (utiliser le domaine EU)
      console.log('🚀 [SERVICE-WORKER] Création nouvel onglet StayNTouch...');
      targetTab = await browser.tabs.create({
        url: 'https://app.eu1.stayntouch.com/housekeeping/roomStatus',
        active: false // En arrière-plan
      });
      
      console.log(`✅ [SERVICE-WORKER] Onglet créé: ${targetTab.id}`);

      // Attendre le chargement (7 sec pour plus de stabilité)
      console.log('⏳ [SERVICE-WORKER] Attente chargement page (7 sec)...');
      await new Promise(resolve => setTimeout(resolve, 7000));
    } else {
      targetTab = tabs[0];
      console.log(`📌 [SERVICE-WORKER] Utilisation onglet existant: ${targetTab.id}`);
    }
    
    // Vérifier d'abord si le content script est prêt
    console.log('🔍 [SERVICE-WORKER] Vérification readiness content script...');
    
    const isReady = await checkContentScriptReady(targetTab.id);
    
    if (!isReady) {
      console.log('⚠️ [SERVICE-WORKER] Content script pas prêt, attente supplémentaire...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const isReadyRetry = await checkContentScriptReady(targetTab.id);
      if (!isReadyRetry) {
        throw new Error('Content script StayNTouch non chargé après attente');
      }
    }
    
    // Essayer de communiquer avec l'onglet
    console.log('📡 [SERVICE-WORKER] Tentative communication avec onglet...');
    
    try {
      const scrapingResult = await browser.tabs.sendMessage(targetTab.id, {
        action: 'scrapeAllPages'
      });
      
      console.log('📨 [SERVICE-WORKER] Réponse reçue:', scrapingResult);
      
      if (scrapingResult && scrapingResult.success) {
        // Sauvegarder les données avec gestion d'erreur
        try {
          await browser.storage.local.set({
            chambres_data: scrapingResult.data,
            last_update_rooms: new Date().toISOString()
          });

          console.log('💾 [SERVICE-WORKER] Données sauvegardées');
        } catch (storageError) {
          console.error('❌ [SERVICE-WORKER] Erreur sauvegarde:', storageError);
          throw new Error(`Impossible de sauvegarder les données: ${storageError.message}`);
        }

        // Fermer l'onglet si on l'a créé. Un échec de fermeture (onglet fermé par l'utilisateur) ne doit pas masquer le succès de la sauvegarde.
        if (tabs.length === 0) {
          try {
            await browser.tabs.remove(targetTab.id);
          } catch (closeError) {
            console.warn('⚠️ [SERVICE-WORKER] Fermeture onglet temporaire échouée:', closeError.message);
          }
        }

        return scrapingResult;
      } else {
        throw new Error(scrapingResult?.error || 'Pas de données reçues');
      }
      
    } catch (commError) {
      console.error('❌ [SERVICE-WORKER] Erreur communication:', commError);
      
      // Ne pas fermer l'onglet en cas d'erreur, l'utilisateur peut s'en servir
      throw new Error(`Communication échouée: ${commError.message}`);
    }
    
  } catch (error) {
    console.error('❌ [SERVICE-WORKER] Erreur scrapping intelligent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Vérifier/ouvrir un onglet StayNTouch
 */
async function handleCheckStayNTouchTab(message) {
  try {
    console.log('🔍 [SERVICE-WORKER] Vérification onglets StayNTouch...');
    
    const tabs = await browser.tabs.query({url: ['*://app.stayntouch.com/*', '*://app.eu1.stayntouch.com/*']});
    console.log(`📊 [SERVICE-WORKER] ${tabs.length} onglet(s) StayNTouch trouvé(s)`);
    
    // Filtrer les onglets morts
    const liveTabs = [];
    for (const tab of tabs) {
      try {
        const isAlive = await checkContentScriptReady(tab.id);
        if (isAlive) {
          liveTabs.push(tab);
          console.log(`✅ [SERVICE-WORKER] Onglet ${tab.id} vivant`);
        } else {
          console.log(`💀 [SERVICE-WORKER] Onglet ${tab.id} mort ou non prêt`);
        }
      } catch (error) {
        console.log(`❌ [SERVICE-WORKER] Erreur test onglet ${tab.id}:`, error.message);
      }
    }
    
    if (liveTabs.length > 0) {
      const activeTab = liveTabs[0];
      console.log(`📌 [SERVICE-WORKER] Onglet vivant: ${activeTab.id} - ${activeTab.url}`);
      
      return {
        success: true,
        hasTab: true,
        tabId: activeTab.id,
        tabUrl: activeTab.url
      };
    }
    
    // Ouvrir un nouvel onglet si demandé
    if (message.openIfNotFound) {
      console.log('🚀 [SERVICE-WORKER] Ouverture nouvel onglet StayNTouch...');
      
      const newTab = await browser.tabs.create({
        url: 'https://app.eu1.stayntouch.com/housekeeping/roomStatus',
        active: true // Actif pour que l'utilisateur puisse se connecter
      });
      
      console.log(`✅ [SERVICE-WORKER] Nouvel onglet créé: ${newTab.id}`);
      
      return {
        success: true,
        hasTab: false, // Pas encore utilisable
        tabId: newTab.id,
        tabUrl: newTab.url,
        justCreated: true
      };
    }
    
    return {
      success: true,
      hasTab: false
    };
    
  } catch (error) {
    console.error('❌ [SERVICE-WORKER] Erreur vérification onglet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Communiquer avec un onglet StayNTouch spécifique
 */
async function handleCommunicateWithStayNTouch(message) {
  try {
    const tabId = message.tabId;
    console.log(`📡 [SERVICE-WORKER] Communication avec onglet ${tabId}...`);
    
    // Vérifier que l'onglet existe encore
    const tab = await browser.tabs.get(tabId);
    console.log(`📋 [SERVICE-WORKER] Onglet ${tabId}: ${tab.url}`);
    
    // Vérifier si le content script est prêt
    console.log('🔍 [SERVICE-WORKER] Vérification readiness...');
    const isReady = await checkContentScriptReady(tabId);
    
    if (!isReady) {
      console.log('⚠️ [SERVICE-WORKER] Content script non prêt, tentative injection...');
      await injectContentScriptIfNeeded(tabId);
      
      // Attendre un peu après injection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Re-vérifier
      const isReadyAfterInject = await checkContentScriptReady(tabId);
      if (!isReadyAfterInject) {
        throw new Error('Content script toujours non prêt après injection');
      }
    }
    
    // Essayer de communiquer avec retry (5 tentatives)
    console.log('📡 [SERVICE-WORKER] Tentative communication avec retry...');
    const result = await communicateWithRetry(tabId, {
      action: 'scrapeAllPages'
    }, 5);

    console.log('📨 [SERVICE-WORKER] Réponse communication:', result);

    if (result && result.success) {
      // Sauvegarder les données avec gestion d'erreur
      try {
        await browser.storage.local.set({
          chambres_data: result.data,
          last_update_rooms: new Date().toISOString()
        });

        console.log('💾 [SERVICE-WORKER] Données sauvegardées avec succès');
      } catch (storageError) {
        console.error('❌ [SERVICE-WORKER] Erreur sauvegarde:', storageError);
        throw new Error(`Impossible de sauvegarder les données: ${storageError.message}`);
      }

      return result;
    } else {
      throw new Error(result?.error || 'Pas de réponse valide');
    }
    
  } catch (error) {
    console.error(`❌ [SERVICE-WORKER] Erreur communication onglet ${message.tabId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Vérifier si le content script est prêt
 */
async function checkContentScriptReady(tabId) {
  try {
    console.log(`🔍 [SERVICE-WORKER] Test ping content script ${tabId}...`);
    
    // Vérifier d'abord si l'onglet existe encore
    try {
      await browser.tabs.get(tabId);
    } catch (tabError) {
      console.log(`🗑️ [SERVICE-WORKER] Onglet ${tabId} n'existe plus`);
      return false;
    }
    
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'ping'
    });
    
    console.log(`📊 [SERVICE-WORKER] Ping response:`, response);
    return response && (response.pong === true);
    
  } catch (error) {
    console.log(`❌ [SERVICE-WORKER] Ping failed: ${error.message}`);
    return false;
  }
}

/**
 * Injecter le content script si nécessaire
 */
async function injectContentScriptIfNeeded(tabId) {
  try {
    console.log(`💉 [SERVICE-WORKER] Injection content script dans onglet ${tabId}...`);
    
    await browser.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-scripts/stayntouch-scraper.js']
    });
    
    console.log(`✅ [SERVICE-WORKER] Content script injecté`);
    
  } catch (error) {
    console.error(`❌ [SERVICE-WORKER] Erreur injection:`, error);
    // Ne pas throw, essayer de continuer
  }
}

/**
 * Communication avec retry (5 tentatives pour plus de stabilité)
 */
async function communicateWithRetry(tabId, message, maxRetries = 5) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [SERVICE-WORKER] Tentative ${attempt}/${maxRetries}...`);

      const result = await browser.tabs.sendMessage(tabId, message);

      if (result) {
        console.log(`✅ [SERVICE-WORKER] Succès tentative ${attempt}`);
        return result;
      }

      throw new Error('Pas de réponse');

    } catch (error) {
      console.log(`⚠️ [SERVICE-WORKER] Tentative ${attempt} échouée:`, error.message);
      lastError = error;

      if (attempt < maxRetries) {
        // Délai progressif: 1s, 2s, 3s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Gestion des erreurs globales
 */
self.addEventListener('error', (event) => {
  console.error('Erreur Service Worker:', event.error);
});
