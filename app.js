let familyData = [];
let personMap = new Map();
let currentTransform = { x: 80, y: 80, scale: 1 };
let isDragging = false;
let startPan = { x: 0, y: 0 };

const CARD_WIDTH = 200;
const CARD_HEIGHT = 140;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 120;

// Автономная SVG-заглушка для аватаров (не требует интернета и не вызывает ошибок)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23e2e8f0'/><text x='50%' y='55%' font-size='40' text-anchor='middle' dominant-baseline='middle' fill='%2364748b'>👤</text></svg>";

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadTreeData();
});

// Универсальная загрузка данных (поддерживает и data.js при двойном клике, и data.json на GitHub)
async function loadTreeData() {
  try {
    if (typeof initialFamilyData !== 'undefined' && Array.isArray(initialFamilyData)) {
      familyData = initialFamilyData;
    } else {
      const res = await fetch('data.json');
      familyData = await res.json();
    }
    familyData.forEach(p => personMap.set(p.id, p));

    const countEl = document.getElementById('memberCount');
    if (countEl) countEl.textContent = `${familyData.length} персон`;

    renderTree();
    setupSearch();
  } catch (err) {
    console.error('Ошибка загрузки данных древа:', err);
  }
}

// Отрисовка древа
function renderTree() {
  const nodesContainer = document.getElementById('nodesContainer');
  const svg = document.getElementById('connectionsSvg');
  if (!nodesContainer || !svg) return;

  nodesContainer.innerHTML = '';
  svg.innerHTML = '';

  // Группировка по поколениям
  const generations = {};
  familyData.forEach(p => {
    const gen = p.generation || 1;
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(p);
  });

  const positions = new Map();
  const genKeys = Object.keys(generations).sort((a, b) => a - b);

  let maxRowWidth = 0;
  genKeys.forEach((gen, rowIndex) => {
    const list = generations[gen];
    const rowY = rowIndex * (CARD_HEIGHT + VERTICAL_GAP);

    list.forEach((p, colIndex) => {
      const rowX = colIndex * (CARD_WIDTH + HORIZONTAL_GAP);
      positions.set(p.id, { x: rowX, y: rowY });
      maxRowWidth = Math.max(maxRowWidth, rowX + CARD_WIDTH);
    });
  });

  // Установка размеров рабочего пространства
  const totalHeight = genKeys.length * (CARD_HEIGHT + VERTICAL_GAP) + 200;
  const container = document.getElementById('treeContainer');
  if (container) {
    container.style.width = `${maxRowWidth + 400}px`;
    container.style.height = `${totalHeight}px`;
  }

  // Отрисовка линий связей
  renderConnections(positions, svg);

  // Отрисовка карточек персон
  familyData.forEach(p => {
    const pos = positions.get(p.id);
    if (pos) {
      const card = createPersonCard(p, pos);
      nodesContainer.appendChild(card);
    }
  });

  applyTransform();
}

// Создание карточки персоны
function createPersonCard(person, pos) {
  const card = document.createElement('div');
  card.className = `person-card ${person.gender || 'male'}`;
  card.id = `card-${person.id}`;
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;

  const years = (person.birth || '') + (person.death ? ` — ${person.death}` : (person.birth ? ' — н.в.' : ''));
  const photoSrc = person.photo || DEFAULT_AVATAR;

  // Безопасная вставка изображения с защитой от бесконечного цикла
  card.innerHTML = `
    <img src="${photoSrc}" alt="${person.name}" class="card-avatar" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';" draggable="false">
    <div class="card-name">${person.name}</div>
    <div class="card-years">${years}</div>
  `;

  card.addEventListener('click', () => openSidebar(person));
  return card;
}

// Отрисовка линий между родственниками (SVG)
function renderConnections(positions, svg) {
  familyData.forEach(person => {
    const pPos = positions.get(person.id);
    if (!pPos) return;

    // Линии от родителей к детям
    if (person.children && person.children.length > 0) {
      const parentBottomX = pPos.x + CARD_WIDTH / 2;
      const parentBottomY = pPos.y + CARD_HEIGHT;

      person.children.forEach(childId => {
        const cPos = positions.get(childId);
        if (!cPos) return;

        const childTopX = cPos.x + CARD_WIDTH / 2;
        const childTopY = cPos.y;
        const midY = parentBottomY + (childTopY - parentBottomY) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${parentBottomX} ${parentBottomY} C ${parentBottomX} ${midY}, ${childTopX} ${midY}, ${childTopX} ${childTopY}`);
        path.setAttribute('class', 'tree-line');
        svg.appendChild(path);
      });
    }

    // Линии между супругами
    if (person.spouses && person.spouses.length > 0) {
      person.spouses.forEach(sId => {
        if (person.id > sId) return; // исключаем дублирование линии
        const sPos = positions.get(sId);
        if (!sPos) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pPos.x + CARD_WIDTH);
        line.setAttribute('y1', pPos.y + CARD_HEIGHT / 2);
        line.setAttribute('x2', sPos.x);
        line.setAttribute('y2', sPos.y + CARD_HEIGHT / 2);
        line.setAttribute('class', 'tree-line-spouse');
        svg.appendChild(line);
      });
    }
  });
}

// Открытие боковой панели с биографией
function openSidebar(person) {
  const sidebar = document.getElementById('detailsSidebar');
  if (!sidebar) return;

  document.getElementById('detailName').textContent = person.name;
  
  const photoEl = document.getElementById('detailPhoto');
  if (photoEl) {
    photoEl.onerror = function() { this.onerror = null; this.src = DEFAULT_AVATAR; };
    photoEl.src = person.photo || DEFAULT_AVATAR;
  }

  document.getElementById('detailYears').textContent = (person.birth || '') + (person.death ? ` — ${person.death}` : (person.birth ? ' — настоящее время' : ''));
  
  const locRow = document.getElementById('detailLocationRow');
  if (locRow) {
    locRow.style.display = person.location ? 'block' : 'none';
    document.getElementById('detailLocation').textContent = person.location || '';
  }

  const occRow = document.getElementById('detailOccupationRow');
  if (occRow) {
    occRow.style.display = person.occupation ? 'block' : 'none';
    document.getElementById('detailOccupation').textContent = person.occupation || '';
  }

  document.getElementById('detailBio').textContent = person.bio || 'Информация не указана.';

  // Список родственных связей
  const relContainer = document.getElementById('detailRelations');
  if (relContainer) {
    relContainer.innerHTML = '';

    const addRelationGroup = (title, ids) => {
      if (!ids || ids.length === 0) return;
      ids.forEach(id => {
        const rel = personMap.get(id);
        if (!rel) return;
        const chip = document.createElement('div');
        chip.className = 'relation-chip';
        chip.innerHTML = `<span>${rel.name}</span><small style="color:var(--text-muted)">${title}</small>`;
        chip.addEventListener('click', () => {
          openSidebar(rel);
          focusCard(rel.id);
        });
        relContainer.appendChild(chip);
      });
    };

    addRelationGroup('Родитель', person.parents);
    addRelationGroup('Супруг(а)', person.spouses);
    addRelationGroup('Ребёнок', person.children);
  }

  sidebar.classList.remove('hidden');
}

// Фокусировка камеры на выбранной персоне
function focusCard(id) {
  document.querySelectorAll('.person-card').forEach(c => c.classList.remove('highlighted'));
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.classList.add('highlighted');
    const x = parseFloat(card.style.left);
    const y = parseFloat(card.style.top);
    const vp = document.getElementById('viewport');
    if (vp) {
      currentTransform.x = vp.clientWidth / 2 - (x + CARD_WIDTH / 2) * currentTransform.scale;
      currentTransform.y = vp.clientHeight / 2 - (y + CARD_HEIGHT / 2) * currentTransform.scale;
      applyTransform();
    }
  }
}

// Управление панорамированием, масштабированием и мышью
function initEventListeners() {
  const vp = document.getElementById('viewport');
  if (!vp) return;

  // Начало перетаскивания
  vp.addEventListener('mousedown', (e) => {
    if (e.target.closest('.person-card')) return;
    isDragging = true;
    startPan = { x: e.clientX - currentTransform.x, y: e.clientY - currentTransform.y };
    vp.classList.add('grabbing');
  });

  // Перемещение мыши
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentTransform.x = e.clientX - startPan.x;
    currentTransform.y = e.clientY - startPan.y;
    applyTransform();
  });

  // Завершение перетаскивания и защита от залипания
  window.addEventListener('mouseup', () => {
    isDragging = false;
    vp.classList.remove('grabbing');
  });

  window.addEventListener('mouseleave', () => {
    isDragging = false;
    vp.classList.remove('grabbing');
  });

  // Зум колесиком мыши
  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(currentTransform.scale * zoomFactor, 0.3), 2.5);

    const rect = vp.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    currentTransform.x = mouseX - (mouseX - currentTransform.x) * (newScale / currentTransform.scale);
    currentTransform.y = mouseY - (mouseY - currentTransform.y) * (newScale / currentTransform.scale);
    currentTransform.scale = newScale;
    applyTransform();
  }, { passive: false });

  // Кнопки масштаба
  document.getElementById('zoomInBtn')?.addEventListener('click', () => {
    currentTransform.scale = Math.min(currentTransform.scale * 1.2, 2.5);
    applyTransform();
  });

  document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
    currentTransform.scale = Math.max(currentTransform.scale * 0.8, 0.3);
    applyTransform();
  });

  document.getElementById('zoomResetBtn')?.addEventListener('click', () => {
    currentTransform = { x: 80, y: 80, scale: 1 };
    applyTransform();
  });

  // Закрытие боковой панели
  document.getElementById('closeSidebarBtn')?.addEventListener('click', () => {
    document.getElementById('detailsSidebar')?.classList.add('hidden');
  });
}

function applyTransform() {
  const container = document.getElementById('treeContainer');
  if (container) {
    container.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
  }
  const resetBtn = document.getElementById('zoomResetBtn');
  if (resetBtn) {
    resetBtn.textContent = `${Math.round(currentTransform.scale * 100)}%`;
  }
}

// Поиск
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const resultsBox = document.getElementById('searchResults');
  if (!searchInput || !resultsBox) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultsBox.classList.add('hidden');
      return;
    }

    const matches = familyData.filter(p => p.name.toLowerCase().includes(q));
    if (matches.length === 0) {
      resultsBox.innerHTML = '<div class="search-item" style="color:var(--text-muted)">Ничего не найдено</div>';
    } else {
      resultsBox.innerHTML = matches.map(m => `
        <div class="search-item" data-id="${m.id}">
          <strong>${m.name}</strong> <small>(${m.birth || '?'})</small>
        </div>
      `).join('');
    }
    resultsBox.classList.remove('hidden');
  });

  resultsBox.addEventListener('click', (e) => {
    const item = e.target.closest('.search-item');
    if (item && item.dataset.id) {
      const p = personMap.get(item.dataset.id);
      if (p) {
        openSidebar(p);
        focusCard(p.id);
        resultsBox.classList.add('hidden');
        searchInput.value = '';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      resultsBox.classList.add('hidden');
    }
  });
}
