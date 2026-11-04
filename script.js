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
   Visionneuse : agrandissement des images de la galerie (page projet)
   ========================================================================== */

function initVisionneuse() {
  const liens = [...document.querySelectorAll('.galerie a.galerie__item')];
  if (!liens.length) return;

  // Chevron de .defiler (même trait) ; le CSS le tourne pour « précédent » et « suivant »
  const chevron = '<svg viewBox="0 0 122 64" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l58 58 58-58"/></svg>';
  const croix = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l30 30M35 5L5 35"/></svg>';

  let dialog = null;
  let image = null;
  let indice = 0;

  // Crée l’unique <dialog> à la première ouverture (« Fermer » en premier : il reçoit le focus)
  function creer() {
    dialog = document.createElement('dialog');
    dialog.className = 'visionneuse';
    dialog.setAttribute('aria-label', 'Image agrandie');
    // Focusable par programme : un clic sur l’image (ou sur un bouton que Safari / Firefox macOS
    // ne focalisent pas) met le focus sur le dialog, donc les flèches du clavier continuent de marcher
    dialog.tabIndex = -1;
    dialog.innerHTML =
      '<button class="visionneuse__fermer" type="button" aria-label="Fermer">' + croix + '</button>' +
      '<button class="visionneuse__precedent" type="button" aria-label="Image précédente">' + chevron + '</button>' +
      '<img class="visionneuse__image" alt="">' +
      '<button class="visionneuse__suivant" type="button" aria-label="Image suivante">' + chevron + '</button>';
    image = dialog.querySelector('.visionneuse__image');

    // Une seule image : rien à parcourir
    const seule = liens.length < 2;
    dialog.querySelector('.visionneuse__precedent').hidden = seule;
    dialog.querySelector('.visionneuse__suivant').hidden = seule;

    // Clic sur le fond (la cible est alors le <dialog> lui-même) ou sur un bouton
    dialog.addEventListener('click', (evenement) => {
      if (evenement.target === dialog) {
        dialog.close();
        return;
      }
      const bouton = evenement.target.closest('button');
      if (!bouton) return;
      if (bouton.classList.contains('visionneuse__fermer')) dialog.close();
      else if (bouton.classList.contains('visionneuse__precedent')) afficher(indice - 1);
      else if (bouton.classList.contains('visionneuse__suivant')) afficher(indice + 1);
    });

    // Flèches : on parcourt les images ; Échap : on ferme.
    // Les flèches combinées à Alt / Ctrl / Cmd sont laissées au navigateur et aux lecteurs d’écran
    // (Alt+← = page précédente, Ctrl+Option+flèches = VoiceOver)
    dialog.addEventListener('keydown', (evenement) => {
      const modifie = evenement.altKey || evenement.ctrlKey || evenement.metaKey;
      if (evenement.key === 'ArrowLeft') {
        if (!modifie) afficher(indice - 1);
      } else if (evenement.key === 'ArrowRight') {
        if (!modifie) afficher(indice + 1);
      } else if (evenement.key === 'Escape') {
        evenement.preventDefault();
        dialog.close();
      }
    });

    // À la fermeture, quelle qu’en soit la cause, le focus revient sur le lien de l’image affichée
    // (c’est le lien cliqué tant qu’on n’a pas parcouru les images)
    dialog.addEventListener('close', () => liens[indice].focus());

    document.body.append(dialog);
  }

  // Affiche l’image n° i du parcours (en boucle) en recopiant son texte alternatif
  function afficher(i) {
    indice = (i + liens.length) % liens.length;
    const lien = liens[indice];
    const miniature = lien.querySelector('img');
    image.setAttribute('src', lien.getAttribute('href'));
    image.setAttribute('alt', (miniature && miniature.getAttribute('alt')) || '');
  }

  liens.forEach((lien, i) => {
    lien.addEventListener('click', (evenement) => {
      const modifie = evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey;
      if (evenement.button !== 0 || modifie) return; // le navigateur gère l’ouverture dans un nouvel onglet

      evenement.preventDefault();
      if (!dialog) creer();
      afficher(i);
      dialog.showModal();
    });
  });
}


/* ==========================================================================
   Démarrage
   ========================================================================== */

initMenu();
initFiltres();
initVisionneuse();
