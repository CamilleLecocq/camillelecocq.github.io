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

    // La grille connaît le filtre actif : sous « Affiches », les cartes prennent le format des affiches (CSS)
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
      changerSource(image, qualiteVisionneuse(lien).url);
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

  // Affiche l’image n° i du parcours (en boucle), dans sa qualité, avec son texte alternatif
  function afficher(i) {
    fermerMenu();
    indice = (i + liens.length) % liens.length;
    const lien = liens[indice];
    const miniature = lien.querySelector('img');
    jetons.delete(image); // abandonne un éventuel téléchargement de l’image précédente
    image.removeAttribute('aria-busy');
    image.setAttribute('src', qualiteVisionneuse(lien).url);
    image.setAttribute('alt', (miniature && miniature.getAttribute('alt')) || '');
    construireBoutonsQualite();
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
   Démarrage
   ========================================================================== */

// iOS n'applique :active (retour visuel à l'appui : menu, contact) que si la page écoute touchstart
document.addEventListener('touchstart', () => {}, { passive: true });

initMenu();
initAnnees(); // avant les filtres, qui masquent les repères sans carte
initFiltres();
initVisionneuse();
