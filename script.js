'use strict';

/* ==========================================================================
   Script unique du portfolio (chargé avec `defer` : le DOM est prêt).

   Organisation : une fonction init*() par comportement, appelée en bas du
   fichier. Chaque init*() sort tout de suite si ses éléments sont absents de
   la page. Les tâches suivantes ajoutent leurs fonctions sur le même modèle.
   ========================================================================== */


/* ==========================================================================
   Menu : bouton burger + panneau (toutes les pages)
   ========================================================================== */

function initMenu() {
  const menu = document.querySelector('.menu');
  const bouton = menu && menu.querySelector('.menu__bouton');
  const liste = menu && menu.querySelector('.menu__liste');
  if (!bouton || !liste) return;

  // Ferme le panneau et tient aria-expanded à jour
  function fermerMenu() {
    liste.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
  }

  // Rendue publique pour les autres comportements (ex. filtres de l'accueil)
  window.fermerMenu = fermerMenu;

  // Clic sur le burger : bascule ouvert / fermé
  bouton.addEventListener('click', () => {
    const ouvrir = liste.hidden;
    liste.hidden = !ouvrir;
    bouton.setAttribute('aria-expanded', String(ouvrir));
  });

  // Clic sur un lien du panneau : on ferme (la navigation suit son cours)
  liste.addEventListener('click', (evenement) => {
    if (evenement.target.closest('a')) fermerMenu();
  });

  // Clic à l'extérieur du menu : on ferme
  document.addEventListener('click', (evenement) => {
    if (!menu.contains(evenement.target)) fermerMenu();
  });

  // Échap : on ferme, et le focus revient sur le burger s'il était dans le panneau
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Escape' || liste.hidden) return;
    const focusDansMenu = menu.contains(document.activeElement);
    fermerMenu();
    if (focusDansMenu) bouton.focus();
  });
}


/* ==========================================================================
   Filtres de l'accueil : masquage des cartes, synchronisation de l'URL
   ========================================================================== */

function initFiltres() {
  const groupe = document.querySelector('.filtres');
  if (!groupe) return;

  const boutons = [...groupe.querySelectorAll('.filtre')];
  const cartes = [...document.querySelectorAll('.grille-projets .carte')];
  const slugs = boutons.map((bouton) => bouton.dataset.filtre);

  // Applique un filtre (slug inconnu ou absent => « tous ») et le reporte dans l'URL
  function appliquerFiltre(slug) {
    if (!slugs.includes(slug)) slug = 'tous';

    boutons.forEach((bouton) => {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.filtre === slug));
    });
    cartes.forEach((carte) => {
      const categories = (carte.dataset.categories || '').split(/\s+/);
      carte.hidden = slug !== 'tous' && !categories.includes(slug);
    });

    // ?filtre=slug (ou rien pour « tous »), en gardant le hash courant et sans ajouter d'entrée d'historique
    const url = new URL(location.href);
    if (slug === 'tous') url.searchParams.delete('filtre');
    else url.searchParams.set('filtre', slug);
    history.replaceState(null, '', url.href);
  }

  // Clic sur une pilule de filtre
  groupe.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('.filtre');
    if (bouton) appliquerFiltre(bouton.dataset.filtre);
  });

  // Liens du menu vers index.html?filtre=… : on filtre sur place, sans recharger la page
  document.addEventListener('click', (evenement) => {
    const lien = evenement.target.closest('a[href^="index.html?filtre="]');
    const modifie = evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey;
    if (!lien || evenement.button !== 0 || modifie) return; // le navigateur gère l'ouverture dans un nouvel onglet

    evenement.preventDefault();
    appliquerFiltre(new URL(lien.href).searchParams.get('filtre'));
    if (window.fermerMenu) window.fermerMenu();
    document.getElementById('projets').scrollIntoView(); // doux, sauf si le visiteur préfère moins de mouvement (CSS)
  });

  // Au chargement : filtre demandé par l'URL
  appliquerFiltre(new URLSearchParams(location.search).get('filtre'));
}


/* ==========================================================================
   Démarrage
   ========================================================================== */

initMenu();
initFiltres();
