// Wrapper simple sobre IndexedDB: enlaces guardados + categorías.
const DB_NAME = 'catalogo-db';
const DB_VERSION = 2;
const STORE_LINKS = 'links';
const STORE_CATEGORIES = 'categories';

const DEFAULT_CATEGORIES = ['Recetas', 'Cerámica', 'Otras'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;

      let linkStore;
      if (!db.objectStoreNames.contains(STORE_LINKS)) {
        linkStore = db.createObjectStore(STORE_LINKS, { keyPath: 'id', autoIncrement: true });
        linkStore.createIndex('tema', 'tema', { unique: false });
        linkStore.createIndex('plataforma', 'plataforma', { unique: false });
        linkStore.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        linkStore = tx.objectStore(STORE_LINKS);
      }

      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id', autoIncrement: true });
        catStore.createIndex('nombre', 'nombre', { unique: true });

        // Primera instalación: sembramos algunas categorías de ejemplo.
        // Si ya había enlaces guardados (upgrade desde v1), en vez de eso
        // reconstruimos las categorías a partir de los temas existentes.
        const getAllReq = linkStore.getAll();
        getAllReq.onsuccess = () => {
          const existingLinks = getAllReq.result || [];
          const names = existingLinks.length
            ? [...new Set(existingLinks.map((l) => l.tema).filter(Boolean))]
            : DEFAULT_CATEGORIES;
          for (const nombre of names) {
            catStore.add({ nombre, createdAt: Date.now() });
          }
        };
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function addLink(link) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LINKS, 'readwrite');
    const store = tx.objectStore(STORE_LINKS);
    const record = {
      url: link.url,
      plataforma: link.plataforma,
      tema: link.tema || 'Sin categoría',
      descripcion: link.descripcion || '',
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

async function updateLink(id, changes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LINKS, 'readwrite');
    const store = tx.objectStore(STORE_LINKS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        reject(new Error('Registro no encontrado'));
        return;
      }
      const updated = { ...existing, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteLink(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LINKS, 'readwrite');
    const req = tx.objectStore(STORE_LINKS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllLinks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LINKS, 'readonly');
    const req = tx.objectStore(STORE_LINKS).getAll();
    req.onsuccess = () => {
      const items = req.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllCategories() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readonly');
    const req = tx.objectStore(STORE_CATEGORIES).getAll();
    req.onsuccess = () => {
      const items = (req.result || []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

// Crea la categoría si no existe todavía (comparación sin distinguir mayúsculas).
// Devuelve siempre el nombre "canónico" ya guardado para esa categoría.
async function ensureCategory(nombre) {
  const clean = (nombre || '').trim();
  if (!clean) return null;

  const existing = await getAllCategories();
  const match = existing.find((c) => c.nombre.toLowerCase() === clean.toLowerCase());
  if (match) return match.nombre;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
    const req = tx.objectStore(STORE_CATEGORIES).add({ nombre: clean, createdAt: Date.now() });
    req.onsuccess = () => resolve(clean);
    req.onerror = () => reject(req.error);
  });
}

window.CatalogoDB = {
  addLink,
  updateLink,
  deleteLink,
  getAllLinks,
  getAllCategories,
  ensureCategory,
};
