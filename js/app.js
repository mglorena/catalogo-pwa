const { addLink, updateLink, deleteLink, getAllLinks, getAllCategories, ensureCategory } = window.CatalogoDB;
const { detectPlatform, extractUrlFromText } = window.CatalogoPlatform;

const NEW_CATEGORY_VALUE = '__new__';

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty-state'),
  search: document.getElementById('search'),
  chips: document.getElementById('category-chips'),
  fab: document.getElementById('fab-add'),
  modal: document.getElementById('modal'),
  form: document.getElementById('link-form'),
  formTitle: document.getElementById('form-title'),
  url: document.getElementById('field-url'),
  platformBadge: document.getElementById('platform-badge'),
  temaSelect: document.getElementById('field-tema-select'),
  temaNew: document.getElementById('field-tema-new'),
  descripcion: document.getElementById('field-descripcion'),
  cancelBtn: document.getElementById('cancel-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  errorBanner: document.getElementById('error-banner'),
};

let allLinks = [];
let allCategories = [];
let editingId = null;
let activeCategory = null;

function init() {
  registerServiceWorker();
  bindEvents();
  handleSharedData();
  refreshCategories();
  loadAndRender();
}

function showError(message, err) {
  console.error(message, err || '');
  if (!els.errorBanner) return;
  els.errorBanner.textContent = `⚠️ ${message}`;
  els.errorBanner.hidden = false;
}

async function loadAndRender() {
  try {
    allLinks = await getAllLinks();
    render();
  } catch (err) {
    showError('No se pudieron cargar los enlaces guardados.', err);
  }
}

async function refreshCategories() {
  try {
    allCategories = await getAllCategories();
    renderCategoryChips();
    renderCategorySelect();
  } catch (err) {
    showError('No se pudieron cargar las categorías.', err);
  }
}

function currentFilter() {
  return els.search.value.trim().toLowerCase();
}

function render() {
  const filterText = currentFilter();
  let filtered = allLinks;

  if (activeCategory) {
    filtered = filtered.filter((l) => (l.tema || 'Sin categoría') === activeCategory);
  }
  if (filterText) {
    filtered = filtered.filter((l) =>
      [l.descripcion, l.tema, l.plataforma, l.url]
        .join(' ')
        .toLowerCase()
        .includes(filterText)
    );
  }

  els.list.innerHTML = '';

  if (filtered.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = allLinks.length === 0
      ? 'Todavía no guardaste ningún enlace. Tocá "+" para agregar el primero.'
      : 'No hay resultados con ese filtro.';
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

function renderCategoryChips() {
  els.chips.innerHTML = '';
  if (allCategories.length === 0) return;

  for (const cat of allCategories) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (activeCategory === cat.nombre ? ' chip-active' : '');
    chip.textContent = cat.nombre;
    chip.addEventListener('click', () => {
      activeCategory = activeCategory === cat.nombre ? null : cat.nombre;
      renderCategoryChips();
      render();
    });
    els.chips.appendChild(chip);
  }
}

function renderCategorySelect(selectedValue) {
  els.temaSelect.innerHTML = '';

  for (const cat of allCategories) {
    const opt = document.createElement('option');
    opt.value = cat.nombre;
    opt.textContent = cat.nombre;
    els.temaSelect.appendChild(opt);
  }

  const newOpt = document.createElement('option');
  newOpt.value = NEW_CATEGORY_VALUE;
  newOpt.textContent = '+ Nueva categoría...';
  els.temaSelect.appendChild(newOpt);

  if (selectedValue && allCategories.some((c) => c.nombre === selectedValue)) {
    els.temaSelect.value = selectedValue;
  } else if (allCategories.length > 0) {
    els.temaSelect.value = allCategories[0].nombre;
  } else {
    els.temaSelect.value = NEW_CATEGORY_VALUE;
  }
  syncNewCategoryInput();
}

function syncNewCategoryInput() {
  const isNew = els.temaSelect.value === NEW_CATEGORY_VALUE;
  els.temaNew.hidden = !isNew;
  if (isNew) els.temaNew.focus();
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
  els.search.addEventListener('input', render);

  els.fab.addEventListener('click', () => openAddModal());

  els.url.addEventListener('input', updatePlatformBadge);

  els.temaSelect.addEventListener('change', syncNewCategoryInput);

  els.cancelBtn.addEventListener('click', closeModal);

  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) closeModal();
  });

  els.form.addEventListener('submit', onSubmit);

  els.deleteBtn.addEventListener('click', async () => {
    if (editingId && confirm('¿Eliminar este enlace?')) {
      try {
        await deleteLink(editingId);
        closeModal();
        loadAndRender();
      } catch (err) {
        showError('No se pudo eliminar el enlace.', err);
      }
    }
  });
}

function updatePlatformBadge() {
  const p = detectPlatform(els.url.value.trim());
  els.platformBadge.textContent = `${p.icon} ${p.label}`;
}

function openAddModal(prefillUrl = '', prefillDescripcion = '') {
  editingId = null;
  els.formTitle.textContent = 'Nuevo enlace';
  els.deleteBtn.hidden = true;
  els.form.reset();
  els.url.value = prefillUrl;
  els.descripcion.value = prefillDescripcion;
  renderCategorySelect();
  updatePlatformBadge();
  openModal();
  if (!prefillUrl) {
    els.url.focus();
  }
}

function openEditModal(item) {
  editingId = item.id;
  els.formTitle.textContent = 'Editar enlace';
  els.deleteBtn.hidden = false;
  els.url.value = item.url;
  els.descripcion.value = item.descripcion;
  renderCategorySelect(item.tema);
  updatePlatformBadge();
  openModal();
}

function openModal() {
  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = '';
  editingId = null;
}

async function onSubmit(e) {
  e.preventDefault();
  try {
    const url = els.url.value.trim();
    if (!url) return;

    let tema;
    if (els.temaSelect.value === NEW_CATEGORY_VALUE) {
      const nuevaCategoria = els.temaNew.value.trim();
      if (!nuevaCategoria) {
        els.temaNew.focus();
        return;
      }
      tema = await ensureCategory(nuevaCategoria);
    } else {
      tema = els.temaSelect.value;
    }

    const platform = detectPlatform(url);
    const data = {
      url,
      plataforma: platform.id,
      tema: tema || 'Sin categoría',
      descripcion: els.descripcion.value.trim(),
    };

    if (editingId) {
      await updateLink(editingId, data);
    } else {
      await addLink(data);
    }

    closeModal();
    await refreshCategories();
    await loadAndRender();
  } catch (err) {
    showError('No se pudo guardar el enlace. Probá de nuevo.', err);
  }
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

  console.log('Datos recibidos por share target:', { sharedTitle, sharedText, sharedUrl });

  const url = extractUrlFromText(raw);

  // Si el título no quedó adentro de la URL detectada, lo usamos como
  // descripción inicial (muchas apps mandan el nombre del posteo ahí).
  const descripcion = sharedTitle && sharedTitle !== url ? sharedTitle : '';

  // Limpiamos la URL para no reabrir el modal si el usuario recarga.
  window.history.replaceState({}, document.title, window.location.pathname);

  if (url) {
    openAddModal(url, descripcion);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('Service Worker registrado', reg.scope))
      .catch((err) => showError('No se pudo registrar el modo offline.', err));
  });
}

try {
  init();
} catch (err) {
  showError('La app no pudo iniciar correctamente.', err);
}
