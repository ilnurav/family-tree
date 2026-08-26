let familyData = [];
let personMap = new Map();
let currentTransform = { x: 80, y: 80, scale: 1 };
let isDragging = false;
let startPan = { x: 0, y: 0 };

const CARD_WIDTH = 200;
const CARD_HEIGHT = 140;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 120;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadTreeData();
});

async function loadTreeData() {
  try {
    const res = await fetch('data.json');
    familyData = await res.json();
    familyData.forEach(p => personMap.set(p.id, p));

    document.getElementById('memberCount').textContent = `${familyData.length} персон`;
    renderTree();
    setupSearch();
  } catch (err) {
    console.error('Ошибка загрузки data.json:', err);
  }
}

// Расчет позиций и отрисовка
function renderTree() {
  const nodesContainer = document.getElementById('nodesContainer');
  const svg = document.getElementById('connectionsSvg');
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

  // Установка размеров контейнера
  const totalHeight = genKeys.length * (CARD_HEIGHT + VERTICAL_GAP) + 200;
  const container = document.getElementById('treeContainer');
  container.style.width = `${maxRowWidth + 400}px`;
  container.style.height = `${totalHeight}px`;

  // Отрисовка связей (SVG)
  renderConnections(positions, svg);

  // Отрисовка карточек персон
  familyData.forEach(p => {
    const pos = positions.get(p.id);
    const card = createPersonCard(p, pos);
    nodesContainer.appendChild(card);
  });

  applyTransform();
}

function createPersonCard(person, pos) {
  const card = document.createElement('div');
  card.className = `person-card ${person.gender || 'male'}`;
  card.id = `card-${person.id}`;
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;

  const years = (person.birth || '') + (person.death ? ` — ${person.death}` : (person.birth ? ' — н.в.' : ''));
  const avatarUrl = person.photo || 'https://via.placeholder.com/150';

  card.innerHTML = `
    <img src="${avatarUrl}" alt="${person.name}" class="card-avatar" onerror="this.src='https://via.placeholder.com/150'">
    <div class="card-name">${person.name}</div>
    <div class="card-years">${years}</div>
  `;

  card.addEventListener('click', () => openSidebar(person));
  return card;
}

function renderConnections(positions, svg) {
  // Линии супругов и детей
  familyData.forEach(person => {
    const pPos = positions.get(person.id);
    if (!pPos) return;

    // Линии к детям от родителей
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

    // Линии супругов
    if (person.spouses && person.spouses.length > 0) {
      person.spouses.forEach(sId => {
        if (person.id > sId) return; // избежать повтора
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

// Боковая панель
function openSidebar(person) {
  document.getElementById('detailName').textContent = person.name;
  document.getElementById('detailPhoto').src = person.photo || 'https://via.placeholder.com/150';
  document.getElementById('detailYears').textContent = (person.birth || '') + (person.death ? ` — ${person.death}` : (person.birth ? ' — настоящее время' : ''));
  
  const locRow = document.getElementById('detailLocationRow');
  if (person.location) {
    locRow.style.display = 'block';
    document.getElementById('detailLocation').textContent = person.location;
  } else {
    locRow.style.display = 'none';
  }

  const occRow = document.getElementById('detailOccupationRow');
  if (person.occupation) {
    occRow.style.display = 'block';
    document.getElementById('detailOccupation').textContent = person.occupation;
  } else {
    occRow.style.display = 'none';
  }

  document.getElementById('detailBio').textContent = person.bio || 'Биография не заполнена.';

  // Связи
  const relContainer = document.getElementById('detailRelations');
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

  document.getElementById('detailsSidebar').classList.remove('hidden');
}

function focusCard(id) {
  document.querySelectorAll('.person-card').forEach(c => c.classList.remove('highlighted'));
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.classList.add('highlighted');
    const x = parseFloat(card.style.left);
    const y = parseFloat(card.style.top);
    const vp = document.getElementById('viewport');
    currentTransform.x = vp.clientWidth / 2 - (x + CARD_WIDTH / 2) * currentTransform.scale;
    currentTransform.y = vp.clientHeight / 2 - (y + CARD_HEIGHT / 2) * currentTransform.scale;
    applyTransform();
  }
}

// Управление масштабированием и перемещением
function initEventListeners() {
  const vp = document.getElementById('viewport');

  vp.addEventListener('mousedown', (e) => {
    if (e.target.closest('.person-card')) return;
    isDragging = true;
    startPan = { x: e.clientX - currentTransform.x, y: e.clientY - currentTransform.y };
    vp.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentTransform.x = e.clientX - startPan.x;
    currentTransform.y = e.clientY - startPan.y;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    vp.classList.remove('grabbing');
  });

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

  document.getElementById('zoomInBtn').addEventListener('click', () => {
    currentTransform.scale = Math.min(currentTransform.scale * 1.2, 2.5);
    applyTransform();
  });

  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    currentTransform.scale = Math.max(currentTransform.scale * 0.8, 0.3);
    applyTransform();
  });

  document.getElementById('zoomResetBtn').addEventListener('click', () => {
    currentTransform = { x: 80, y: 80, scale: 1 };
    applyTransform();
  });

  document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    document.getElementById('detailsSidebar').classList.add('hidden');
  });
}

function applyTransform() {
  const container = document.getElementById('treeContainer');
  container.style.transform = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.scale})`;
  document.getElementById('zoomResetBtn').textContent = `${Math.round(currentTransform.scale * 100)}%`;
}

// Поиск
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const resultsBox = document.getElementById('searchResults');

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