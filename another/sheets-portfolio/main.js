const sheets = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzzWM2iSJoxGFXY4fR-K2RYXjFMfzLdnvXXrfalIhAw4WN39VhBkfEnDI6X7BF9bcSde2pG00W5ciV/pub?output=csv";

// Fonction pour normaliser les noms de fichiers
const sanitizeName = (name) => {
  const accentsMap = new Map([
    ['á', 'a'], ['à', 'a'], ['â', 'a'], ['ä', 'a'], ['ã', 'a'], ['å', 'a'], ['é', 'e'],
    ['è', 'e'], ['ê', 'e'], ['ë', 'e'], ['í', 'i'], ['ì', 'i'], ['î', 'i'], ['ï', 'i'],
    ['ó', 'o'], ['ò', 'o'], ['ô', 'o'], ['ö', 'o'], ['õ', 'o'], ['ø', 'o'], ['ú', 'u'],
    ['ù', 'u'], ['û', 'u'], ['ü', 'u'], ['ý', 'y'], ['ÿ', 'y'], ['ñ', 'n'], ['ç', 'c']
  ]);
  let sanitized = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  sanitized = Array.from(sanitized).map(char => accentsMap.get(char) || char).join('');
  return sanitized.replace(/[^A-Za-z0-9_\-]/g, '_');
};

// Conversion CSV en JSON
const csvToJson = (csvString) => {
  try {
    const lines = [];
    let currentLine = '';
    let insideQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
      const char = csvString[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
        currentLine += char;
      } else if (char === '\n' && !insideQuotes) {
        lines.push(currentLine);
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    const headers = lines[0].split(',').map(header => header.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const values = [];
      let currentValue = '';
      let inQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue);
          currentValue = '';
        } else {
          currentValue += char;
        }
      }

      values.push(currentValue);

      const obj = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        value = value.replace(/\r/g, '');

        if (value.includes('\n')) {
          value = value.split('\n').map(line => `<p>${line.trim()}</p>`).join('');
        }

        obj[header] = value;
      });

      result.push(obj);
    }

    return result;
  } catch (error) {
    console.error("Erreur lors de la conversion CSV en JSON:", error);
    return [];
  }
};

// Fetch et conversion CSV en JSON
const response = await fetch(sheets);
const csvText = await response.text();
const json = csvToJson(csvText);

const $projets = document.querySelector(".projets");

// Affichage des éléments
json.forEach((item) => {
  spawnElement(item);
});

function spawnElement(item) {
  const div = document.createElement("div");
  div.classList.add("element");

  const borderDiv = document.createElement("div");
  borderDiv.classList.add("border-animate");
  div.appendChild(borderDiv);

  // Remplacement de l'image
  const dossier = sanitizeName(item.titre); // Titre du projet pour nom de dossier
  const img = document.createElement("img");
  img.setAttribute("width", "200");
  img.setAttribute("height", "200");
  img.src = `img/${dossier}/${dossier}.png`;  // Ici on spécifie le chemin avec sous-dossier
  div.appendChild(img);

  $projets.appendChild(div);

  // Mouvement rebond avec pause au hover
  let x = gsap.utils.random(0, window.innerWidth - div.offsetWidth);
  let y = gsap.utils.random(0, window.innerHeight - div.offsetHeight);
  let vx = gsap.utils.random(-1.5, 1.5);
  let vy = gsap.utils.random(-1.5, 1.5);
  let paused = false;

  gsap.set(div, { x, y });

  gsap.ticker.add(() => {
    if (paused) return;

    x += vx;
    y += vy;

    const w = div.offsetWidth;
    const h = div.offsetHeight;

    if (x <= 0 || x + w >= window.innerWidth) {
      vx *= -1;
      x = Math.max(0, Math.min(window.innerWidth - w, x));
    }

    if (y <= 0 || y + h >= window.innerHeight) {
      vy *= -1;
      y = Math.max(0, Math.min(window.innerHeight - h, y));
    }

    gsap.set(div, { x, y });
  });

  div.addEventListener("mouseenter", () => paused = true);
  div.addEventListener("mouseleave", () => paused = false);

  // Modale
  div.addEventListener("click", () => {
    const header = document.querySelector("header");
    header.classList.add("fixed");

    const projets = document.querySelector(".projets");
    projets.classList.add("fixed");

    const overlay = document.createElement("div");
    overlay.classList.add("overlay");
    document.body.appendChild(overlay);

    const wrap = document.createElement("div");
    wrap.classList.add("wrap");
    overlay.appendChild(wrap);

    const fiche = document.createElement("div");
    fiche.classList.add("fiche");
    wrap.appendChild(fiche);

    const close = document.createElement("div");
    close.textContent = "×";
    close.classList.add("close");
    overlay.appendChild(close);

    close.addEventListener("click", () => {
      gsap.to(overlay, { opacity: 0, duration: 1, onComplete: () => overlay.remove() });
      header.classList.remove("fixed");
      projets.classList.remove("fixed");
      document.body.style.overflow = ""; // Réactiver le scroll
    });

    // 🖼️ Créer la grille d'images
    const imagesWrap = document.createElement("div");
    imagesWrap.classList.add("images-grid");
    fiche.appendChild(imagesWrap);

    const images = (item.images || "").split(',').map(imgName => imgName.trim());

    images.forEach(imgName => {
      if (imgName) {
        const img = document.createElement("img");
        img.src = `img/${dossier}/${imgName}`; // On utilise ici le sous-dossier pour chaque projet
        imagesWrap.appendChild(img);
      }
    });

    const titre = document.createElement("h1");
    titre.textContent = item.titre;
    fiche.appendChild(titre);
    const text = SplitType.create(titre);
    gsap.from(text.chars, { y: -50, duration: 0.4, stagger: 0.1 });

    const desc = document.createElement("div");
    desc.innerHTML = item.modale;
    fiche.appendChild(desc);

    gsap.from(overlay, { opacity: 0, duration: 0.4 });

    // Autoriser le scroll uniquement si la modale dépasse de l'écran
    if (fiche.offsetHeight > window.innerHeight) {
      document.body.style.overflow = "auto";
    } else {
      document.body.style.overflow = "hidden";
    }
  });
}

// Animation titre header
const headerTitle = document.querySelector(".header h1");
new SplitType(headerTitle, { types: 'chars' });

document.querySelectorAll(".header .char").forEach(char => {
  char.addEventListener("mouseenter", () => {
    char.classList.add("visible");

    const moveGradient = (e) => {
      const x = e.clientX;
      const y = e.clientY;

      gsap.to(document.body, {
        background: `radial-gradient(circle at ${x}px ${y}px, #d5f2e3, #20139c)`,
        duration: 0.5
      });
    };

    document.addEventListener("mousemove", moveGradient);

    char.addEventListener("mouseleave", () => {
      document.removeEventListener("mousemove", moveGradient);
    });
  });
});
