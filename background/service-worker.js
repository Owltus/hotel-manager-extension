// Service Worker (Manifest V3)
// Gère la communication entre le popup et les content scripts
// 100% LOCAL - Pas d'API externe

console.log('Service Worker Hotel Manager démarré (100% LOCAL)');

/**
 * Écouter les messages du popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans service worker:', message.action);
  
  if (message.action === 'formatTickets') {
    handleFormatTicketsLocal(message.data).then(sendResponse);
    return true; // Async response
  }
  
  if (message.action === 'consolidateData') {
    handleConsolidationLocal().then(sendResponse);
    return true;
  }
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
 * Gestion des erreurs globales
 */
self.addEventListener('error', (event) => {
  console.error('Erreur Service Worker:', event.error);
});
