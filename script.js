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
   Démarrage
   ========================================================================== */

initMenu();
