/* ─── KAIZEN BOARD — app.js ─────────────────────────────────────── */

const COLUMNS = [
  { id: 'idea',       label: 'Idea'        },
  { id: 'todo',       label: 'To Do'       },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'done',       label: 'Done'        },
];

// ─── STATE ────────────────────────────────────────────────────────
// card shape: { id, title, body, column, priority, createdAt, deadline, tasks[], tags[], impact, doneAt, archivedAt }
// column values: 'idea' | 'todo' | 'inprogress' | 'done' | 'archived'
// task shape: { id, text, done }
let state = {
  cards: [],
  boardTitle: 'My Board',
  nextId: 1,
  collapsedCols: [], // array of collapsed column ids
};

// ─── PERSISTENCE ─────────────────────────────────────────────────
// In Electron: uses file-based storage via electronAPI (IPC → main.js → userData/state.json)
// In browser:  falls back to localStorage so the web preview still works
function saveState() {
  try {
    if (window.electronAPI?.saveData) {
      window.electronAPI.saveData(state);  // fire-and-forget IPC send
    } else {
      localStorage.setItem('kaizen-state-v2', JSON.stringify(state));
    }
  } catch(e) {}
}

async function loadState() {
  try {
    if (window.electronAPI?.loadData) {
      // ── Electron path: read state.json from userData ──
      const saved = await window.electronAPI.loadData();
      if (saved) {
        if (saved.cards) saved.cards.forEach(c => {
          // Migrate legacy numeric ids → string ids
          if (typeof c.id === 'number') c.id = `card-${c.id}-legacy`;
          if (!c.tasks)    c.tasks    = [];
          if (!c.deadline) c.deadline = '';
          if (!c.tags)     c.tags     = [];
          if (!c.impact)   c.impact   = '';
          if (!c.doneAt && c.column === 'done') c.doneAt = c.createdAt;
          if (!c.archivedAt) c.archivedAt = null;
        });
        if (!saved.collapsedCols) saved.collapsedCols = [];
        state = { ...state, ...saved };
        // Re-save with migrated ids so next load is already clean
        saveState();
      }
    } else {
      // ── Browser / web-preview fallback ──
      const raw = localStorage.getItem('kaizen-state-v2');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.cards) saved.cards.forEach(c => {
          if (typeof c.id === 'number') c.id = `card-${c.id}-legacy`;
          if (!c.tasks)    c.tasks    = [];
          if (!c.deadline) c.deadline = '';
          if (!c.tags)     c.tags     = [];
          if (!c.impact)   c.impact   = '';
          if (!c.doneAt && c.column === 'done') c.doneAt = c.createdAt;
          if (!c.archivedAt) c.archivedAt = null;
        });
        if (!saved.collapsedCols) saved.collapsedCols = [];
        state = { ...state, ...saved };
      } else {
        const old = localStorage.getItem('kaizen-state');
        if (old) {
          const saved = JSON.parse(old);
          if (saved.cards) saved.cards.forEach(c => { c.tasks = []; c.deadline = ''; });
          state = { ...state, ...saved };
        }
      }
    }
  } catch(e) { console.error('loadState error:', e); }
}

// ─── AUTO-DONE ──────────────────────────────────────────────────
function maybeAutoDone(card) {
  const tasks = card.tasks || [];
  if (!tasks.length) return false;
  if (card.column === 'done' || card.column === 'archived') return false;
  if (tasks.every(t => t.done)) {
    const prevCol = card.column;
    card.column = 'done';
    if (!card.doneAt) card.doneAt = new Date().toISOString();
    saveState();
    renderBoard();
    updateCount(prevCol);
    updateCount('done');
    window.electronAPI?.notifyDone(card.title);
    const doneCol = document.querySelector('[data-col="done"]');
    if (doneCol) {
      doneCol.classList.add('auto-done-flash');
      setTimeout(() => doneCol.classList.remove('auto-done-flash'), 700);
    }
    return true;
  }
  return false;
}

// ─── ARCHIVE ──────────────────────────────────────────────────────
function archiveCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.column     = 'archived';
  card.archivedAt = new Date().toISOString();
  saveState();
  renderBoard();
  updateCount('done');
}

function openArchive() {
  renderArchive();
  const overlay = document.getElementById('archive-overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('archive-search').focus();
}

function closeArchive() {
  const overlay = document.getElementById('archive-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

function renderArchive() {
  const search   = (document.getElementById('archive-search').value || '').toLowerCase().trim();
  const dateFrom = document.getElementById('archive-date-from').value; // YYYY-MM-DD
  const dateTo   = document.getElementById('archive-date-to').value;   // YYYY-MM-DD

  let cards = state.cards.filter(c => c.column === 'archived');

  // Filter by date range (archivedAt)
  if (dateFrom) {
    cards = cards.filter(c => c.archivedAt && c.archivedAt.slice(0,10) >= dateFrom);
  }
  if (dateTo) {
    cards = cards.filter(c => c.archivedAt && c.archivedAt.slice(0,10) <= dateTo);
  }

  // Full-text search: title + body + impact + tags
  if (search) {
    cards = cards.filter(c => {
      const hay = [
        c.title || '',
        c.body  || '',
        c.impact || '',
        (c.tags || []).join(' '),
        (c.tasks || []).map(t => t.text).join(' '),
      ].join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  // Sort newest archived first
  cards = [...cards].sort((a, b) =>
    new Date(b.archivedAt || b.createdAt) - new Date(a.archivedAt || a.createdAt)
  );

  const list = document.getElementById('archive-list');
  const count = document.getElementById('archive-count');
  const total = state.cards.filter(c => c.column === 'archived').length;
  count.textContent = cards.length === total
    ? `${total} card${total === 1 ? '' : 's'}`
    : `${cards.length} of ${total}`;

  if (cards.length === 0) {
    list.innerHTML = `<div class="archive-empty">Nothing found</div>`;
    return;
  }

  list.innerHTML = cards.map(c => {
    const archivedStr = c.archivedAt ? formatDate(c.archivedAt) : '';
    const tagsHtml = (c.tags && c.tags.length)
      ? c.tags.map(t => `<span class="archive-item-tag">${escapeHtml(t)}</span>`).join('')
      : '';
    const impactHtml = c.impact
      ? `<div class="archive-item-impact"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 3.5,4.5 5.5,6 9,2"/><polyline points="7,2 9,2 9,4"/></svg>${escapeHtml(c.impact)}</div>`
      : '';
    const prioClass = c.priority === 'high' ? 'archive-prio--high' : c.priority === 'low' ? 'archive-prio--low' : '';
    const prioLabel = c.priority === 'high' ? 'HIGH' : c.priority === 'low' ? 'LOW' : '';
    return `
      <div class="archive-item">
        <div class="archive-item-main">
          <span class="archive-item-title">${escapeHtml(c.title)}</span>
          <span class="archive-item-meta">
            ${prioLabel ? `<span class="archive-prio ${prioClass}">${prioLabel}</span>` : ''}
            <span class="archive-item-date">${archivedStr}</span>
          </span>
        </div>
        ${impactHtml}
        ${tagsHtml ? `<div class="archive-item-tags">${tagsHtml}</div>` : ''}
      </div>`;
  }).join('');
}

function pluralRu(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return '';
  return '';
}

// ─── HELPERS ─────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

function generateId() { return `card-${uid()}`; }
function generateTaskId() { return `task-${uid()}`; }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** «только что» / «N мин» / «N ч» / «N дн» / «N нед» */
function timeAgo(iso) {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)     return `${diffD}d ago`;
  const diffW = Math.floor(diffD / 7);
  return `${diffW}w ago`;
}

/**
 * Returns deadline status:
 *   null   — no deadline
 *   'ok'   — more than 2 days away
 *   'soon' — today or tomorrow (≤1 day)
 *   'due'  — overdue
 */
function deadlineStatus(deadline) {
  if (!deadline) return null;
  const now    = new Date();
  const target = new Date(deadline);
  // compare calendar dates (no time)
  const nowDate    = new Date(now.getFullYear(),    now.getMonth(),    now.getDate());
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays   = Math.floor((targetDate - nowDate) / 86400000);
  if (diffDays < 0)  return 'due';
  if (diffDays <= 1) return 'soon';
  return 'ok';
}

function deadlineLabel(deadline) {
  if (!deadline) return '';
  const d = new Date(deadline);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function taskProgress(card) {
  const tasks = card.tasks || [];
  if (!tasks.length) return null;
  const done = tasks.filter(t => t.done).length;
  return { done, total: tasks.length, pct: Math.round(done / tasks.length * 100) };
}

// ─── POMODORO STATE ───────────────────────────────────────────────
// Only one timer can run at a time.
// pomState: null | { cardId, phase:'focus'|'break', remaining(s), intervalId }
let pomState = null;
const POM_FOCUS_S = 25 * 60;
const POM_BREAK_S = 5  * 60;

function pomStart(cardId) {
  const prevId = pomState?.cardId;
  pomStop(); // clear any running timer (also rerenders prev card)
  pomState = {
    cardId,
    phase: 'focus',
    remaining: POM_FOCUS_S,
    intervalId: setInterval(pomTick, 1000),
  };
  // Re-render the new card so the timer widget appears
  rerenderCard(cardId);
}

function pomStop() {
  if (!pomState) return;
  clearInterval(pomState.intervalId);
  const prev = pomState;
  pomState = null;
  // re-render the card that had the timer to reset UI
  rerenderCard(prev.cardId);
}

function pomTick() {
  if (!pomState) return;
  pomState.remaining--;

  if (pomState.remaining <= 0) {
    if (pomState.phase === 'focus') {
      // focus done → notify + switch to break
      const card = state.cards.find(c => c.id === pomState.cardId);
      const title = card ? card.title : 'Kaizen';
      window.electronAPI?.notifyPomodoro(title, 'focus');
      pomState.phase     = 'break';
      pomState.remaining = POM_BREAK_S;
    } else {
      // break done → notify + switch back to focus
      const card = state.cards.find(c => c.id === pomState.cardId);
      const title = card ? card.title : 'Kaizen';
      window.electronAPI?.notifyPomodoro(title, 'break');
      pomState.phase     = 'focus';
      pomState.remaining = POM_FOCUS_S;
    }
  }

  updatePomUI();
}

function pomFormatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

/** Update only the timer widget on a specific card (lightweight) */
function updatePomUI() {
  if (!pomState) return;
  const el = document.querySelector(`[data-id="${pomState.cardId}"] .pom-timer`);
  if (!el) return;
  el.textContent = pomFormatTime(pomState.remaining);
  el.dataset.phase = pomState.phase;
}

/** Full re-render of one card (used when timer stops) */
function rerenderCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  const old = document.querySelector(`[data-id="${cardId}"]`);
  if (!old) return;
  const fresh = buildCard(card);
  old.replaceWith(fresh);
}

// ─── FOCUS TODAY & OVERDUE & PRIORITY FILTER ───────────────────────
let focusToday       = false;
let highlightOverdue  = false;
let priorityFilter    = null; // null | 'high' | 'normal' | 'low'
// Tracks which columns were auto-expanded per-filter (to restore on toggle-off)
let autoExpandedCols  = [];  // for deadline filters
let pfExpandedCols    = [];  // for priority filter
let tagFilter         = null; // null | string — active tag
let tfExpandedCols    = [];   // for tag filter

function isOverdue(card) {
  return deadlineStatus(card.deadline) === 'due';
}

function isTodayDeadline(card) {
  if (!card.deadline) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return card.deadline === todayStr;
}

/**
 * When a filter is turned ON: auto-expand any collapsed column that
 * contains matching cards, saving which ones we expanded.
 * When turned OFF: re-collapse only the ones we auto-expanded.
 */
function applyFilterExpansion(matchFn) {
  // Expand collapsed columns that have matching cards
  autoExpandedCols = [];
  COLUMNS.forEach(col => {
    const isCollapsed = state.collapsedCols.includes(col.id);
    if (!isCollapsed) return;
    const hasMatch = state.cards.some(c => c.column === col.id && matchFn(c));
    if (hasMatch) {
      // Remove from collapsedCols (expand)
      state.collapsedCols = state.collapsedCols.filter(id => id !== col.id);
      autoExpandedCols.push(col.id);
    }
  });
  saveState();
}

function revertFilterExpansion() {
  // Re-collapse only what we auto-expanded
  autoExpandedCols.forEach(colId => {
    if (!state.collapsedCols.includes(colId)) {
      state.collapsedCols.push(colId);
    }
  });
  autoExpandedCols = [];
  saveState();
}

function toggleFocusToday() {
  focusToday = !focusToday;
  const btn = document.getElementById('btn-deadline-today');
  btn.classList.toggle('btn-deadline-today--active', focusToday);
  if (focusToday) {
    applyFilterExpansion(isTodayDeadline);
  } else {
    revertFilterExpansion();
  }
  renderBoard();
}

function toggleHighlightOverdue() {
  highlightOverdue = !highlightOverdue;
  const btn = document.getElementById('btn-deadlined');
  btn.classList.toggle('btn-deadlined--active', highlightOverdue);
  if (highlightOverdue) {
    applyFilterExpansion(isOverdue);
  } else {
    revertFilterExpansion();
  }
  renderBoard();
}

// ─── PRIORITY FILTER ─────────────────────────────────────────────────
function setPriorityFilter(prio) {
  // Clicking the same chip again → deactivate
  const next = priorityFilter === prio ? null : prio;

  // Restore auto-expanded columns from previous priority filter
  if (pfExpandedCols.length) {
    pfExpandedCols.forEach(colId => {
      if (!state.collapsedCols.includes(colId)) state.collapsedCols.push(colId);
    });
    pfExpandedCols = [];
    saveState();
  }

  priorityFilter = next;

  // Update chip active states
  document.querySelectorAll('.pf-chip').forEach(btn => {
    btn.classList.toggle('pf-chip--active', btn.dataset.pf === priorityFilter);
  });

  if (priorityFilter) {
    // Auto-expand collapsed columns that have cards of this priority
    pfExpandedCols = [];
    COLUMNS.forEach(col => {
      if (!state.collapsedCols.includes(col.id)) return;
      const hasMatch = state.cards.some(c => c.column === col.id && (c.priority || 'normal') === priorityFilter);
      if (hasMatch) {
        state.collapsedCols = state.collapsedCols.filter(id => id !== col.id);
        pfExpandedCols.push(col.id);
      }
    });
    saveState();
  }

  renderBoard();
}

// ─── COLLAPSE ────────────────────────────────────────────────────
function toggleCollapse(colId) {
  const idx = state.collapsedCols.indexOf(colId);
  if (idx === -1) {
    state.collapsedCols.push(colId);
  } else {
    state.collapsedCols.splice(idx, 1);
  }
  saveState();
  renderBoard();
}

// ─── RENDER ──────────────────────────────────────────────────────
const board = document.getElementById('board');

function renderBoard() {
  board.innerHTML = '';
  for (const col of COLUMNS) {
    const allCards     = state.cards.filter(c => c.column === col.id);
    const visibleCards = focusToday ? allCards.filter(isTodayDeadline) : allCards;
    board.appendChild(buildColumn(col, visibleCards, allCards.length));
  }
}

function buildColumn(col, cards, totalCount) {
  const isCollapsed = state.collapsedCols.includes(col.id);
  const countDisplay = totalCount !== undefined ? (totalCount || '') : (cards.length || '');
  const colEl = document.createElement('div');
  colEl.className = 'column' + (isCollapsed ? ' column--collapsed' : '');
  colEl.dataset.col = col.id;
  colEl.setAttribute('data-testid', `column-${col.id}`);

  // ─ Chevron SVG (down when open, right when collapsed)
  const chevronSvg = isCollapsed
    ? `<svg class="col-chevron" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,2 10,7 5,12"/></svg>`
    : `<svg class="col-chevron" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,5 7,10 12,5"/></svg>`;

  if (isCollapsed) {
    // Collapsed: narrow vertical strip
    colEl.innerHTML = `
      <button class="col-collapse-btn" data-collapse="${col.id}" title="Expand" aria-label="Expand ${col.label}">
        <span class="col-dot"></span>
        <span class="col-name-vertical">${col.label}</span>
        <span class="col-count col-count--vertical" data-count="${col.id}">${countDisplay}</span>
        ${chevronSvg}
      </button>
    `;
  } else {
    colEl.innerHTML = `
      <div class="column-header">
        <span class="col-dot"></span>
        <span class="col-name">${col.label}</span>
        <button class="col-collapse-btn col-collapse-btn--header" data-collapse="${col.id}" title="Collapse" aria-label="Collapse ${col.label}">
          ${chevronSvg}
        </button>
      </div>
      <div class="column-divider"></div>
      <div class="cards-list" data-cards-col="${col.id}">
        ${cards.length === 0 ? buildEmptyHint() : ''}
      </div>
      ${col.id === 'done' ? `
      <div class="done-archive-footer">
        <button class="done-archive-btn" id="btn-open-archive">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="14" height="10" rx="1.5"/>
            <path d="M1 7h14"/>
            <path d="M5 2h6"/>
            <line x1="6" y1="10" x2="10" y2="10"/>
          </svg>
          <span>Archive</span>
          <span class="done-archive-count" id="done-archive-count"></span>
        </button>
      </div>` : ''}
    `;
  }

  // Collapse toggle
  colEl.querySelectorAll('[data-collapse]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(col.id);
    });
  });

  if (!isCollapsed) {
    const list = colEl.querySelector('.cards-list');
    for (const card of cards) list.appendChild(buildCard(card));
    setupColumnDrop(colEl, col.id);
    colEl.querySelector('[data-add-col]')?.addEventListener('click', () => openModal(null, col.id));

    // Archive footer for Done column
    if (col.id === 'done') {
      const archiveBtn = colEl.querySelector('#btn-open-archive');
      if (archiveBtn) {
        const archivedCount = state.cards.filter(c => c.column === 'archived').length;
        const countEl = colEl.querySelector('#done-archive-count');
        if (countEl && archivedCount > 0) countEl.textContent = archivedCount;
        archiveBtn.addEventListener('click', openArchive);
      }
    }
  }

  return colEl;
}

function buildEmptyHint() {
  return `<div class="empty-hint" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
    <span>No cards</span>
  </div>`;
}

function buildCard(card) {
  const el = document.createElement('div');
  const overdueHighlight   = highlightOverdue && isOverdue(card);
  const todayHighlight      = focusToday && isTodayDeadline(card);
  const cardPrio            = card.priority || 'normal';
  const priorityMatch       = priorityFilter && cardPrio === priorityFilter;
  const priorityDim         = priorityFilter && cardPrio !== priorityFilter;
  const tagMatch            = tagFilter && (card.tags || []).includes(tagFilter);
  const tagDim              = tagFilter && !(card.tags || []).includes(tagFilter);
  let cardClass = 'card';
  if (overdueHighlight)  cardClass += ' card--overdue-highlight';
  if (todayHighlight)    cardClass += ' card--today-highlight';
  if (priorityMatch)     cardClass += ' card--priority-highlight';
  if (priorityDim)       cardClass += ' card--priority-dim';
  if (tagMatch)          cardClass += ' card--tag-highlight';
  if (tagDim)            cardClass += ' card--tag-dim';
  el.className = cardClass;
  el.dataset.id = card.id;
  el.dataset.priority = card.priority || 'normal';
  el.setAttribute('draggable', 'true');
  el.setAttribute('data-testid', `card-${card.id}`);

  const tasks = card.tasks || [];
  const prog  = taskProgress(card);

  // Body preview (only if no tasks, to save space)
  const bodyHtml = (!tasks.length && card.body)
    ? `<div class="card-body-preview">${escapeHtml(card.body)}</div>`
    : '';

  // Subtasks on card: show up to 4
  let tasksHtml = '';
  if (tasks.length) {
    const visible = tasks.slice(0, 4);
    const more    = tasks.length - visible.length;
    tasksHtml = `<ul class="card-tasks">
      ${visible.map(t => `
        <li class="card-task${t.done ? ' card-task--done' : ''}" data-task-id="${t.id}">
          <span class="card-task-cb">${t.done
            ? `<svg viewBox="0 0 12 12" fill="none"><rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill="var(--accent)" stroke="var(--accent)"/><path d="M2.5 6l2.5 2.5 4.5-4.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : `<svg viewBox="0 0 12 12" fill="none"><rect x="0.5" y="0.5" width="11" height="11" rx="2.5" stroke="currentColor" stroke-opacity="0.35"/></svg>`
          }</span>
          <span class="card-task-text">${escapeHtml(t.text)}</span>
        </li>`).join('')}
      ${more > 0 ? `<li class="card-task-more">+${more} more</li>` : ''}
    </ul>`;
  }

  // Progress bar
  let progressHtml = '';
  if (prog) {
    progressHtml = `
      <div class="card-progress">
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${prog.pct}%" data-pct="${prog.pct}"></div>
        </div>
        <span class="card-progress-label">${prog.done}/${prog.total}</span>
      </div>`;
  }

  // Deadline badge
  const ds = deadlineStatus(card.deadline);
  let deadlineHtml = '';
  if (ds && ds !== 'ok') {
    const label = deadlineLabel(card.deadline);
    deadlineHtml = `<span class="card-deadline card-deadline--${ds}">${ds === 'due' ? '⚠ ' : ''}${label}</span>`;
  } else if (ds === 'ok') {
    deadlineHtml = `<span class="card-deadline card-deadline--ok">${deadlineLabel(card.deadline)}</span>`;
  }

  // Pomodoro widget
  const isPomActive = pomState?.cardId === card.id;
  const pomPhase    = isPomActive ? pomState.phase : 'focus';
  const pomTime     = isPomActive ? pomFormatTime(pomState.remaining) : '25:00';
  const pomHtml = `
    <div class="card-pom" data-pom-card="${card.id}">
      <button class="pom-btn${isPomActive ? ' pom-btn--active' : ''}" data-pom-toggle="${card.id}" title="Pomodoro timer" aria-label="Start Pomodoro">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="7" cy="7" r="5.5"/>
          <polyline points="7,4 7,7 9,8.5"/>
        </svg>
      </button>
      ${isPomActive
        ? `<span class="pom-timer" data-phase="${pomPhase}">${pomTime}</span>
           <button class="pom-stop" data-pom-stop="${card.id}" title="Stop" aria-label="Stop timer">
             <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
               <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
             </svg>
           </button>`
        : ''
      }
    </div>`;

  // Done column: compact view — title + impact + Archive button
  if (card.column === 'done') {
    el.innerHTML = `
      <div class="card-done-inner">
        <div class="card-done-text">
          <div class="card-title">${escapeHtml(card.title)}</div>
          ${card.impact ? `<div class="card-impact"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 3.5,4.5 5.5,6 9,2"/><polyline points="7,2 9,2 9,4"/></svg><span>${escapeHtml(card.impact)}</span></div>` : ''}
        </div>
        <button class="card-archive-btn" data-archive-id="${card.id}" title="Archive" aria-label="Archive">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="12" height="8" rx="1.2"/>
            <path d="M1 6.5h12"/>
            <path d="M4.5 2h5"/>
            <line x1="5" y1="9" x2="9" y2="9"/>
          </svg>
          <span>Archive</span>
        </button>
      </div>
    `;
    // Archive button — stops propagation so card click won't fire
    el.querySelector('[data-archive-id]').addEventListener('click', (e) => {
      e.stopPropagation();
      archiveCard(card.id);
    });
    el.addEventListener('click', () => openModal(card.id));
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend',   onDragEnd);
    return el;
  }

  el.innerHTML = `
    <div class="card-title">${escapeHtml(card.title)}</div>
    ${bodyHtml}
    ${tasksHtml}
    ${progressHtml}
    ${(card.tags && card.tags.length) ? `<div class="card-tags">${card.tags.map(t => `<span class="card-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    ${card.impact ? `<div class="card-impact"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 3.5,4.5 5.5,6 9,2"/><polyline points="7,2 9,2 9,4"/></svg><span>${escapeHtml(card.impact)}</span></div>` : ''}
    <div class="card-footer">
      <span class="card-priority">${priorityLabel(card.priority)}</span>
      <div class="card-footer-right">
        ${deadlineHtml}
        <span class="card-age" title="${formatDate(card.createdAt)}">${timeAgo(card.createdAt)}</span>
      </div>
    </div>
    ${pomHtml}
  `;

  // Checkbox clicks on card
  el.querySelectorAll('.card-task').forEach(taskEl => {
    taskEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = taskEl.dataset.taskId;
      const c = state.cards.find(x => x.id === card.id);
      if (!c) return;
      const t = c.tasks.find(x => x.id === taskId);
      if (!t) return;
      t.done = !t.done;
      if (!maybeAutoDone(c)) {
        saveState();
        renderBoard();
      }
    });
  });

  // Pomodoro: start
  const pomToggleBtn = el.querySelector('[data-pom-toggle]');
  if (pomToggleBtn) {
    pomToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pomState?.cardId === card.id) {
        pomStop();
      } else {
        pomStart(card.id);
      }
    });
  }

  // Pomodoro: stop (× button when active)
  const pomStopBtn = el.querySelector('[data-pom-stop]');
  if (pomStopBtn) {
    pomStopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pomStop();
    });
  }

  el.addEventListener('click', () => openModal(card.id));
  el.addEventListener('dragstart', onDragStart);
  el.addEventListener('dragend',   onDragEnd);

  return el;
}

function priorityLabel(p) {
  if (p === 'high') return 'HIGH';
  if (p === 'low')  return 'LOW';
  return '●';
}

function updateCount(colId) {
  const el = document.querySelector(`[data-count="${colId}"]`);
  if (!el) return;
  const count = state.cards.filter(c => c.column === colId).length;
  el.textContent = count || '';
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

// ─── DRAG & DROP ─────────────────────────────────────────────────
let dragCardId    = null;
let dragSourceCol = null;
let placeholder   = null;
const ghost = document.getElementById('drag-ghost');

function onDragStart(e) {
  dragCardId    = e.currentTarget.dataset.id;
  dragSourceCol = e.currentTarget.closest('[data-col]').dataset.col;
  e.currentTarget.classList.add('dragging');
  const card = state.cards.find(c => c.id === dragCardId);
  ghost.textContent = card ? card.title : '';
  ghost.style.top  = '-9999px';
  ghost.style.left = '-9999px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 10, 10);
  e.dataTransfer.effectAllowed = 'move';
  placeholder = document.createElement('div');
  placeholder.className = 'card-placeholder';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  placeholder?.remove();
  placeholder = null;
  ghost.textContent = '';
  document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
  dragCardId = dragSourceCol = null;
}

function setupColumnDrop(colEl, colId) {
  const list = colEl.querySelector('.cards-list');

  colEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    colEl.classList.add('drag-over');
    const afterEl = getDragAfterElement(list, e.clientY);
    afterEl ? list.insertBefore(placeholder, afterEl) : list.appendChild(placeholder);
  });

  colEl.addEventListener('dragleave', (e) => {
    if (!colEl.contains(e.relatedTarget)) {
      colEl.classList.remove('drag-over');
      placeholder?.remove();
    }
  });

  colEl.addEventListener('drop', (e) => {
    e.preventDefault();
    colEl.classList.remove('drag-over');
    if (!dragCardId) return;
    const afterEl   = getDragAfterElement(list, e.clientY);
    const afterCard = afterEl ? afterEl.dataset.id : null;
    const cardIdx   = state.cards.findIndex(c => c.id === dragCardId);
    if (cardIdx === -1) return;
    const [card] = state.cards.splice(cardIdx, 1);
    card.column = colId;
    if (afterCard) {
      const insertIdx = state.cards.findIndex(c => c.id === afterCard);
      state.cards.splice(insertIdx, 0, card);
    } else {
      const lastInCol = state.cards.reduce((last, c, i) => c.column === colId ? i : last, -1);
      lastInCol >= 0 ? state.cards.splice(lastInCol + 1, 0, card) : state.cards.push(card);
    }
    saveState();
    renderBoard();
    updateCount(dragSourceCol);
    updateCount(colId);
  });
}

function getDragAfterElement(container, y) {
  return [...container.querySelectorAll('.card:not(.dragging)')].reduce((closest, child) => {
    const offset = y - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
    return (offset < 0 && offset > (closest.offset || -Infinity))
      ? { offset, element: child } : closest;
  }, {}).element;
}

// ─── MODAL ───────────────────────────────────────────────────────
const overlay        = document.getElementById('modal-overlay');
const modalTitle     = document.getElementById('modal-title');
const modalBody      = document.getElementById('modal-body');
const modalCol       = document.getElementById('modal-column');
const modalPri       = document.getElementById('modal-priority');
const modalDeadline  = document.getElementById('modal-deadline');
const btnSave        = document.getElementById('modal-save');
const btnDelete      = document.getElementById('modal-delete');
const btnClose       = document.getElementById('modal-close');
const modalTaskList  = document.getElementById('modal-tasks-list');
const modalTaskInput = document.getElementById('modal-task-input');
const modalTasksProg = document.getElementById('modal-tasks-progress');
const modalTagInput  = document.getElementById('modal-tag-input');
const modalTagsList  = document.getElementById('modal-tags-list');
const modalImpact    = document.getElementById('modal-impact');

let editingCardId = null;
let editingTasks  = [];
let editingTags   = [];

// ─── TAG COLOUR ──────────────────────────────────────────────────
const TAG_COLOURS = [
  '#6366f1','#8b5cf6','#ec4899','#f97316','#eab308',
  '#22c55e','#14b8a6','#3b82f6','#ef4444','#a855f7',
];
function tagColour(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLOURS[h % TAG_COLOURS.length];
}

// ─── MODAL TAGS ──────────────────────────────────────────────────
function renderModalTags() {
  modalTagsList.innerHTML = '';
  editingTags.forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'modal-tag-chip';
    chip.style.setProperty('--tag-color', tagColour(tag));
    chip.innerHTML = `<span>${escapeHtml(tag)}</span><button class="modal-tag-remove" data-idx="${idx}" aria-label="Remove tag">\u00d7</button>`;
    chip.querySelector('.modal-tag-remove').addEventListener('click', () => {
      editingTags.splice(idx, 1);
      renderModalTags();
    });
    modalTagsList.appendChild(chip);
  });
}

modalTagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    e.stopPropagation(); // не пропускать Enter выше (не триггерить saveModal)
    const val = modalTagInput.value.trim().replace(/,/g,'').toLowerCase();
    if (val && !editingTags.includes(val)) {
      editingTags.push(val);
      renderModalTags();
    }
    modalTagInput.value = '';
    modalTagInput.focus();
    return;
  }
  if (e.key === 'Backspace' && modalTagInput.value === '' && editingTags.length) {
    editingTags.pop();
    renderModalTags();
  }
  if (e.key === 'Escape') modalTagInput.blur();
});

// ─── TAG FILTER ──────────────────────────────────────────────────
function allTags() {
  const set = new Set();
  state.cards.forEach(c => (c.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function setTagFilter(tag) {
  // Restore auto-expanded cols from previous tag filter
  if (tfExpandedCols.length) {
    tfExpandedCols.forEach(id => { if (!state.collapsedCols.includes(id)) state.collapsedCols.push(id); });
    tfExpandedCols = [];
    saveState();
  }

  tagFilter = tagFilter === tag ? null : tag;

  if (tagFilter) {
    // Auto-expand collapsed cols that have matching cards
    COLUMNS.forEach(col => {
      if (!state.collapsedCols.includes(col.id)) return;
      if (state.cards.some(c => c.column === col.id && (c.tags || []).includes(tagFilter))) {
        state.collapsedCols = state.collapsedCols.filter(id => id !== col.id);
        tfExpandedCols.push(col.id);
      }
    });
    saveState();
  }

  renderTagFilterDropdown();
  renderBoard();
}

function renderTagFilterDropdown() {
  const dropdown = document.getElementById('tag-filter-dropdown');
  const btn      = document.getElementById('tag-filter-btn');
  const label    = document.getElementById('tag-filter-label');
  const tags     = allTags();

  dropdown.innerHTML = '';

  if (!tags.length) {
    const empty = document.createElement('span');
    empty.className = 'tag-filter-empty';
    empty.textContent = 'No tags yet';
    dropdown.appendChild(empty);
  } else {
    tags.forEach(tag => {
      const chip = document.createElement('button');
      chip.className = 'tag-filter-chip' + (tagFilter === tag ? ' tag-filter-chip--active' : '');
      chip.style.setProperty('--tag-color', tagColour(tag));
      chip.textContent = tag;
      chip.addEventListener('click', (e) => { e.stopPropagation(); setTagFilter(tag); });
      dropdown.appendChild(chip);
    });
  }

  // Update button label
  label.textContent = tagFilter ? tagFilter : 'Tags';
  btn.classList.toggle('tag-filter-btn--active', !!tagFilter);
}

// Toggle dropdown open/close
document.getElementById('tag-filter-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById('tag-filter-dropdown');
  const btn = document.getElementById('tag-filter-btn');
  const isOpen = dropdown.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
  if (isOpen) renderTagFilterDropdown();
});
document.addEventListener('click', () => {
  const dropdown = document.getElementById('tag-filter-dropdown');
  dropdown.classList.remove('open');
  document.getElementById('tag-filter-btn').setAttribute('aria-expanded', 'false');
});

function openModal(cardId, defaultCol) {
  editingCardId = cardId;

  if (cardId) {
    // eslint-disable-next-line eqeqeq — intentional: handles both numeric legacy ids and string ids
    const card = state.cards.find(c => c.id == cardId);
    if (!card) return;
    modalTitle.value    = card.title;
    modalBody.value     = card.body || '';
    modalCol.value      = card.column;
    modalPri.value      = card.priority || 'normal';
    modalDeadline.value = card.deadline || '';
    modalImpact.value   = card.impact  || '';
    editingTasks        = (card.tasks || []).map(t => ({ ...t }));
    editingTags         = [...(card.tags || [])];
    btnDelete.style.display = '';
  } else {
    modalTitle.value    = '';
    modalBody.value     = '';
    modalCol.value      = defaultCol || 'idea';
    modalPri.value      = 'normal';
    modalDeadline.value = '';
    modalImpact.value   = '';
    editingTasks        = [];
    editingTags         = [];
    btnDelete.style.display = 'none';
  }

  renderModalTasks();
  renderModalTags();
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => modalTitle.focus(), 80);
}

function closeModal() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  editingCardId = null;
  editingTasks  = [];
  editingTags   = [];
  modalTaskInput.value = '';
  modalTagInput.value  = '';
  modalImpact.value    = '';
}

// ─── MODAL TASK RENDER ────────────────────────────────────────────
function renderModalTasks() {
  modalTaskList.innerHTML = '';

  editingTasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = `modal-task-item${task.done ? ' modal-task-item--done' : ''}`;
    li.dataset.idx = idx;

    li.innerHTML = `
      <button class="modal-task-check" data-idx="${idx}" aria-label="${task.done ? 'Uncheck' : 'Check'} subtask">
        ${task.done
          ? `<svg viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="4" fill="var(--accent)"/><path d="M3.5 8l3 3 6-6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<svg viewBox="0 0 16 16" fill="none"><rect x="0.75" y="0.75" width="14.5" height="14.5" rx="3.25" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5"/></svg>`
        }
      </button>
      <span class="modal-task-text">${escapeHtml(task.text)}</span>
      <button class="modal-task-delete" data-idx="${idx}" aria-label="Delete subtask">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
        </svg>
      </button>
    `;

    li.querySelector('.modal-task-check').addEventListener('click', () => {
      editingTasks[idx].done = !editingTasks[idx].done;
      renderModalTasks();
    });

    li.querySelector('.modal-task-delete').addEventListener('click', () => {
      editingTasks.splice(idx, 1);
      renderModalTasks();
    });

    modalTaskList.appendChild(li);
  });

  if (editingTasks.length) {
    const done = editingTasks.filter(t => t.done).length;
    const pct  = Math.round(done / editingTasks.length * 100);
    modalTasksProg.textContent = `${done}/${editingTasks.length}`;
    modalTasksProg.style.setProperty('--pct', `${pct}%`);
    modalTasksProg.className = 'modal-tasks-progress' + (pct === 100 ? ' all-done' : '');
  } else {
    modalTasksProg.textContent = '';
    modalTasksProg.className = 'modal-tasks-progress';
  }
}

modalTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = modalTaskInput.value.trim();
    if (!text) return;
    editingTasks.push({ id: generateTaskId(), text, done: false });
    modalTaskInput.value = '';
    renderModalTasks();
    modalTaskList.scrollTop = modalTaskList.scrollHeight;
  }
  if (e.key === 'Escape') { modalTaskInput.blur(); }
});

function saveModal() {
  const title = modalTitle.value.trim();
  if (!title) { modalTitle.focus(); return; }

  if (editingCardId) {
    const card = state.cards.find(c => c.id === editingCardId);
    if (card) {
      const oldCol  = card.column;
      card.title    = title;
      card.body     = modalBody.value.trim();
      card.column   = modalCol.value;
      card.priority = modalPri.value;
      card.deadline = modalDeadline.value || '';
      card.tasks    = editingTasks.map(t => ({ ...t }));
      card.tags     = [...editingTags];
      card.impact   = modalImpact.value.trim();
      // stamp doneAt when moved to done
      if (card.column === 'done' && !card.doneAt) card.doneAt = new Date().toISOString();
      if (card.column !== 'done') card.doneAt = null;
      if (!maybeAutoDone(card)) {
        saveState();
        renderBoard();
        if (oldCol !== card.column) updateCount(oldCol);
        updateCount(card.column);
      }
    }
  } else {
    const newCard = {
      id:        generateId(),
      title,
      body:      modalBody.value.trim(),
      column:    modalCol.value,
      priority:  modalPri.value,
      deadline:  modalDeadline.value || '',
      tasks:     editingTasks.map(t => ({ ...t })),
      tags:      [...editingTags],
      impact:    modalImpact.value.trim(),
      createdAt: new Date().toISOString(),
      doneAt:    modalCol.value === 'done' ? new Date().toISOString() : null,
    };
    state.cards.push(newCard);
    saveState();
    renderBoard();
    updateCount(newCard.column);
  }
  closeModal();
}

function deleteCard() {
  if (!editingCardId) return;
  const idx = state.cards.findIndex(c => c.id === editingCardId);
  if (idx !== -1) {
    const col = state.cards[idx].column;
    state.cards.splice(idx, 1);
    saveState();
    renderBoard();
    updateCount(col);
  }
  closeModal();
}

btnSave.addEventListener('click', saveModal);
btnDelete.addEventListener('click', deleteCard);
btnClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

// ─── QUICK ADD ────────────────────────────────────────────────────
const quickAdd      = document.getElementById('quick-add');
const quickAddInput = document.getElementById('quick-add-input');
let   quickAddCol   = 'idea';

function openQuickAdd(colId = 'idea') {
  quickAddCol = colId;
  quickAddInput.value = '';
  quickAdd.classList.add('open');
  quickAdd.setAttribute('aria-hidden', 'false');
  quickAddInput.focus();
}
function closeQuickAdd() {
  quickAdd.classList.remove('open');
  quickAdd.setAttribute('aria-hidden', 'true');
}
function commitQuickAdd() {
  const title = quickAddInput.value.trim();
  if (title) {
    state.cards.push({
      id: generateId(), title, body: '', column: quickAddCol,
      priority: 'normal', deadline: '', tasks: [], createdAt: new Date().toISOString(),
    });
    saveState(); renderBoard(); updateCount(quickAddCol);
  }
  closeQuickAdd();
}

quickAddInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.preventDefault(); commitQuickAdd(); }
  if (e.key === 'Escape') { closeQuickAdd(); }
});

// ─── RETRO PANEL ────────────────────────────────────────────────
const retroOverlay = document.getElementById('retro-overlay');
const retroList    = document.getElementById('retro-list');
const retroStats   = document.getElementById('retro-stats');

function openRetro() {
  renderRetro();
  retroOverlay.classList.add('open');
  retroOverlay.setAttribute('aria-hidden', 'false');
}
function closeRetro() {
  retroOverlay.classList.remove('open');
  retroOverlay.setAttribute('aria-hidden', 'true');
}

function renderRetro() {
  const done = state.cards.filter(c => c.column === 'done');
  const withImpact = done.filter(c => c.impact);

  // — Stats bar —
  const total     = done.length;
  const impactPct = total ? Math.round(withImpact.length / total * 100) : 0;
  // Streaks: group done by ISO week
  const weekMap = {};
  done.forEach(c => {
    if (!c.doneAt) return;
    const d = new Date(c.doneAt);
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = mon.toISOString().slice(0, 10);
    weekMap[key] = (weekMap[key] || 0) + 1;
  });
  const weeks = Object.keys(weekMap).sort();
  const lastWeekKey = (() => {
    const now = new Date();
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return mon.toISOString().slice(0, 10);
  })();
  const thisWeek = weekMap[lastWeekKey] || 0;

  retroStats.innerHTML = `
    <div class="retro-stat">
      <span class="retro-stat-num">${total}</span>
      <span class="retro-stat-label">improvements</span>
    </div>
    <div class="retro-stat">
      <span class="retro-stat-num">${thisWeek}</span>
      <span class="retro-stat-label">this week</span>
    </div>
    <div class="retro-stat">
      <span class="retro-stat-num">${withImpact.length}</span>
      <span class="retro-stat-label">with impact</span>
    </div>
    <div class="retro-stat retro-stat--bar">
      <div class="retro-impact-bar">
        <div class="retro-impact-fill" style="width:${impactPct}%"></div>
      </div>
      <span class="retro-stat-label">${impactPct}% filled</span>
    </div>
  `;

  // — List —
  if (!done.length) {
    retroList.innerHTML = `<div class="retro-empty">Nothing done yet — move your first card to Done.</div>`;
    return;
  }

  // Sort by doneAt desc
  const sorted = [...done].sort((a, b) => new Date(b.doneAt || b.createdAt) - new Date(a.doneAt || a.createdAt));

  // Group by week
  const groups = {};
  sorted.forEach(c => {
    const d = new Date(c.doneAt || c.createdAt);
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = mon.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const weekLabel = (isoMon) => {
    const mon = new Date(isoMon);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const now = new Date();
    const curMon = new Date(now); curMon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    curMon.setHours(0,0,0,0);
    const wMon = new Date(isoMon); wMon.setHours(0,0,0,0);
    if (wMon.getTime() === curMon.getTime()) return 'This week';
    const prev = new Date(curMon); prev.setDate(curMon.getDate() - 7);
    if (wMon.getTime() === prev.getTime()) return 'Last week';
    return `${fmt(mon)} – ${fmt(sun)}`;
  };

  const priorityIcon = (p) => ({
    high: '<span class="retro-prio retro-prio--high">HIGH</span>',
    low:  '<span class="retro-prio retro-prio--low">LOW</span>',
  }[p] || '');

  retroList.innerHTML = Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(key => `
    <div class="retro-week">
      <div class="retro-week-label">${weekLabel(key)}<span class="retro-week-count">${groups[key].length}</span></div>
      <div class="retro-items">
        ${groups[key].map(c => `
          <div class="retro-item${c.impact ? ' retro-item--has-impact' : ''}">
            <div class="retro-item-main">
              <span class="retro-item-title">${escapeHtml(c.title)}</span>
              ${priorityIcon(c.priority)}
            </div>
            ${c.impact ? `<div class="retro-item-impact"><svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,7 3.5,4.5 5.5,6 9,2"/><polyline points="7,2 9,2 9,4"/></svg>${escapeHtml(c.impact)}</div>` : ''}
            ${(c.tags && c.tags.length) ? `<div class="retro-item-tags">${c.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`).join('');
}

document.getElementById('btn-retro').addEventListener('click', openRetro);
document.getElementById('retro-close').addEventListener('click', closeRetro);
retroOverlay.addEventListener('click', (e) => { if (e.target === retroOverlay) closeRetro(); });

// ─── TITLEBAR ────────────────────────────────────────────────
document.getElementById('btn-add-card').addEventListener('click', () => openModal(null, 'idea'));
document.getElementById('btn-deadline-today').addEventListener('click', toggleFocusToday);
document.getElementById('btn-deadlined').addEventListener('click', toggleHighlightOverdue);
document.querySelectorAll('.pf-chip').forEach(btn => btn.addEventListener('click', () => setPriorityFilter(btn.dataset.pf)));
// btn-clear-done removed from UI

// board-title removed from UI

// ─── SETTINGS ─────────────────────────────────────────────────
(function initSettings() {
  const html       = document.documentElement;
  const overlay    = document.getElementById('settings-overlay');
  const btnGear    = document.getElementById('btn-settings');
  const btnClose   = document.getElementById('settings-close');
  const btnDark    = document.getElementById('settings-theme-dark');
  const btnLight   = document.getElementById('settings-theme-light');
  const togAutolaunch = document.getElementById('settings-autolaunch-toggle');
  const sectionElectron = document.getElementById('settings-section-electron');
  const btnReset   = document.getElementById('settings-reset-data');

  // ── Theme ────────────────────────────────────────────
  let theme = localStorage.getItem('kaizen-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function applyTheme(t) {
    theme = t;
    html.dataset.theme = t;
    localStorage.setItem('kaizen-theme', t);
    btnDark.classList.toggle('settings-theme-btn--active',  t === 'dark');
    btnLight.classList.toggle('settings-theme-btn--active', t === 'light');
  }
  applyTheme(theme);

  btnDark.addEventListener('click',  () => applyTheme('dark'));
  btnLight.addEventListener('click', () => applyTheme('light'));

  // ── Open / close ──────────────────────────────────
  function openSettings() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    btnGear.classList.add('btn-settings--active');
  }
  function closeSettings() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    btnGear.classList.remove('btn-settings--active');
  }

  btnGear.addEventListener('click', () =>
    overlay.classList.contains('open') ? closeSettings() : openSettings()
  );
  btnClose.addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeSettings(); });

  // ── Electron-only section ───────────────────────────
  if (window.electronAPI?.getLoginItem) {
    sectionElectron.style.display = '';
    // Autolaunch toggle
    window.electronAPI.getLoginItem().then(enabled => {
      togAutolaunch.setAttribute('aria-checked', String(enabled));
      togAutolaunch.classList.toggle('settings-toggle--on', enabled);
    });
    togAutolaunch.addEventListener('click', () => {
      const next = togAutolaunch.getAttribute('aria-checked') !== 'true';
      togAutolaunch.setAttribute('aria-checked', String(next));
      togAutolaunch.classList.toggle('settings-toggle--on', next);
      window.electronAPI.setLoginItem(next);
    });
    // Reset data
    btnReset.addEventListener('click', () => {
      if (!confirm('Reset all board data? This cannot be undone.')) return;
      window.electronAPI.clearData();
      state = { cards: [], boardTitle: 'My Board', nextId: 1, collapsedCols: [] };
      seedData();
      saveState();
      renderBoard();
      closeSettings();
    });
  } else {
    sectionElectron.style.display = 'none';
  }
})();

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const isEditing = document.activeElement?.tagName === 'INPUT' ||
    document.activeElement?.tagName === 'TEXTAREA' ||
    document.activeElement?.isContentEditable;

  if (e.key === 'Escape') {
    const archiveOvl = document.getElementById('archive-overlay');
    if (archiveOvl && archiveOvl.classList.contains('open')) { closeArchive(); return; }
    if (overlay.classList.contains('open')) closeModal();
    if (quickAdd.classList.contains('open')) closeQuickAdd();
  }
  if (!isEditing && !overlay.classList.contains('open')) {
    if (e.key === 'n' || e.key === 'N') openQuickAdd('idea');
  }
  if (overlay.classList.contains('open') && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    saveModal();
  }
});

// ─── SEED DATA ────────────────────────────────────────────────────
function seedData() {
  const d   = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const dl  = (n) => { // deadline: n days from now (negative = overdue)
    const t = new Date(); t.setDate(t.getDate() + n);
    return t.toISOString().slice(0, 10);
  };
  state.cards = [
    {
      id: generateId(), title: 'Research async queue alternatives', body: 'Celery vs Dramatiq vs RQ',
      column: 'idea', priority: 'normal', createdAt: d(5), deadline: dl(7), tags: ['backend', 'research'],
      tasks: [
        { id: generateTaskId(), text: 'Benchmark Celery throughput', done: true },
        { id: generateTaskId(), text: 'Try Dramatiq with Redis broker', done: false },
        { id: generateTaskId(), text: 'Compare Dramatiq vs RQ latency', done: false },
      ]
    },
    {
      id: generateId(), title: 'Refactor gateway auth middleware', body: '',
      column: 'idea', priority: 'high', createdAt: d(4), deadline: dl(1), tags: ['backend', 'security'],
      tasks: [
        { id: generateTaskId(), text: 'Audit current JWT logic', done: false },
        { id: generateTaskId(), text: 'Extract token validator', done: false },
      ]
    },
    {
      id: generateId(), title: 'Write ADR for wallet key storage', body: 'HSM vs MPC approach',
      column: 'todo', priority: 'high', createdAt: d(3), deadline: dl(-1), tags: ['security', 'docs'],
      tasks: [
        { id: generateTaskId(), text: 'Research HSM vendors', done: true },
        { id: generateTaskId(), text: 'Document MPC threshold approach', done: true },
        { id: generateTaskId(), text: 'Review with security team', done: false },
        { id: generateTaskId(), text: 'Publish ADR to Confluence', done: false },
      ]
    },
    {
      id: generateId(), title: 'Update k8s deployment manifests', body: '',
      column: 'todo', priority: 'normal', createdAt: d(3), deadline: '', tags: ['devops'],
      tasks: [
        { id: generateTaskId(), text: 'Update resource limits', done: false },
        { id: generateTaskId(), text: 'Add liveness probes', done: false },
        { id: generateTaskId(), text: 'Test rollout on staging', done: false },
      ]
    },
    {
      id: generateId(), title: 'Add Redis health check endpoint', body: '',
      column: 'inprogress', priority: 'normal', createdAt: d(2), deadline: dl(0), tags: ['backend', 'devops'],
      tasks: [
        { id: generateTaskId(), text: 'Write /health/redis handler', done: true },
        { id: generateTaskId(), text: 'Add to k8s readiness probe', done: false },
      ]
    },
    {
      id: generateId(), title: 'Review PR #42 — schema migration', body: 'Check indexes & types',
      column: 'inprogress', priority: 'high', createdAt: d(1), deadline: '', tags: ['review'],
      tasks: [
        { id: generateTaskId(), text: 'Check index coverage', done: true },
        { id: generateTaskId(), text: 'Verify nullable columns', done: true },
        { id: generateTaskId(), text: 'Run EXPLAIN ANALYZE', done: false },
      ]
    },
    {
      id: generateId(), title: 'Setup docker-compose for n8n', body: 'Local automation env',
      column: 'done', priority: 'low', createdAt: d(6), deadline: '', tags: ['devops'], impact: 'Локальный запуск n8n с 20 мин → 2 мин', doneAt: d(6),
      tasks: [
        { id: generateTaskId(), text: 'Write compose file', done: true },
        { id: generateTaskId(), text: 'Configure webhooks', done: true },
        { id: generateTaskId(), text: 'Document workflows', done: true },
      ]
    },
    {
      id: generateId(), title: 'Document API gateway endpoints', body: '',
      column: 'done', priority: 'normal', createdAt: d(7), deadline: '', tags: ['docs'], impact: 'Онбординг новых разработчиков ускорится', doneAt: d(7), tasks: []
    },
  ];
}

// ─── INIT ─────────────────────────────────────────────────
(async () => {
  await loadState();
  if (state.cards.length === 0) { seedData(); saveState(); }
  renderBoard();

})();

// ─── ARCHIVE OVERLAY EVENTS ───────────────────────────────────────
document.getElementById('archive-close').addEventListener('click', closeArchive);
document.getElementById('archive-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeArchive();
});
document.getElementById('archive-search').addEventListener('input', renderArchive);
document.getElementById('archive-date-from').addEventListener('change', renderArchive);
document.getElementById('archive-date-to').addEventListener('change', renderArchive);
document.getElementById('archive-reset-filters').addEventListener('click', () => {
  document.getElementById('archive-search').value = '';
  document.getElementById('archive-date-from').value = '';
  document.getElementById('archive-date-to').value = '';
  renderArchive();
});

// ─── FULL-TEXT SEARCH ─────────────────────────────────────────────
let searchOpen = false;
let searchFocusIdx = -1;

const searchBar     = document.getElementById('search-bar');
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const COL_LABELS = { idea: 'Idea', todo: 'To Do', inprogress: 'In Progress', done: 'Done' };

function openSearch() {
  searchOpen = true;
  searchBar.classList.add('open');
  searchBar.setAttribute('aria-hidden', 'false');
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchFocusIdx = -1;
  searchInput.focus();
  document.getElementById('btn-search').classList.add('btn-search--active');
}

function closeSearch() {
  searchOpen = false;
  searchBar.classList.remove('open');
  searchBar.setAttribute('aria-hidden', 'true');
  searchFocusIdx = -1;
  document.getElementById('btn-search').classList.remove('btn-search--active');
  // remove dim
  document.querySelectorAll('.card.search-dim').forEach(el => el.classList.remove('search-dim'));
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function runSearch() {
  const q = searchInput.value.trim().toLowerCase();
  searchFocusIdx = -1;

  // Dim/undim board cards
  document.querySelectorAll('.card').forEach(el => {
    if (!q) { el.classList.remove('search-dim'); return; }
    // eslint-disable-next-line eqeqeq
    const card = state.cards.find(c => c.id == el.dataset.id);
    if (!card || card.column === 'archived') return;
    const hay = [card.title, card.body, card.impact, (card.tags||[]).join(' '), (card.tasks||[]).map(t=>t.text).join(' ')].join(' ').toLowerCase();
    el.classList.toggle('search-dim', !hay.includes(q));
  });

  if (!q) { searchResults.innerHTML = ''; return; }

  const matches = state.cards.filter(c => {
    if (c.column === 'archived') return false;
    const hay = [c.title, c.body, c.impact, (c.tags||[]).join(' '), (c.tasks||[]).map(t=>t.text).join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (matches.length === 0) {
    searchResults.innerHTML = `<div class="search-empty">No results for "${escapeHtml(searchInput.value)}"</div>`;
    return;
  }

  searchResults.innerHTML = matches.map((c, i) => {
    const colLabel = COL_LABELS[c.column] || c.column;
    const subParts = [c.body, c.impact, (c.tags||[]).join(' ')].filter(Boolean).join(' · ');
    return `
      <div class="search-result-item" data-search-id="${c.id}">
        <span class="search-result-col">${colLabel}</span>
        <div class="search-result-body">
          <div class="search-result-title">${highlight(c.title, searchInput.value.trim())}</div>
          ${subParts ? `<div class="search-result-sub">${highlight(subParts, searchInput.value.trim())}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Click to open card modal
  searchResults.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      const id = item.dataset.searchId;
      openModal(id);   // open first — id must be read before DOM changes
      closeSearch();   // then close search bar
    });
  });
}

function moveFocus(dir) {
  const items = searchResults.querySelectorAll('.search-result-item');
  if (!items.length) return;
  items[searchFocusIdx]?.classList.remove('search-result--focused');
  searchFocusIdx = Math.max(0, Math.min(items.length - 1, searchFocusIdx + dir));
  items[searchFocusIdx]?.classList.add('search-result--focused');
  items[searchFocusIdx]?.scrollIntoView({ block: 'nearest' });
}

document.getElementById('btn-search').addEventListener('click', () => {
  searchOpen ? closeSearch() : openSearch();
});

searchInput.addEventListener('input', runSearch);

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); moveFocus(-1); return; }
  if (e.key === 'Enter') {
    const focused = searchResults.querySelector('.search-result--focused');
    if (focused) { focused.click(); return; }
    const first = searchResults.querySelector('.search-result-item');
    if (first) first.click();
  }
});

// Click outside closes search
// Note: use closest() because click target can be SVG/path inside the button
document.addEventListener('click', (e) => {
  if (searchOpen && !searchBar.contains(e.target) && !e.target.closest('#btn-search')) {
    closeSearch();
  }
});

// Shortcut: / opens search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !searchOpen) {
    const isEditing = document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.isContentEditable;
    if (!isEditing) { e.preventDefault(); openSearch(); }
  }
});
