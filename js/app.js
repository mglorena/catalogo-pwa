const { addLink, updateLink, deleteLink, getAllLinks } = window.CatalogoDB;
const { detectPlatform, extractUrlFromText } = window.CatalogoPlatform;

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty-state'),
  search: document.getElementById('search'),
  fab: document.getElementById('fab-add'),
  modal: document.getElementById('modal'),
  form: document.getElementById('link-form'),
  formTitle: document.getElementById('form-title'),
  url: document.getElementById('field-url'),
  platformBadge: document.getElementById('platform-badge'),
  tema: document.getElementById('field-tema'),
  descripcion: document.getElementById('field-descripcion'),
  cancelBtn: document.getElementById('cancel-btn'),
  deleteBtn: document.getElementById('delete-btn'),
};

let allLinks = [];
let editingId = null;

function init() {
  registerServiceWorker();
  bindEvents();
  handleSharedData();
  loadAndRender();
}

async function loadAndRender() {
  allLinks = await getAllLinks();
  render(els.search.value.trim().toLowerCase());
}

function render(filter = '') {
  const filtered = filter
    ? allLinks.filter((l) =>
        [l.descripcion, l.tema, l.plataforma, l.url]
          .join(' ')
          .toLowerCase()
          .includes(filter)
      )
    : allLinks;

  els.list.innerHTML = '';

  if (filtered.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = allLinks.length === 0
      ? 'Todavía no guardaste ningún enlace. Tocá "+" para agregar el primero.'
      : 'No hay resultados para esa búsqueda.';
    return;
  }
  els.empty.hidden = true;

  const groups = groupByTema(filtered);
  for (const [tema, items] of groups) {
    const section = document.createElement('section');
    section.className = 'group';

    const heading = document.createElement('h2');
    heading.className = 'group-title';
    heading.textContent = `${tema} (${items.length})`;
    section.appendChild(heading);

    const ul = document.createElement('ul');
    ul.className = 'card-list';
    for (const item of items) {
      ul.appendChild(renderCard(item));
    }
    section.appendChild(ul);
    els.list.appendChild(section);
  }
}

function groupByTema(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.tema || 'Sin categoría';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

function renderCard(item) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.id = item.id;

  const platform = detectPlatform(item.url);

  li.innerHTML = `
    <div class="card-top">
      <span class="platform-chip">${platform.icon} ${platform.label}</span>
      <button class="icon-btn edit-btn" aria-label="Editar" type="button">✏️</button>
    </div>
    <a class="card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
    ${item.descripcion ? `<p class="card-desc">${escapeHtml(item.descripcion)}</p>` : ''}
  `;

  li.querySelector('.edit-btn').addEventListener('click', () => openEditModal(item));
  return li;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindEvents() {
  els.search.addEventListener('input', () => render(els.search.value.trim().toLowerCase()));

  els.fab.addEventListener('click', () => openAddModal());

  els.url.addEventListener('input', () => updatePlatformBadge());

  els.cancelBtn.addEventListener('click', closeModal);

  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });

  els.form.addEventListener('submit', onSubmit);

  els.deleteBtn.addEventListener('click', async () => {
    if (editingId && confirm('¿Eliminar este enlace?')) {
      await deleteLink(editingId);
      closeModal();
      loadAndRender();
    }
  });
}

function updatePlatformBadge() {
  const p = detectPlatform(els.url.value.trim());
  els.platformBadge.textContent = `${p.icon} ${p.label}`;
}

function openAddModal(prefillUrl = '') {
  editingId = null;
  els.formTitle.textContent = 'Nuevo enlace';
  els.deleteBtn.hidden = true;
  els.form.reset();
  els.url.value = prefillUrl;
  updatePlatformBadge();
  els.modal.showModal();
  if (!prefillUrl) {
    els.url.focus();
  } else {
    els.tema.focus();
  }
}

function openEditModal(item) {
  editingId = item.id;
  els.formTitle.textContent = 'Editar enlace';
  els.deleteBtn.hidden = false;
  els.url.value = item.url;
  els.tema.value = item.tema;
  els.descripcion.value = item.descripcion;
  updatePlatformBadge();
  els.modal.showModal();
}

function closeModal() {
  els.modal.close();
  editingId = null;
}

async function onSubmit(e) {
  e.preventDefault();
  const url = els.url.value.trim();
  if (!url) return;

  const platform = detectPlatform(url);
  const data = {
    url,
    plataforma: platform.id,
    tema: els.tema.value.trim() || 'Sin categoría',
    descripcion: els.descripcion.value.trim(),
  };

  if (editingId) {
    await updateLink(editingId, data);
  } else {
    await addLink(data);
  }

  closeModal();
  loadAndRender();
}

// Cuando la app se abre como Share Target de Android, la URL compartida
// llega como parámetros de búsqueda (?title=&text=&url=).
function handleSharedData() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl = params.get('url');
  const sharedText = params.get('text');
  const sharedTitle = params.get('title');

  const raw = sharedUrl || sharedText || sharedTitle;
  if (!raw) return;

  const url = extractUrlFromText(raw);

  // Limpiamos la URL para no reabrir el modal si el usuario recarga.
  window.history.replaceState({}, document.title, window.location.pathname);

  if (url) {
    openAddModal(url);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.error('Error registrando el Service Worker:', err);
      });
    });
  }
}

init();
