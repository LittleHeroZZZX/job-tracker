/* ── app.js: 初始化 + 导航 + 主题 ── */
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  renderStats();
  renderTable();
  initTheme();
  initNavigation();
  initDropdowns();
  updateAutoSyncUI();
});

/* ── 主题 ── */
const THEME_KEY = 'job_tracker_theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
  document.getElementById('themeBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('themeDropdown').classList.toggle('open');
  });
  document.querySelectorAll('#themeDropdown [data-set-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.setTheme);
      document.getElementById('themeDropdown').classList.remove('open');
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

/* ── Tab 导航 ── */
function initNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  ['list','timeline','calendar','charts'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === view ? '' : 'none';
  });
  if (view === 'timeline') renderTimeline();
  if (view === 'calendar') {
    renderCalendar();
    // Auto-select today if events exist
    if (getEventsByDate(today()).length) {
      calSelectedDate = today();
      renderDayPanel(today());
    }
  }
  if (view === 'charts')   renderCharts();
}

/* ── Dropdowns ── */
function initDropdowns() {
  const exportBtn  = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  exportBtn.addEventListener('click', e => {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
    document.getElementById('themeDropdown').classList.remove('open');
  });
  document.addEventListener('click', () => {
    document.getElementById('themeDropdown').classList.remove('open');
    exportMenu.classList.remove('open');
  });
  exportMenu.addEventListener('click', e => e.stopPropagation());
  document.getElementById('themeDropdown').addEventListener('click', e => e.stopPropagation());
}
