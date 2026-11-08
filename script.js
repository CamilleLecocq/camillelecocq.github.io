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

  // Sans script, l'attribut hidden garde le panneau fermé. Avec le script, c'est la
  // classe menu--ouvert qui l'ouvre et le ferme, pour que le CSS puisse l'animer.
  liste.hidden = false;

  // Rang de chaque lien : ils arrivent l'un après l'autre à l'ouverture (CSS)
  liste.querySelectorAll('li').forEach((element, rang) => element.style.setProperty('--i', rang));

  const estOuvert = () => menu.classList.contains('menu--ouvert');

  // Ouvre ou ferme le panneau et tient aria-expanded à jour
  function basculerMenu(ouvrir) {
    menu.classList.toggle('menu--ouvert', ouvrir);
    bouton.setAttribute('aria-expanded', String(ouvrir));
  }

  function fermerMenu() {
    basculerMenu(false);
  }

  // Lien de la page affichée (et, sur l'accueil, du filtre actif) : aria-current, en pastille pleine
  function marquerPageCourante() {
    const nomPage = (url) => url.pathname.split('/').pop() || 'index.html';
    const ici = new URL(location.href);
    liste.querySelectorAll('a').forEach((lien) => {
      const cible = new URL(lien.href);
      const courant = nomPage(cible) === nomPage(ici)
        && cible.searchParams.get('filtre') === ici.searchParams.get('filtre');
      if (courant) lien.setAttribute('aria-current', 'page');
      else lien.removeAttribute('aria-current');
    });
  }

  // Rendues publiques pour les autres comportements (ex. filtres de l'accueil)
  window.fermerMenu = fermerMenu;
  window.marquerPageCourante = marquerPageCourante;
  marquerPageCourante();

  // Clic sur le burger : bascule ouvert / fermé
  bouton.addEventListener('click', () => basculerMenu(!estOuvert()));

  // Clic sur un lien du panneau : on ferme (la navigation suit son cours)
  liste.addEventListener('click', (evenement) => {
    if (evenement.target.closest('a')) fermerMenu();
  });

  // Clic hors du burger et du panneau (le voile compris, qui appartient au menu) : on ferme
  document.addEventListener('click', (evenement) => {
    if (!bouton.contains(evenement.target) && !liste.contains(evenement.target)) fermerMenu();
  });

  // Échap : on ferme, et le focus revient sur le burger s'il était dans le panneau
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Escape' || !estOuvert()) return;
    const focusDansMenu = menu.contains(document.activeElement);
    fermerMenu();
    if (focusDansMenu) bouton.focus();
  });

  // Burger flottant : dès que la place du burger dans l'en-tête sort de l'écran, il la quitte
  // pour une pastille fixe (la boîte .menu garde sa taille et sert de repère)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entree]) => {
      const flottant = !entree.isIntersecting;
      if (flottant === menu.classList.contains('menu--flottant')) return;
      fermerMenu(); // un panneau ouvert sauterait sinon d'une place à l'autre
      menu.classList.toggle('menu--flottant', flottant);
    }).observe(menu);
  }
}


/* ==========================================================================
   Repères d'année de l'accueil : les cartes portent data-annee et sont rangées
   du plus récent au plus ancien ; un repère est inséré avant la première carte
   de chaque année (les filtres masquent ensuite les repères sans carte)
   ========================================================================== */

function initAnnees() {
  const grille = document.querySelector('.accueil .grille-projets');
  if (!grille) return;

  const reperes = [];
  let precedente = null;
  grille.querySelectorAll('.carte[data-annee]').forEach((carte) => {
    const annee = carte.dataset.annee;
    if (annee === precedente) return;
    precedente = annee;

    const repere = document.createElement('li');
    repere.className = 'grille-annee';
    const titre = document.createElement('h2');
    titre.className = 'grille-annee__titre';
    titre.textContent = annee;
    const trait = document.createElement('span');
    trait.className = 'grille-annee__trait';
    trait.setAttribute('aria-hidden', 'true');
    repere.append(titre, trait);
    carte.before(repere);
    reperes.push(repere);
  });

  // Le millésime monte et le trait se dessine quand le repère arrive à l'écran (une seule fois)
  const montrer = (repere) => repere.classList.add('grille-annee--vue');
  if (!('IntersectionObserver' in window)) {
    reperes.forEach(montrer);
    return;
  }
  const observateur = new IntersectionObserver((entrees) => {
    entrees.forEach((entree) => {
      if (!entree.isIntersecting) return;
      montrer(entree.target);
      observateur.unobserve(entree.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  reperes.forEach((repere) => observateur.observe(repere));
}


/* ==========================================================================
   Filtres de l'accueil : masquage des cartes, synchronisation de l'URL
   ========================================================================== */

function initFiltres() {
  const groupe = document.querySelector('.filtres');
  if (!groupe) return;

  const boutons = [...groupe.querySelectorAll('.filtre')];
  const grille = document.querySelector('.grille-projets');
  const cartes = [...document.querySelectorAll('.grille-projets .carte')];
  const slugs = boutons.map((bouton) => bouton.dataset.filtre);
  // Cartes et repères d'année, dans l'ordre du DOM (le même avant et après le filtrage)
  const elements = grille ? [...grille.children] : [];
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Dernier filtre demandé (lu par le rappel de la transition) et transition en cours
  let filtreVise = null;
  let transitionEnCours = null;

  // Pastille rouge du filtre actif : un seul élément, sans texte, glissé sous le bouton actif
  // (transition CSS). Sans JS, la classe filtres--pastille manque : le bouton actif garde son fond rouge
  const pastille = document.createElement('span');
  pastille.className = 'filtres__pastille';
  pastille.setAttribute('aria-hidden', 'true');
  groupe.prepend(pastille);
  groupe.classList.add('filtres--pastille');
  let finGlissement = null;

  // Place la pastille sous le bouton actif ; sans animation au chargement et au redimensionnement
  function placerPastille(animer) {
    const actif = boutons.find((bouton) => bouton.getAttribute('aria-pressed') === 'true');
    if (!actif) return;
    if (!animer) pastille.classList.add('filtres__pastille--fixe');
    // Mesures au sous-pixel près (les tailles en --k tombent rarement juste) : offsetLeft/Width arrondissent
    // au pixel et laissaient un liseré entre la pastille et le contour du bouton.
    // La pilule cliquée peut être en plein rebond d'appui (scale) : la taille vient donc du style calculé
    // (boîte bordure, sans transformation) et la position du centre, que le scale ne déplace pas
    const repere = groupe.getBoundingClientRect();
    const cadre = actif.getBoundingClientRect();
    const style = getComputedStyle(actif);
    const largeur = parseFloat(style.width);
    const hauteur = parseFloat(style.height);
    const x = cadre.left + cadre.width / 2 - largeur / 2 - repere.left - groupe.clientLeft;
    const y = cadre.top + cadre.height / 2 - hauteur / 2 - repere.top - groupe.clientTop;
    pastille.style.width = `${largeur}px`;
    pastille.style.height = `${hauteur}px`;
    pastille.style.transform = `translate(${x}px, ${y}px)`;
    if (!animer) {
      void pastille.offsetWidth; // la position s'applique sans transition avant que celle-ci revienne
      pastille.classList.remove('filtres__pastille--fixe');
      return;
    }
    // Pendant le glissement, les textes changent de couleur en douceur, au rythme de la pastille
    groupe.classList.add('filtres--glisse');
    clearTimeout(finGlissement);
    finGlissement = setTimeout(() => groupe.classList.remove('filtres--glisse'), 600);
  }

  // Taille des pilules modifiée (police chargée, fenêtre redimensionnée, retour à la ligne) : on recale
  if ('ResizeObserver' in window) {
    const observateur = new ResizeObserver(() => placerPastille(false));
    observateur.observe(groupe);
    boutons.forEach((bouton) => observateur.observe(bouton));
  } else {
    window.addEventListener('resize', () => placerPastille(false));
  }

  // Applique un filtre (slug inconnu ou absent => « tous ») et le reporte dans l'URL
  function appliquerFiltre(slug) {
    if (!slugs.includes(slug)) slug = 'tous';

    boutons.forEach((bouton) => {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.filtre === slug));
    });
    cartes.forEach((carte) => {
      const categories = (carte.dataset.categories || '').split(/\s+/);
      const etaitCachee = carte.hidden;
      carte.hidden = slug !== 'tous' && !categories.includes(slug);
      // Carte qui revient : elle ne rejoue pas son apparition au défilement
      if (etaitCachee && !carte.hidden && carte.classList.contains('apparition')) {
        carte.classList.add('apparition--vue');
      }
    });

    // La grille connaît le filtre actif : sous « Affiches » et « Dessins », les cartes prennent le format de leur image (CSS)
    if (grille) grille.dataset.filtre = slug;

    // Repères d'année (initAnnees) : masqués quand aucune carte de leur année n'est affichée ;
    // le premier repère visible perd son espace du haut
    let premier = true;
    document.querySelectorAll('.grille-annee').forEach((repere) => {
      let visible = false;
      for (let suivant = repere.nextElementSibling;
        suivant && !suivant.classList.contains('grille-annee');
        suivant = suivant.nextElementSibling) {
        if (!suivant.hidden) visible = true;
      }
      repere.hidden = !visible;
      repere.classList.toggle('grille-annee--premiere', visible && premier);
      if (visible) premier = false;
    });

    // ?filtre=slug (ou rien pour « tous »), en gardant le hash courant et sans ajouter d'entrée d'historique
    const url = new URL(location.href);
    if (slug === 'tous') url.searchParams.delete('filtre');
    else url.searchParams.set('filtre', slug);
    history.replaceState(null, '', url.href);

    // Le menu met en valeur le filtre affiché
    if (window.marquerPageCourante) window.marquerPageCourante();
  }

  // Nom de transition (et classe de groupe) posé sur un élément pour un filtrage animé
  function nommer(element, nom, classe) {
    element.style.setProperty('view-transition-name', nom);
    element.style.setProperty('view-transition-class', classe);
  }

  // Retire les noms de transition : cartes, repères et barre de filtres reviennent à l'état normal
  function retirerNoms() {
    [...elements, groupe].forEach((element) => {
      element.style.removeProperty('view-transition-name');
      element.style.removeProperty('view-transition-class');
    });
  }

  // Clic sur une pilule. La pastille glisse jusqu'au nouveau filtre (CSS). Avec l'API View Transitions
  // (et sans « mouvement réduit »), les cartes et repères glissent aussi à leur place, ceux qui partent
  // s'effacent et ceux qui arrivent apparaissent. Sinon : cartes filtrées instantanément.
  function changerFiltre(slug) {
    const cible = slugs.includes(slug) ? slug : 'tous';
    const actif = boutons.find((bouton) => bouton.getAttribute('aria-pressed') === 'true');
    if (actif && actif.dataset.filtre === cible) return;
    const animer = !mouvementReduit.matches;

    if (!animer || typeof document.startViewTransition !== 'function') {
      appliquerFiltre(cible);
      placerPastille(animer);
      return;
    }
    filtreVise = cible;

    // Avant la photo de l'état actuel : un nom par carte ou repère visible. La barre de filtres a son
    // propre nom : seule sa version vivante est affichée, la pastille y glisse sans image figée par-dessus
    retirerNoms();
    elements.forEach((element, i) => {
      if (!element.hidden) nommer(element, `filtre-li-${i}`, 'filtre');
    });
    groupe.style.setProperty('view-transition-name', 'filtres-barre');

    const transition = document.startViewTransition(() => {
      appliquerFiltre(filtreVise);
      placerPastille(true);
      // Après le filtrage : noms des éléments encore visibles et de ceux qui arrivent
      elements.forEach((element, i) => {
        if (!element.hidden) nommer(element, `filtre-li-${i}`, 'filtre');
      });
    });

    // Fin de la transition, réussie ou interrompue par un clic plus récent : seule la dernière retire ses noms
    transitionEnCours = transition;
    const terminer = () => {
      if (transition !== transitionEnCours) return;
      transitionEnCours = null;
      retirerNoms();
    };
    transition.finished.then(terminer, terminer);
    transition.ready.catch(() => {}); // transition remplacée par un clic plus récent : rien à signaler
  }

  // Clic sur une pilule de filtre
  groupe.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('.filtre');
    if (bouton) changerFiltre(bouton.dataset.filtre);
  });

  // Liens du menu vers index.html?filtre=… : on filtre sur place, sans recharger la page
  document.addEventListener('click', (evenement) => {
    const lien = evenement.target.closest('a[href^="index.html?filtre="]');
    const modifie = evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey;
    if (!lien || evenement.button !== 0 || modifie) return; // le navigateur gère l'ouverture dans un nouvel onglet

    evenement.preventDefault();
    // Sans animation : la page défile vers la grille au même moment, une transition y serait faussée
    appliquerFiltre(new URL(lien.href).searchParams.get('filtre'));
    placerPastille(false);
    if (window.fermerMenu) window.fermerMenu();
    document.getElementById('projets').scrollIntoView(); // doux, sauf si le visiteur préfère moins de mouvement (CSS)
  });

  // Au chargement : filtre demandé par l'URL
  appliquerFiltre(new URLSearchParams(location.search).get('filtre'));
  placerPastille(false);
}


/* ==========================================================================
   Visionneuse : agrandissement des images de la galerie (page projet)
   et choix de la qualité de chaque image :
   - clic droit (ou touche Menu / Maj+F10) sur une image de la galerie ou de la
     visionneuse : menu des qualités disponibles ;
   - écran tactile : boutons de qualité dans la visionneuse.
   Le choix ne vaut que pour l'image concernée.
   ========================================================================== */

function initVisionneuse() {
  const liens = [...document.querySelectorAll('.galerie a.galerie__item')];
  if (!liens.length) return;

  // Chevron de .defiler (même trait) ; le CSS le tourne pour « précédent » et « suivant »
  const chevron = '<svg viewBox="0 0 122 64" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l58 58 58-58"/></svg>';
  const croix = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l30 30M35 5L5 35"/></svg>';

  let dialog = null;
  let image = null;
  let groupeQualites = null; // boutons de qualité (affichés sur écran tactile)
  let indice = 0;

  /* --- Qualités ------------------------------------------------------------ */

  const cacheQualites = new Map(); // lien → qualités disponibles
  const choix = new Map();         // lien → clé de la qualité choisie (absent : automatique)
  const jetons = new WeakMap();    // img → dernier changement de source demandé

  // Qualités d’une image, de la plus légère à l’originale, lues dans le srcset de sa vignette
  // (lu une seule fois : le srcset est retiré quand on impose une qualité)
  function qualitesDe(lien) {
    if (cacheQualites.has(lien)) return cacheQualites.get(lien);
    const vignette = lien.querySelector('img');
    const webp = ((vignette && vignette.getAttribute('srcset')) || '')
      .split(',')
      .map((morceau) => morceau.trim().split(/\s+/))
      .filter(([url, largeur]) => url && /^\d+w$/.test(largeur || ''))
      .map(([url, largeur]) => ({ url, largeur: parseInt(largeur, 10) }))
      .sort((a, b) => a.largeur - b.largeur);
    if (!webp.length) webp.push({ url: lien.getAttribute('href'), largeur: 0 });

    // La plus légère est « Basse », la plus lourde « Haute » (celle de la visionneuse par défaut)
    const liste = webp.map((variante, i) => {
      const nom = i === webp.length - 1 ? 'Haute' : i === 0 ? 'Basse' : 'Moyenne';
      return {
        cle: nom.toLowerCase(),
        nom,
        court: nom,
        detail: variante.largeur ? variante.largeur + ' px' : '',
        url: variante.url,
      };
    });
    if (lien.dataset.original) {
      liste.push({ cle: 'originale', nom: 'Originale', court: 'Max', detail: 'qualité max', url: lien.dataset.original });
    }
    cacheQualites.set(lien, liste);
    return liste;
  }

  const qualite = (lien, cle) => qualitesDe(lien).find((q) => q.cle === cle);

  // Qualité affichée dans la visionneuse : celle choisie, sinon « Haute »
  const qualiteVisionneuse = (lien) => qualite(lien, choix.get(lien)) || qualite(lien, 'haute');

  // Remplace la source d’une image une fois la nouvelle entièrement téléchargée
  // (l’image actuelle reste visible, atténuée, pendant le téléchargement)
  function changerSource(img, url, avant) {
    const jeton = {};
    jetons.set(img, jeton);
    img.setAttribute('aria-busy', 'true');
    const prechargement = new Image();
    prechargement.onload = () => {
      if (jetons.get(img) !== jeton) return; // une autre demande est arrivée entre-temps
      if (avant) avant();
      img.setAttribute('src', url);
      img.removeAttribute('aria-busy');
    };
    prechargement.onerror = () => {
      if (jetons.get(img) === jeton) img.removeAttribute('aria-busy');
    };
    prechargement.src = url;
  }

  // Vignette de la galerie : qualité imposée, ou retour au srcset d’origine (automatique)
  function appliquerVignette(lien) {
    const vignette = lien.querySelector('img');
    if (!vignette) return;
    if (!('srcAuto' in vignette.dataset)) {
      vignette.dataset.srcAuto = vignette.getAttribute('src') || '';
      vignette.dataset.srcsetAuto = vignette.getAttribute('srcset') || '';
      vignette.dataset.sizesAuto = vignette.getAttribute('sizes') || '';
    }
    const q = qualite(lien, choix.get(lien));
    if (q) {
      changerSource(vignette, q.url, () => {
        vignette.removeAttribute('srcset');
        vignette.removeAttribute('sizes');
      });
      return;
    }
    jetons.delete(vignette);
    vignette.removeAttribute('aria-busy');
    if (vignette.dataset.sizesAuto) vignette.setAttribute('sizes', vignette.dataset.sizesAuto);
    if (vignette.dataset.srcsetAuto) vignette.setAttribute('srcset', vignette.dataset.srcsetAuto);
    vignette.setAttribute('src', vignette.dataset.srcAuto);
  }

  // Applique un choix de qualité ('auto' = par défaut) à une seule image
  function choisirQualite(lien, cle) {
    if (cle === 'auto') choix.delete(lien);
    else choix.set(lien, cle);
    appliquerVignette(lien);
    if (dialog && dialog.open && liens[indice] === lien) {
      // Pendant un fondu enchaîné, la réapparition de l’image prend déjà la nouvelle qualité (changerImage)
      if (!image.classList.contains('visionneuse__image--change')) changerSource(image, qualiteVisionneuse(lien).url);
      majBoutonsQualite();
    }
  }

  /* --- Menu du clic droit -------------------------------------------------- */

  let menu = null;
  let menuLien = null;   // image concernée par le menu ouvert
  let menuRetour = null; // élément qui retrouve le focus à la fermeture

  function creerMenu() {
    menu = document.createElement('div');
    menu.className = 'menu-qualite';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Qualité de l’image');
    menu.hidden = true;

    menu.addEventListener('click', (evenement) => {
      evenement.stopPropagation();
      const option = evenement.target.closest('[data-cle]');
      if (!option) return;
      const lien = menuLien;
      fermerMenu();
      choisirQualite(lien, option.dataset.cle);
    });

    menu.addEventListener('contextmenu', (evenement) => evenement.preventDefault());

    // Flèches / Début / Fin : on parcourt les options ; Échap / Tab : on ferme.
    // Aucune touche ne remonte à la visionneuse (les flèches ne changent pas d’image)
    menu.addEventListener('keydown', (evenement) => {
      evenement.stopPropagation();
      const options = [...menu.querySelectorAll('[data-cle]')];
      const i = options.indexOf(document.activeElement);
      let cible = null;
      if (evenement.key === 'ArrowDown') cible = options[(i + 1) % options.length];
      else if (evenement.key === 'ArrowUp') cible = options[(i - 1 + options.length) % options.length];
      else if (evenement.key === 'Home') cible = options[0];
      else if (evenement.key === 'End') cible = options[options.length - 1];
      else if (evenement.key === 'Escape') {
        evenement.preventDefault();
        fermerMenu();
      } else if (evenement.key === 'Tab') fermerMenu();
      if (cible) {
        evenement.preventDefault();
        cible.focus();
      }
    });

    // Clic hors du menu : il se ferme, et ce clic ne fait rien d’autre (comme un menu natif)
    document.addEventListener('click', (evenement) => {
      if (menu.hidden || menu.contains(evenement.target)) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      fermerMenu();
    }, true);

    // Clic droit ailleurs que sur une image (menu natif) : on ferme le nôtre
    document.addEventListener('contextmenu', (evenement) => {
      if (!evenement.defaultPrevented) fermerMenu();
    });

    window.addEventListener('resize', fermerMenu);
    window.addEventListener('blur', fermerMenu);
    window.addEventListener('scroll', fermerMenu, true);
  }

  // Ouvre le menu à la position du clic (ou sur l’image si on l’ouvre au clavier)
  function ouvrirMenu(evenement, lien, enVisionneuse) {
    evenement.preventDefault();
    if (!menu) creerMenu();
    menuLien = lien;
    menuRetour = enVisionneuse ? dialog : lien;

    // Dans la galerie, « Automatique » rend la vignette au srcset (taille adaptée à l’écran)
    const actuelle = enVisionneuse ? qualiteVisionneuse(lien).cle : (choix.get(lien) || 'auto');
    const options = (enVisionneuse ? [] : [{ cle: 'auto', nom: 'Automatique', detail: 'selon l’écran' }])
      .concat(qualitesDe(lien));
    menu.innerHTML = '<p class="menu-qualite__titre" aria-hidden="true">Qualité de l’image</p>' +
      options.map((q) =>
        '<button class="menu-qualite__option" type="button" role="menuitemradio" tabindex="-1"' +
        ' aria-checked="' + (q.cle === actuelle) + '" data-cle="' + q.cle + '">' +
        '<span class="menu-qualite__nom">' + q.nom + '</span>' +
        (q.detail ? '<span class="menu-qualite__detail">' + q.detail + '</span>' : '') +
        '</button>'
      ).join('');

    // Dans la visionneuse, le menu doit être dans le <dialog> (lui seul est actif et au premier plan)
    (enVisionneuse ? dialog : document.body).append(menu);
    menu.hidden = false;

    let x = evenement.clientX;
    let y = evenement.clientY;
    if (!x && !y) {
      const cadre = (enVisionneuse ? image : lien).getBoundingClientRect();
      x = cadre.left + cadre.width / 2;
      y = cadre.top + cadre.height / 2;
    }
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';

    (menu.querySelector('[aria-checked="true"]') || menu.querySelector('[data-cle]')).focus({ preventScroll: true });
  }

  function fermerMenu() {
    if (!menu || menu.hidden) return;
    const focusDansMenu = menu.contains(document.activeElement);
    menu.hidden = true;
    if (focusDansMenu && menuRetour && (menuRetour !== dialog || dialog.open)) {
      menuRetour.focus({ preventScroll: true });
    }
  }

  /* --- Visionneuse --------------------------------------------------------- */

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
      '<div class="visionneuse__qualites" role="group" aria-label="Qualité de l’image"></div>' +
      '<button class="visionneuse__precedent" type="button" aria-label="Image précédente">' + chevron + '</button>' +
      '<img class="visionneuse__image" alt="" draggable="false">' +
      '<button class="visionneuse__suivant" type="button" aria-label="Image suivante">' + chevron + '</button>';
    image = dialog.querySelector('.visionneuse__image');
    groupeQualites = dialog.querySelector('.visionneuse__qualites');

    // Une seule image : rien à parcourir
    const seule = liens.length < 2;
    dialog.querySelector('.visionneuse__precedent').hidden = seule;
    dialog.querySelector('.visionneuse__suivant').hidden = seule;

    // Balayage tactile (avant le gestionnaire de clic : il écarte le clic qui suivrait un balayage)
    brancherBalayage();

    // Clic sur le fond (la cible est alors le <dialog> lui-même) ou sur un bouton
    dialog.addEventListener('click', (evenement) => {
      if (evenement.target === dialog) {
        dialog.close();
        return;
      }
      const bouton = evenement.target.closest('button');
      if (!bouton) return;
      if (bouton.classList.contains('visionneuse__fermer')) dialog.close();
      else if (bouton.classList.contains('visionneuse__qualite')) choisirQualite(liens[indice], bouton.dataset.cle);
      else if (bouton.classList.contains('visionneuse__precedent')) afficher(indice - 1);
      else if (bouton.classList.contains('visionneuse__suivant')) afficher(indice + 1);
    });

    // Clic droit sur l’image (ou touche Menu quand le focus est sur la visionneuse) : qualités
    dialog.addEventListener('contextmenu', (evenement) => {
      const auClavier = !evenement.clientX && !evenement.clientY;
      if (evenement.target === image || (evenement.target === dialog && auClavier)) {
        ouvrirMenu(evenement, liens[indice], true);
      }
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
    dialog.addEventListener('close', () => {
      fermerMenu();
      reinitialiserBalayage();
      liens[indice].focus();
    });

    document.body.append(dialog);
  }

  // Boutons de qualité de l’image affichée (recréés à chaque image : les qualités varient)
  function construireBoutonsQualite() {
    const lien = liens[indice];
    if (groupeQualites.contains(document.activeElement)) dialog.focus();
    groupeQualites.replaceChildren(...qualitesDe(lien).map((q) => {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'visionneuse__qualite';
      bouton.dataset.cle = q.cle;
      bouton.textContent = q.court;
      bouton.title = q.nom + (q.detail ? ' (' + q.detail + ')' : '');
      return bouton;
    }));
    groupeQualites.hidden = qualitesDe(lien).length < 2;
    majBoutonsQualite();
  }

  // État enfoncé du bouton de la qualité affichée (mis à jour sur place : le focus reste)
  function majBoutonsQualite() {
    const active = qualiteVisionneuse(liens[indice]).cle;
    groupeQualites.querySelectorAll('.visionneuse__qualite').forEach((bouton) => {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.cle === active));
    });
  }

  // Changement d’image en fondu enchaîné (visionneuse ouverte) : l’image sort en fondu, la suivante
  // se télécharge en parallèle, puis elle réapparaît. Le jeton écarte un affichage dépassé (clics rapides)
  function changerImage(lien) {
    const jeton = {};
    jetons.set(image, jeton);
    image.classList.add('visionneuse__image--change');

    const pret = new Promise((resoudre) => {
      const prechargement = new Image();
      prechargement.src = qualiteVisionneuse(lien).url;
      // decode() évite un à-coup au moment de l’affichage ; sans lui, on attend l’événement load.
      // En cas d’erreur, l’image est quand même affichée (image cassée, comme avant)
      if (prechargement.decode) prechargement.decode().then(resoudre, resoudre);
      else {
        prechargement.onload = resoudre;
        prechargement.onerror = resoudre;
      }
    });
    // Durée du fondu de sortie, identique à .visionneuse__image--change dans style.css
    const estompage = new Promise((resoudre) => setTimeout(resoudre, 150));

    Promise.all([pret, estompage]).then(() => {
      if (jetons.get(image) !== jeton) return; // un autre affichage a pris la main entre-temps
      const miniature = lien.querySelector('img');
      image.setAttribute('src', qualiteVisionneuse(lien).url); // qualité au moment de la réapparition
      image.setAttribute('alt', (miniature && miniature.getAttribute('alt')) || '');
      placerEntree(); // après un balayage : l’image arrive du côté opposé à celui où l’autre est partie
      image.classList.remove('visionneuse__image--change');
    });
  }

  // Affiche l’image n° i du parcours (en boucle), dans sa qualité, avec son texte alternatif
  function afficher(i) {
    fermerMenu();
    indice = (i + liens.length) % liens.length;
    const lien = liens[indice];
    jetons.delete(image); // abandonne un éventuel téléchargement ou fondu de l’image précédente
    image.removeAttribute('aria-busy');
    if (dialog.open) {
      changerImage(lien);
    } else {
      // Avant l’ouverture : affichage direct, l’ouverture en fondu suffit
      const miniature = lien.querySelector('img');
      image.classList.remove('visionneuse__image--change');
      image.setAttribute('src', qualiteVisionneuse(lien).url);
      image.setAttribute('alt', (miniature && miniature.getAttribute('alt')) || '');
    }
    construireBoutonsQualite();
  }

  /* --- Balayage tactile ---------------------------------------------------- */

  // Sur écran tactile, un balayage horizontal passe à l’image précédente / suivante et l’image suit
  // le doigt. Mouvement réduit : pas de suivi du doigt, l’image change simplement au balayage.
  const SEUIL_BALAYAGE = 50;     // px : distance qui valide le changement d’image
  const VITESSE_BALAYAGE = 0.4;  // px/ms : un geste court (20 px au moins) mais vif suffit aussi
  const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');

  const doigts = new Set();      // doigts posés sur la visionneuse
  let geste = null;              // balayage en cours : { id, x, t, dx, horizontal, suit, base }
  let balayageFait = false;      // le geste en cours (ou le dernier) était un balayage : son clic est ignoré
  let decalageEntree = 0;        // px : côté d’où arrive la nouvelle image après un balayage validé
  let minuterieRetour = null;

  // Retire tout effet du balayage sur l’image, sans animation
  function effacerSuivi() {
    clearTimeout(minuterieRetour);
    image.classList.remove('visionneuse__image--glisse', 'visionneuse__image--retour', 'visionneuse__image--sortie');
    image.style.removeProperty('--glisse-x');
    image.style.removeProperty('--glisse-o');
  }

  function reinitialiserBalayage() {
    geste = null;
    balayageFait = false;
    decalageEntree = 0;
    doigts.clear();
    effacerSuivi();
  }

  // L’image suit le doigt (translation) et s’estompe légèrement
  function suivreDoigt(dx, base) {
    const progression = Math.min(Math.abs(dx) / 200, 1);
    image.style.setProperty('--glisse-x', dx + 'px');
    image.style.setProperty('--glisse-o', String(base * (1 - 0.4 * progression)));
  }

  // Lâcher sous le seuil : l’image revient à sa place avec un léger rebond
  function revenirEnPlace() {
    if (!image.classList.contains('visionneuse__image--glisse')) return;
    image.classList.remove('visionneuse__image--glisse');
    image.classList.add('visionneuse__image--retour');
    image.style.removeProperty('--glisse-x');
    image.style.removeProperty('--glisse-o');
    clearTimeout(minuterieRetour);
    minuterieRetour = setTimeout(() => image.classList.remove('visionneuse__image--retour'), 600);
  }

  // Lâcher au-delà du seuil : même chemin que les flèches. L’image sortante poursuit sa course dans
  // le sens du doigt en s’effaçant, puis la nouvelle arrive du côté opposé (placerEntree)
  function validerBalayage(sens, suit) {
    if (suit) {
      const actuel = parseFloat(image.style.getPropertyValue('--glisse-x')) || 0;
      image.style.setProperty('--glisse-x', (actuel - sens * 40) + 'px');
      image.classList.remove('visionneuse__image--glisse');
      image.classList.add('visionneuse__image--sortie');
      decalageEntree = sens * 60;
    }
    afficher(indice + sens);
  }

  // Appelée quand la nouvelle image réapparaît : la translation retombe à zéro. Après un balayage,
  // l’image est d’abord posée du côté d’où elle arrive (sans transition), puis glisse à sa place
  function placerEntree() {
    const depart = decalageEntree;
    decalageEntree = 0;
    image.classList.remove('visionneuse__image--sortie');
    image.style.removeProperty('--glisse-x');
    image.style.removeProperty('--glisse-o');
    if (!depart) return;
    image.style.transition = 'none';
    image.style.transform = 'translateX(' + depart + 'px)';
    void image.offsetWidth; // fige la position de départ avant de rétablir les transitions
    image.style.removeProperty('transition');
    image.style.removeProperty('transform');
  }

  function brancherBalayage() {
    // Un balayage ne doit pas être pris pour un clic (un lâcher sur le fond fermerait la visionneuse)
    dialog.addEventListener('click', (evenement) => {
      if (!balayageFait) return;
      balayageFait = false;
      evenement.preventDefault();
      evenement.stopImmediatePropagation();
    }, true);

    dialog.addEventListener('pointerdown', (evenement) => {
      balayageFait = false;
      if (evenement.pointerType !== 'touch') return;
      if (evenement.isPrimary) doigts.clear(); // écarte un doigt resté enregistré par erreur
      doigts.add(evenement.pointerId);
      if (doigts.size > 1) { // deux doigts : zoom, pas un balayage
        geste = null;
        revenirEnPlace();
        return;
      }
      // Une seule image, bouton (qualité, précédent, suivant, fermer) ou menu : pas de balayage
      if (liens.length < 2 || evenement.target.closest('button, .menu-qualite')) return;

      // Pendant un fondu enchaîné, l’image n’est pas visible : le balayage change d’image sans la suivre
      const enChangement = image.classList.contains('visionneuse__image--change');
      if (!enChangement) effacerSuivi();
      geste = {
        id: evenement.pointerId,
        x: evenement.clientX,
        y: evenement.clientY,
        t: evenement.timeStamp,
        dx: 0,
        horizontal: false,
        suit: !enChangement && !mouvementReduit.matches,
        base: image.hasAttribute('aria-busy') ? 0.6 : 1, // opacité de départ (image en téléchargement : atténuée)
      };
    });

    dialog.addEventListener('pointermove', (evenement) => {
      if (!geste || evenement.pointerId !== geste.id) return;
      let dx = evenement.clientX - geste.x;
      const dy = evenement.clientY - geste.y;
      if (!geste.horizontal) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // trop tôt pour connaître la direction
        if (Math.abs(dy) > Math.abs(dx)) { // geste vertical : le navigateur défile, on s’efface
          geste = null;
          return;
        }
        // Balayage horizontal reconnu : la mesure repart d’ici, l’image ne saute pas
        geste.horizontal = true;
        geste.x = evenement.clientX;
        geste.t = evenement.timeStamp;
        balayageFait = true;
        dx = 0;
        if (geste.suit) image.classList.add('visionneuse__image--glisse');
      }
      geste.dx = dx;
      if (geste.suit) suivreDoigt(dx, geste.base);
    });

    dialog.addEventListener('pointerup', (evenement) => {
      doigts.delete(evenement.pointerId);
      if (!geste || evenement.pointerId !== geste.id) return;
      const fin = geste;
      geste = null;
      if (!fin.horizontal) return; // simple appui : le clic fait son travail
      const distance = Math.abs(fin.dx);
      const vif = distance >= 20 && distance / Math.max(evenement.timeStamp - fin.t, 1) >= VITESSE_BALAYAGE;
      if (distance >= SEUIL_BALAYAGE || vif) validerBalayage(fin.dx < 0 ? 1 : -1, fin.suit);
      else revenirEnPlace();
    });

    // Le navigateur reprend le geste (défilement vertical, zoom…) : retour en place
    dialog.addEventListener('pointercancel', (evenement) => {
      doigts.delete(evenement.pointerId);
      if (!geste || evenement.pointerId !== geste.id) return;
      geste = null;
      revenirEnPlace();
    });
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

    // Clic droit sur une image de la galerie : qualités de cette image
    lien.addEventListener('contextmenu', (evenement) => ouvrirMenu(evenement, lien, false));
  });
}


/* ==========================================================================
   Apparition au défilement : cartes et images de galerie montent en cascade
   ========================================================================== */

function initApparitions() {
  const cibles = document.querySelectorAll('.grille-projets .carte, .galerie > a.galerie__item, .galerie > div.galerie__video');
  if (!cibles.length) return;

  // Sans IntersectionObserver, rien n'est caché : tout reste visible comme avant
  if (!('IntersectionObserver' in window)) return;

  cibles.forEach((cible) => cible.classList.add('apparition'));

  // Les éléments qui entrent à l'écran dans le même rappel montent l'un après l'autre (--i = 0, 1, 2…)
  // Une carte masquée par un filtre reste observée : elle monte quand elle réapparaît
  const observateur = new IntersectionObserver((entrees) => {
    entrees
      .filter((entree) => entree.isIntersecting)
      .forEach((entree, rang) => {
        entree.target.style.setProperty('--i', rang);
        entree.target.classList.add('apparition--vue');
        observateur.unobserve(entree.target);
      });
  }, { rootMargin: '0px 0px -10% 0px' });
  // Page pré-rendue en arrière-plan : on observe à l'affichage, pour que la cascade se joue devant le visiteur
  quandAffichee(() => cibles.forEach((cible) => observateur.observe(cible)));
}


/* ==========================================================================
   Fondu des images : une image pas encore chargée reste invisible sur le fond gris,
   puis apparaît en douceur. Les images déjà chargées ou en cache ne sont pas touchées.
   ========================================================================== */

function initFonduImages() {
  const images = [...document.querySelectorAll('.carte img, .galerie__item img')];
  if (!images.length) return;

  images.forEach((image) => {
    if (image.complete) return; // chargée ou en cache : pas de fondu, donc pas de clignotement

    image.classList.add('image-attente');
    // Une image en erreur redevient visible aussi (son texte de remplacement s'affiche)
    const retirer = () => image.classList.remove('image-attente');
    image.addEventListener('load', retirer, { once: true });
    image.addEventListener('error', retirer, { once: true });
  });
}


/* ==========================================================================
   Transitions entre pages : la carte cliquée devient le bandeau du projet,
   et au retour le bandeau redevient sa carte.
   L'animation est en CSS ; ici on nomme seulement l'image de la carte suivie.
   ========================================================================== */

function initTransitionPages() {
  // Le navigateur annule la transition de certaines navigations (adresse tapée, retour arrière…) :
  // ses promesses sont alors rejetées. On absorbe ce rejet attendu pour ne pas polluer la console
  const absorber = (transition) => {
    if (!transition) return;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
  };
  absorber(document.activeViewTransition);
  window.addEventListener('pagereveal', (event) => absorber(event.viewTransition));
  window.addEventListener('pageswap', (event) => absorber(event.viewTransition));

  // Sans carte sur la page, aucune image ne peut devenir un bandeau (ni un bandeau redevenir une carte)
  if (!document.querySelector('.carte a')) return;

  // Bandeau de la page (sous-page à grille) : il porte le nom dans la feuille de style
  // et le cède à la carte suivie, car un seul élément par page peut le porter
  const bandeau = document.querySelector('.banniere__image');
  // Image de carte à laquelle le nom de transition a été donné
  let imageNommee = null;
  // Vrai de l'arrivée sur la page (retour animé) jusqu'à la fin de cette transition
  let retourEnCours = false;

  const nommerCarte = (image) => {
    if (bandeau) bandeau.style.viewTransitionName = 'none';
    image.style.viewTransitionName = 'banniere-projet';
    imageNommee = image;
  };

  // Rend les noms : la carte n'en porte plus, le bandeau retrouve celui de la feuille de style
  const retirerNoms = () => {
    if (imageNommee) imageNommee.style.viewTransitionName = '';
    if (bandeau) bandeau.style.viewTransitionName = '';
    imageNommee = null;
  };

  // Chemin d'une adresse sans « .html » ni barre finale : « /page » et « /page.html » sont la même page
  const chemin = (url) => url.pathname.replace(/(\.html)?\/?$/, '');

  // Image de la carte dont le lien mène à cette adresse (null si aucune, ou si l'adresse est d'un autre site)
  const imageDeCarte = (adresse) => {
    if (!adresse) return null;
    const url = new URL(adresse, location.href);
    if (url.origin !== location.origin) return null;
    const lien = Array.from(document.querySelectorAll('.carte a')).find((a) => chemin(new URL(a.href)) === chemin(url));
    return lien ? lien.querySelector('img') : null;
  };

  // pageswap : la page quittée n'est pas encore capturée, le nom posé ici est donc pris en compte
  window.addEventListener('pageswap', (event) => {
    // On part : un retour animé encore en cours ne doit plus retirer les noms posés ci-dessous
    retourEnCours = false;
    retirerNoms();

    // Pas de transition entre documents (navigateur sans support, ou navigation hors transition)
    if (!event.viewTransition || !event.activation) return;

    const image = imageDeCarte(event.activation.entry.url);
    if (image) nommerCarte(image);
  });

  // pagereveal : la page vient d'être affichée, avant la capture de son état. Quand on revient d'un projet
  // (retour arrière, lien…), la carte de ce projet prend le nom du bandeau quitté : il rétrécit et s'y pose.
  // L'écouteur doit exister avant le premier rendu : les pages à cartes chargent donc script.js avec
  // blocking="render", qui retient le rendu jusqu'à l'exécution du script (defer seul arriverait trop tard).
  // L'origine vient de l'API Navigation : rien à stocker ni à lire en dehors de la page.
  window.addEventListener('pagereveal', (event) => {
    const transition = event.viewTransition;
    if (!transition) return;

    // Noms restés d'un départ précédent (page restaurée par bfcache) : on repart de zéro
    retirerNoms();

    const origine = window.navigation && navigation.activation && navigation.activation.from;
    const image = origine ? imageDeCarte(origine.url) : null;
    if (!image) return;

    // Carte absente (masquée par un filtre) ou hors de l'écran : le bandeau s'efface, comme avant
    const cadre = image.getBoundingClientRect();
    if (cadre.width === 0 || cadre.height === 0
      || cadre.bottom <= 0 || cadre.top >= window.innerHeight
      || cadre.right <= 0 || cadre.left >= window.innerWidth) return;

    // La carte doit être visible dès la capture : pas de montée au défilement (opacité 0, décalage)
    const carte = image.closest('.carte');
    if (carte) carte.classList.add('apparition--vue', 'apparition--directe');

    nommerCarte(image);
    retourEnCours = true;

    // Fin de la transition (réussie ou annulée) : la carte rend son nom, sinon le prochain filtrage
    // ou le prochain clic nommerait deux éléments pareil
    const terminer = () => {
      if (!retourEnCours) return; // un départ a déjà repris la main
      retourEnCours = false;
      retirerNoms();
    };
    transition.finished.then(terminer, terminer);
  });

  // pageshow : page restaurée par bfcache avec les noms encore posés, on les retire
  // (sauf si un retour animé vient de les poser : ils partiront à la fin de sa transition)
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted || retourEnCours) return;

    retirerNoms();
  });
}


/* ==========================================================================
   Titre d'accueil : « PORTFOLIO » arrive lettre par lettre
   ========================================================================== */

// Découpe le titre en un span par lettre (animés en CSS). Le texte complet reste lu une
// seule fois, en entier, par les lecteurs d'écran : les lettres leur sont cachées.
function initTitreLettres() {
  const titre = document.querySelector('.hero .titre-xl');
  if (!titre) return;

  // Mouvement réduit : le titre reste d'un bloc, affiché d'emblée
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const texte = titre.textContent.trim();

  const lettres = document.createElement('span');
  lettres.className = 'titre-xl__lettres';
  lettres.setAttribute('aria-hidden', 'true');

  // Rang de chaque lettre : le délai de son arrivée en dépend (CSS)
  Array.from(texte).forEach((caractere, rang) => {
    const lettre = document.createElement('span');
    lettre.className = 'titre-xl__lettre';
    lettre.textContent = caractere;
    lettre.style.setProperty('--i', rang);
    lettres.append(lettre);
  });

  // Texte complet, masqué visuellement (classe utilitaire de style.css)
  const complet = document.createElement('span');
  complet.className = 'visuellement-masque';
  complet.textContent = texte;

  titre.replaceChildren(complet, lettres);
}


/* ==========================================================================
   Préchargement : la page projet se prépare dès le survol d'une carte (Speculation Rules).
   Le navigateur la charge et l'exécute en arrière-plan, cachée ; au clic elle s'affiche
   d'un coup, grande image du bandeau déjà chargée, et la transition entre pages a de quoi
   se jouer. Sans prise en charge, rien ne change : la page se charge au clic comme avant.
   ========================================================================== */

// Exécute l'action quand la page est vraiment affichée : aussitôt en navigation normale,
// à l'activation (événement prerenderingchange) si la page est pré-rendue en arrière-plan.
// Évite de jouer une animation d'entrée devant personne.
function quandAffichee(action) {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', () => action(), { once: true });
  } else {
    action();
  }
}

// Page pré-rendue : ses animations CSS d'entrée (titre et voile du bandeau, lettres du titre,
// contact…) attendent l'affichage. La classe prerendu les met en pause (voir style.css) ;
// elle est retirée à l'activation, et elles partent alors depuis le début.
function initPrerendu() {
  if (!document.prerendering) return;

  const racine = document.documentElement;
  racine.classList.add('prerendu');
  quandAffichee(() => racine.classList.remove('prerendu'));
}

function initPrechargement() {
  // Navigateur sans Speculation Rules : pas de préchargement, la navigation reste normale
  if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'))) return;

  const regles = {
    // Cartes : pré-rendu complet dès le survol (environ 200 ms à la souris) ou l'appui, avant le clic
    prerender: [{
      where: { selector_matches: '.carte a' },
      eagerness: 'moderate'
    }],
    // Liens du menu : simple préchargement du document, seulement à l'appui (rien n'est gaspillé au survol)
    prefetch: [{
      where: { selector_matches: '.menu__liste a, .entete__identite' },
      eagerness: 'conservative'
    }]
  };

  // Posé par le script plutôt qu'écrit dans chaque page : les ~30 pages n'ont rien à porter
  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify(regles);
  document.head.append(script);
}


/* ==========================================================================
   Galeries « Pinterest » : colonnes de même largeur, chaque image à son format,
   posée dans la colonne la plus courte (la plus à gauche à égalité)
   ========================================================================== */

// Répartition pure : hauteurs des éléments (dans l'ordre de la page) → colonne et position haute de chacun.
// La hauteur rendue est celle de la plus longue colonne, sans la gouttière qui suit son dernier élément.
function repartirEnColonnes(hauteurs, nbColonnes, gouttiere) {
  const colonnes = new Array(nbColonnes).fill(0);
  const positions = hauteurs.map((hauteur) => {
    const colonne = colonnes.indexOf(Math.min(...colonnes));
    const haut = colonnes[colonne];
    colonnes[colonne] += hauteur + gouttiere;
    return { colonne, haut };
  });
  return { positions, hauteur: hauteurs.length ? Math.max(...colonnes) - gouttiere : 0 };
}

// Autant de colonnes que la largeur minimale le permet, comme Pinterest ; jamais moins de 2
function nombreDeColonnes(largeur, largeurMin, gouttiere) {
  return Math.max(2, Math.floor((largeur + gouttiere) / (largeurMin + gouttiere)));
}

// Format (largeur / hauteur) d'un élément : style="--ratio: …" écrit par l'outil dimensions.mjs.
// Lu une fois puis gardé dans data-ratio, car le style de l'élément est réécrit au placement.
function formatDe(element) {
  if (!element.dataset.ratio) {
    const lu = (element.getAttribute('style') || '').match(/--ratio:\s*([\d.]+)/);
    element.dataset.ratio = lu ? lu[1] : '';
  }
  return parseFloat(element.dataset.ratio) || 0;
}

function placerGalerie(galerie) {
  const largeur = galerie.clientWidth;
  if (!largeur) return; // page pas encore mise en page : on attendra le redimensionnement

  const styles = getComputedStyle(galerie);
  const gouttiere = parseFloat(styles.columnGap) || 0;
  const largeurMin = parseFloat(styles.getPropertyValue('--colonne-min')) || 400;
  const nbColonnes = nombreDeColonnes(largeur, largeurMin, gouttiere);
  const colonne = (largeur - gouttiere * (nbColonnes - 1)) / nbColonnes;

  galerie.classList.add('galerie--pinterest');
  const elements = Array.from(galerie.children);
  elements.forEach((element) => { element.style.width = `${colonne}px`; });

  // Images : hauteur connue d'avance par leur format (rien ne bouge au chargement) ; vidéos : mesurées
  const hauteurs = elements.map((element) => {
    const format = formatDe(element);
    return format > 0 ? colonne / format : element.offsetHeight;
  });

  const { positions, hauteur } = repartirEnColonnes(hauteurs, nbColonnes, gouttiere);
  positions.forEach(({ colonne: rang, haut }, i) => {
    elements[i].style.left = `${rang * (colonne + gouttiere)}px`;
    elements[i].style.top = `${haut}px`;
  });
  galerie.style.height = `${hauteur}px`;
}

function initGaleries() {
  // Rendues publiques, comme fermerMenu : la répartition se vérifie et se rejoue de l'extérieur
  Object.assign(window, { repartirEnColonnes, nombreDeColonnes, placerGalerie });

  document.querySelectorAll('.galerie').forEach((galerie) => {
    placerGalerie(galerie);

    if (!window.ResizeObserver) {
      window.addEventListener('resize', () => placerGalerie(galerie));
      return;
    }

    // Largeur changée (fenêtre, rotation du téléphone) : nouvelle répartition.
    // La hauteur, que le placement change lui-même, est ignorée.
    let largeurConnue = galerie.clientWidth;
    new ResizeObserver(() => {
      if (galerie.clientWidth === largeurConnue) return;
      largeurConnue = galerie.clientWidth;
      placerGalerie(galerie);
    }).observe(galerie);

    // Vidéo : sa hauteur n'est connue qu'après le chargement de ses métadonnées
    const videos = galerie.querySelectorAll('.galerie__video');
    if (videos.length) {
      const observateur = new ResizeObserver(() => placerGalerie(galerie));
      videos.forEach((video) => observateur.observe(video));
    }
  });
}


/* ==========================================================================
   Lecteur vidéo : panneau translucide en bas de la vidéo (façon iOS)
   Barre de progression, temps écoulé / restant, vitesse, recul et avance de 10 s,
   lecture / pause, AirPlay (Safari) ou image dans l'image, plein écran.
   Sans script, la vidéo garde les commandes natives du navigateur.
   ========================================================================== */

// 250 → « 04:10 » ; au-delà d'une heure : 3725 → « 1:02:05 »
function formatTemps(secondes) {
  const total = Number.isFinite(secondes) && secondes > 0 ? Math.floor(secondes) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const deux = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`;
}

const ICONES_LECTEUR = {
  lire: '<path d="M8 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 8 4.5z"/>',
  pause: '<rect x="5" y="3.5" width="5" height="17" rx="1.5"/><rect x="14" y="3.5" width="5" height="17" rx="1.5"/>',
  recul: '<rect x="4" y="5" width="2.5" height="14" rx="1"/><path d="M20 5.9v12.2a.9.9 0 0 1-1.4.75L9.6 12.75a.9.9 0 0 1 0-1.5l9-6.1A.9.9 0 0 1 20 5.9z"/>',
  avance: '<rect x="17.5" y="5" width="2.5" height="14" rx="1"/><path d="M4 5.9v12.2a.9.9 0 0 0 1.4.75l9-6.1a.9.9 0 0 0 0-1.5l-9-6.1A.9.9 0 0 0 4 5.9z"/>',
  airplay: '<path d="M7 17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 14l5 6.5H7z"/>',
  incrustation: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="11" width="7" height="6" rx="1"/>',
  pleinEcran: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

const VITESSES = [1, 1.25, 1.5, 2, 0.5];

function initLecteurs() {
  window.formatTemps = formatTemps; // rendue publique, comme fermerMenu

  document.querySelectorAll('.galerie__video video').forEach((video) => {
    const icone = (nom) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONES_LECTEUR[nom]}</svg>`;
    const creer = (balise, classe, attributs = {}) => {
      const element = document.createElement(balise);
      element.className = `lecteur__${classe}`;
      Object.entries(attributs).forEach(([nom, valeur]) => element.setAttribute(nom, valeur));
      return element;
    };
    const bouton = (classe, libelle, nomIcone) => {
      const b = creer('button', classe, { type: 'button', 'aria-label': libelle });
      if (nomIcone) b.innerHTML = icone(nomIcone);
      return b;
    };

    // Enveloppe : la vidéo et son panneau
    const lecteur = document.createElement('div');
    lecteur.className = 'lecteur';
    video.before(lecteur);
    lecteur.append(video);
    video.removeAttribute('controls');

    const progression = creer('input', 'progression', {
      type: 'range', min: '0', max: '0', step: '0.1', value: '0', 'aria-label': 'Position dans la vidéo',
    });
    const vitesse = bouton('vitesse', 'Vitesse de lecture');
    vitesse.textContent = '1.0×';
    const ecoule = creer('span', 'ecoule');
    const restant = creer('span', 'restant');
    const temps = creer('div', 'temps');
    temps.append(ecoule, restant);

    // À gauche : AirPlay sur Safari, sinon image dans l'image, sinon rien
    let diffusion = null;
    if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
      diffusion = bouton('diffusion', 'AirPlay', 'airplay');
      diffusion.addEventListener('click', () => video.webkitShowPlaybackTargetPicker());
    } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
      diffusion = bouton('diffusion', 'Image dans l’image', 'incrustation');
      diffusion.addEventListener('click', () => {
        const action = document.pictureInPictureElement === video
          ? document.exitPictureInPicture()
          : video.requestPictureInPicture();
        action.catch(() => {});
      });
    }

    const recul = bouton('recul', 'Reculer de 10 secondes', 'recul');
    const lecture = bouton('lecture', 'Lire', 'lire');
    const avance = bouton('avance', 'Avancer de 10 secondes', 'avance');
    const pleinEcran = bouton('plein-ecran', 'Plein écran', 'pleinEcran');

    const commandes = creer('div', 'commandes');
    commandes.append(diffusion || creer('span', 'vide'), recul, lecture, avance, pleinEcran);

    const panneau = creer('div', 'panneau');
    panneau.append(progression, vitesse, temps, commandes);

    // État réduit (par défaut) : pastille lecture / pause dans le coin et fil de progression en bas
    const mini = bouton('mini', 'Lire', 'lire');
    const fil = creer('div', 'fil', { 'aria-hidden': 'true' });
    lecteur.append(fil, mini, panneau);

    // --- État affiché ---
    const duree = () => (Number.isFinite(video.duration) ? video.duration : 0);
    const majTemps = () => {
      const position = video.currentTime || 0;
      progression.max = String(duree());
      progression.value = String(position);
      lecteur.style.setProperty('--progression', `${duree() ? (position / duree()) * 100 : 0}%`);
      ecoule.textContent = formatTemps(position);
      restant.textContent = `-${formatTemps(duree() - position)}`;
    };
    const majLecture = () => {
      const enPause = video.paused;
      [lecture, mini].forEach((b) => {
        b.setAttribute('aria-label', enPause ? 'Lire' : 'Pause');
        b.innerHTML = icone(enPause ? 'lire' : 'pause');
      });
      lecteur.classList.toggle('lecteur--pause', enPause);
    };
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'].forEach((type) => video.addEventListener(type, majTemps));
    ['play', 'pause', 'ended'].forEach((type) => video.addEventListener(type, majLecture));

    // --- Actions ---
    const basculer = () => {
      if (video.paused) {
        const promesse = video.play();
        if (promesse && promesse.catch) promesse.catch(() => {});
      } else {
        video.pause();
      }
    };
    const deplacer = (secondes) => {
      video.currentTime = Math.min(Math.max((video.currentTime || 0) + secondes, 0), duree() || Infinity);
    };
    lecture.addEventListener('click', basculer);
    mini.addEventListener('click', basculer);
    recul.addEventListener('click', () => deplacer(-10));
    avance.addEventListener('click', () => deplacer(10));
    progression.addEventListener('input', () => {
      video.currentTime = Number(progression.value);
    });
    vitesse.addEventListener('click', () => {
      const suivante = VITESSES[(VITESSES.indexOf(video.playbackRate) + 1) % VITESSES.length] ?? 1;
      video.playbackRate = suivante;
      vitesse.textContent = `${suivante.toFixed(suivante % 0.5 ? 2 : 1)}×`;
    });
    pleinEcran.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (lecteur.requestFullscreen) lecteur.requestFullscreen().catch(() => {});
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone : plein écran natif
    });

    // --- Réduit par défaut ; déployé au survol, au toucher ou au clavier ---
    // Il se réduit dès que la souris sort, ou après 2,5 s sans geste (sauf si le focus est dedans).
    let minuteur = null;
    const reduire = () => {
      clearTimeout(minuteur);
      lecteur.classList.remove('lecteur--deploye');
    };
    const deployer = () => {
      lecteur.classList.add('lecteur--deploye');
      clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        if (!lecteur.contains(document.activeElement)) reduire();
      }, 2500);
    };
    lecteur.addEventListener('pointermove', deployer);
    lecteur.addEventListener('pointerleave', (evenement) => {
      if (evenement.pointerType !== 'touch') reduire();
    });
    lecteur.addEventListener('focusin', deployer);
    // Le focus part ailleurs (Tab, clic hors du lecteur) : réduit tout de suite
    lecteur.addEventListener('focusout', (evenement) => {
      if (!lecteur.contains(evenement.relatedTarget)) reduire();
    });
    // Toucher ou clic ailleurs dans la page (au doigt, pointerleave n'arrive pas) : réduit tout de suite
    document.addEventListener('pointerdown', (evenement) => {
      if (!lecteur.contains(evenement.target)) reduire();
    });
    // Clic sur l'image : réduit, elle déploie le lecteur (au doigt) ; déployé, lecture / pause
    video.addEventListener('click', () => {
      if (lecteur.classList.contains('lecteur--deploye')) {
        basculer();
        deployer();
      } else {
        deployer();
      }
    });

    majTemps();
    majLecture();
  });
}


/* ==========================================================================
   Page 404 : images des projets, tirées au hasard, en traînée derrière la souris
   ========================================================================== */

// Chaque fois que le pointeur a parcouru assez de chemin, une image de projet apparaît dessous puis
// s'efface en se floutant (animation CSS). Les images viennent de la grille de l'accueil.
function initTrainee() {
  const zone = document.querySelector('main[data-trainee]');
  if (!zone) return;
  // Moins de mouvement : pas de traînée, la page reste simple
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.fetch || !window.DOMParser) return;

  const SEUIL = 180; // px parcourus entre deux images
  const MAXIMUM = 6; // images à l'écran au plus

  const calque = document.createElement('div');
  calque.className = 'trainee';
  calque.setAttribute('aria-hidden', 'true');
  document.body.append(calque);

  let sources = [];
  // Chemins absolus : la 404 est servie à n'importe quelle profondeur d'adresse
  const accueil = new URL('/index.html', location.href);
  fetch(accueil.href)
    .then((reponse) => (reponse.ok ? reponse.text() : Promise.reject(new Error(String(reponse.status)))))
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      sources = Array.from(doc.querySelectorAll('.grille-projets .carte img'),
        (img) => new URL(img.getAttribute('src'), accueil).pathname);
    })
    .catch(() => {});

  let dernierX = null;
  let dernierY = null;
  let dernier = -1;
  let prechargee = null;

  // Tirage au hasard, jamais deux fois de suite la même image ; la suivante est préchargée
  const tirer = () => {
    let rang;
    do rang = Math.floor(Math.random() * sources.length);
    while (rang === dernier && sources.length > 1);
    return rang;
  };

  document.addEventListener('pointermove', (evenement) => {
    if (!sources.length) return;
    const { clientX: x, clientY: y } = evenement;
    if (dernierX !== null && Math.hypot(x - dernierX, y - dernierY) < SEUIL) return;
    dernierX = x;
    dernierY = y;

    dernier = prechargee ?? tirer();
    prechargee = null;

    const image = document.createElement('img');
    image.className = 'trainee__image';
    image.alt = '';
    image.decoding = 'async';
    image.src = sources[dernier];
    image.style.left = `${x}px`;
    image.style.top = `${y}px`;
    // Taille au hasard : entre 60 % et 100 % de la taille de base (style.css)
    image.style.setProperty('--echelle', (0.6 + Math.random() * 0.4).toFixed(2));
    image.addEventListener('animationend', () => image.remove());
    calque.append(image);
    while (calque.children.length > MAXIMUM) calque.firstElementChild.remove();

    prechargee = tirer();
    new Image().src = sources[prechargee];
  });
}


/* ==========================================================================
   Lien d'évitement : premier arrêt de la touche Tab, il saute l'en-tête et le menu
   ========================================================================== */

// Posé par le script plutôt qu'écrit dans chaque page, comme les règles de préchargement
function initEvitement() {
  const principal = document.querySelector('main');
  if (!principal) return;
  if (!principal.id) principal.id = 'contenu';

  const lien = document.createElement('a');
  lien.className = 'evitement';
  lien.href = `#${principal.id}`;
  lien.textContent = 'Aller au contenu';
  document.body.prepend(lien);
}


/* ==========================================================================
   Projets voisins : précédent / tous les projets / suivant, en bas des pages projet
   ========================================================================== */

// L'ordre vient de la grille de l'accueil (seule liste des projets à tenir à jour) ; la suite boucle,
// comme la visionneuse. Une sous-page absente de la grille garde seulement « Tous les projets ».
function initVoisins() {
  const conteneur = document.querySelector('main.projet > .conteneur');
  if (!conteneur) return;

  // « /page », « /page.html » et « page.html » désignent la même page
  const chemin = (adresse) => new URL(adresse, location.href).pathname.split('/').pop().replace(/\.html$/, '');

  const lienVoisin = (projet, sens) => {
    const lien = document.createElement('a');
    lien.className = `voisins__lien voisins__lien--${sens === 'prev' ? 'precedent' : 'suivant'}`;
    lien.href = projet.href;
    lien.rel = sens;
    const libelle = document.createElement('span');
    libelle.className = 'voisins__sens';
    libelle.innerHTML = sens === 'prev'
      ? '<span class="voisins__fleche" aria-hidden="true">←</span> Projet précédent'
      : 'Projet suivant <span class="voisins__fleche" aria-hidden="true">→</span>';
    const nom = document.createElement('span');
    nom.className = 'voisins__nom';
    nom.textContent = projet.nom;
    lien.append(libelle, nom);
    return lien;
  };

  const construire = (projets) => {
    const nav = document.createElement('nav');
    nav.className = 'voisins';
    nav.setAttribute('aria-label', 'Autres projets');

    const tous = document.createElement('a');
    tous.className = 'voisins__tous';
    tous.href = 'index.html#projets';
    tous.textContent = 'Tous les projets';

    const ici = chemin(location.href);
    const rang = projets.findIndex((projet) => chemin(projet.href) === ici);
    if (rang !== -1 && projets.length > 1) {
      const total = projets.length;
      nav.append(
        lienVoisin(projets[(rang - 1 + total) % total], 'prev'),
        tous,
        lienVoisin(projets[(rang + 1) % total], 'next')
      );
    } else {
      nav.append(tous);
    }
    conteneur.append(nav);
  };

  // Hors ligne, en file:// ou navigateur ancien : la navigation se réduit à « Tous les projets »
  if (!window.fetch || !window.DOMParser) {
    construire([]);
    return;
  }

  fetch('index.html')
    .then((reponse) => (reponse.ok ? reponse.text() : Promise.reject(new Error(String(reponse.status)))))
    .then((html) => {
      const accueil = new DOMParser().parseFromString(html, 'text/html');
      return Array.from(accueil.querySelectorAll('.grille-projets .carte a'), (a) => ({
        href: a.getAttribute('href'),
        nom: (a.querySelector('.carte__nom')?.textContent ?? '').trim(),
      }));
    })
    .catch(() => [])
    .then(construire);
}


/* ==========================================================================
   Démarrage
   ========================================================================== */

// iOS n'applique :active (retour visuel à l'appui : menu, contact) que si la page écoute touchstart
document.addEventListener('touchstart', () => {}, { passive: true });

initEvitement();
initMenu();
initVoisins();
initTrainee();
initLecteurs(); // avant les galeries : la vidéo est enveloppée dans son lecteur avant d'être mesurée
initGaleries();
initAnnees(); // avant les filtres, qui masquent les repères sans carte
initFiltres();
initVisionneuse();
initApparitions();
initFonduImages();
initTransitionPages();
initTitreLettres();
initPrerendu(); // page pré-rendue : animations d'entrée en pause jusqu'à l'affichage
initPrechargement();
