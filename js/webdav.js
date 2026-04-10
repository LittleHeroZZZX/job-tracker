/* ── webdav.js: WebDAV 远程同步 ── */
'use strict';

const DAV_CONFIG_KEY   = 'job_tracker_dav';
const AUTO_SYNC_KEY    = 'job_tracker_dav_autosync';
let _suppressAutoSync  = false;
let _autoSyncTimer     = null;
let _startupSyncDone   = false;

function loadDavConfig() {
  try { return JSON.parse(localStorage.getItem(DAV_CONFIG_KEY)) || {}; } catch { return {}; }
}

function saveDavConfig() {
  const cfg = {
    url:  document.getElementById('dav_url').value.trim(),
    user: document.getElementById('dav_user').value.trim(),
    pass: document.getElementById('dav_pass').value,
  };
  if (!cfg.url) { toast('请填写 WebDAV 地址', 'error'); return; }
  localStorage.setItem(DAV_CONFIG_KEY, JSON.stringify(cfg));
  toast('配置已保存 ✅', 'success');
  updateAutoSyncUI();
}

/* ── 自动同步 ── */
function isAutoSyncEnabled() {
  return localStorage.getItem(AUTO_SYNC_KEY) !== 'false';
}

function toggleAutoSync(enabled) {
  localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
  updateAutoSyncUI();
  toast(enabled ? '已开启自动同步 ☁️' : '已关闭自动同步', enabled ? 'success' : 'info');
}

function updateAutoSyncUI() {
  const cfg = loadDavConfig();
  const hasConfig = !!(cfg.url);
  const enabled   = isAutoSyncEnabled();

  const toggle = document.getElementById('autoSyncToggle');
  if (toggle) {
    toggle.checked  = enabled;
    toggle.disabled = !hasConfig;
  }
  const label = document.getElementById('autoSyncLabel');
  if (label) label.style.opacity = hasConfig ? '1' : '0.5';

  // Header indicator dot
  const dot = document.getElementById('autoSyncDot');
  if (dot) dot.style.display = (hasConfig && enabled) ? 'inline-block' : 'none';
}

function autoSyncIfEnabled() {
  if (_suppressAutoSync) return;
  const cfg = loadDavConfig();
  if (!cfg.url) return;
  if (!isAutoSyncEnabled()) return;

  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.user || cfg.pass) {
        headers['Authorization'] = 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`);
      }
      let base = cfg.url;
      if (!base.endsWith('/')) base += '/';
      const body = JSON.stringify(records, null, 2);
      const res = await fetch(base + 'job-tracker.json', { method: 'PUT', headers, body });
      if (res.ok || res.status === 201 || res.status === 204) {
        toast('已自动同步 ☁️', 'success');
      } else {
        toast(`自动同步失败 HTTP ${res.status}`, 'error');
      }
    } catch (err) {
      toast(`自动同步失败：${err.message}`, 'error');
    }
  }, 1500);
}

/* ── Modal ── */
function openSyncModal() {
  const cfg = loadDavConfig();
  document.getElementById('dav_url').value  = cfg.url  || '';
  document.getElementById('dav_user').value = cfg.user || '';
  document.getElementById('dav_pass').value = cfg.pass || '';
  document.getElementById('syncLog').textContent = '';
  updateAutoSyncUI();
  document.getElementById('syncModal').classList.add('open');
}

function closeSyncModal() {
  document.getElementById('syncModal').classList.remove('open');
}

function syncLog(msg, cls = '') {
  const el = document.getElementById('syncLog');
  const line = document.createElement('div');
  line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/* ── 从表单字段读取（不依赖已保存配置） ── */
function davFormConfig() {
  const url  = document.getElementById('dav_url').value.trim();
  const user = document.getElementById('dav_user').value.trim();
  const pass = document.getElementById('dav_pass').value;
  const headers = { 'Content-Type': 'application/json' };
  if (user || pass) headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
  let base = url;
  if (base && !base.endsWith('/')) base += '/';
  return { url, user, pass, headers, fileUrl: base ? base + 'job-tracker.json' : '' };
}

function davHeaders() {
  const cfg = loadDavConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.user || cfg.pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`);
  }
  return { cfg, headers };
}

function davFileUrl(cfg) {
  let base = cfg.url || '';
  if (!base.endsWith('/')) base += '/';
  return base + 'job-tracker.json';
}

/* ── 基于 updatedAt 时间戳的智能合并 ── */
function mergeRecords(local, remote) {
  const merged = new Map();
  let added = 0, updated = 0;

  local.forEach(r => merged.set(r.id, { ...r }));

  remote.forEach(r => {
    if (!r.id) return;
    if (!merged.has(r.id)) {
      merged.set(r.id, { ...r });
      added++;
    } else {
      const localR = merged.get(r.id);
      const localTime  = new Date(localR.updatedAt || localR.createdAt || 0).getTime();
      const remoteTime = new Date(r.updatedAt      || r.createdAt      || 0).getTime();
      if (remoteTime > localTime) {
        merged.set(r.id, { ...r });
        updated++;
      }
    }
  });

  // 保持按创建时间降序排列（与 addRecord 的 unshift 一致）
  const result = [...merged.values()].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });

  return { records: result, added, updated };
}

/* ── 静默拉取并合并（启动 / 推送前使用） ── */
async function davSilentPull(logFn) {
  const cfg = loadDavConfig();
  if (!cfg.url) return null;

  const headers = { 'Content-Type': 'application/json' };
  if (cfg.user || cfg.pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`);
  }

  try {
    const res = await fetch(davFileUrl(cfg), { method: 'GET', headers });
    if (res.status === 404) { logFn && logFn('云端暂无数据，将直接上传', 'log-info'); return null; }
    if (!res.ok)            { logFn && logFn(`⚠️ 获取云端数据失败 HTTP ${res.status}`, 'log-info'); return null; }

    const remote = await res.json();
    if (!Array.isArray(remote)) return null;

    const { records: merged, added, updated } = mergeRecords(records, remote);

    if (added > 0 || updated > 0) {
      _suppressAutoSync = true;
      records = merged;
      saveRecords();
      _suppressAutoSync = false;
      renderStats();
      renderTable();
    }

    return { added, updated };
  } catch (err) {
    logFn && logFn(`⚠️ 无法连接云端（${err.message}）`, 'log-info');
    return null;
  }
}

/* ── 启动时自动同步（拉取） ── */
async function autoSyncOnStartup() {
  if (_startupSyncDone) return;
  _startupSyncDone = true;
  if (!isAutoSyncEnabled()) return;
  const cfg = loadDavConfig();
  if (!cfg.url) return;

  const result = await davSilentPull();
  if (result && (result.added > 0 || result.updated > 0)) {
    const parts = [];
    if (result.added   > 0) parts.push(`新增 ${result.added} 条`);
    if (result.updated > 0) parts.push(`更新 ${result.updated} 条`);
    toast(`已从云端同步：${parts.join('，')} ☁️`, 'success');
  }
}

/* ── 测试连接（使用表单当前值，无需保存） ── */
async function davTest() {
  const { url, headers, fileUrl } = davFormConfig();
  if (!url) { syncLog('❌ 未填写 WebDAV 地址', 'log-err'); return; }
  syncLog('正在测试连接…', 'log-info');
  try {
    const res = await fetch(fileUrl, { method: 'HEAD', headers });
    if (res.ok || res.status === 404) {
      syncLog(`✅ 连接成功（HTTP ${res.status}）`, 'log-ok');
    } else if (res.status === 401) {
      syncLog('❌ 认证失败，请检查用户名和密码', 'log-err');
    } else {
      syncLog(`⚠️ 服务器响应 HTTP ${res.status}`, 'log-err');
    }
  } catch (err) {
    syncLog(`❌ 连接失败：${err.message}（可能是 CORS 限制，请在服务器端配置 CORS）`, 'log-err');
  }
}

async function davPush() {
  const { cfg, headers } = davHeaders();
  if (!cfg.url) { syncLog('❌ 未填写 WebDAV 地址', 'log-err'); return; }

  // 上传前先拉取合并，避免覆盖云端更新
  syncLog('🔄 正在检查云端最新数据…', 'log-info');
  const mergeResult = await davSilentPull(syncLog);
  if (mergeResult && (mergeResult.added > 0 || mergeResult.updated > 0)) {
    syncLog(`已合并云端数据：新增 ${mergeResult.added} 条，更新 ${mergeResult.updated} 条`, 'log-info');
  } else if (mergeResult !== null) {
    syncLog('本地与云端一致，无冲突', 'log-info');
  }

  syncLog(`⬆️ 正在上传 ${records.length} 条记录…`, 'log-info');
  try {
    const body = JSON.stringify(records, null, 2);
    const res = await fetch(davFileUrl(cfg), {
      method: 'PUT',
      headers,
      body,
    });
    if (res.ok || res.status === 201 || res.status === 204) {
      syncLog(`✅ 上传成功（${(body.length / 1024).toFixed(1)} KB）`, 'log-ok');
      toast('已同步到云端 ☁️', 'success');
    } else {
      syncLog(`❌ 上传失败 HTTP ${res.status}: ${await res.text()}`, 'log-err');
    }
  } catch (err) {
    syncLog(`❌ 上传错误：${err.message}`, 'log-err');
  }
}

async function davPull() {
  const { cfg, headers } = davHeaders();
  if (!cfg.url) { syncLog('❌ 未填写 WebDAV 地址', 'log-err'); return; }
  syncLog('⬇️ 正在从云端拉取…', 'log-info');
  try {
    const res = await fetch(davFileUrl(cfg), { method: 'GET', headers });
    if (res.status === 404) { syncLog('⚠️ 云端文件不存在，请先上传', 'log-err'); return; }
    if (!res.ok) { syncLog(`❌ 拉取失败 HTTP ${res.status}`, 'log-err'); return; }

    const remote = await res.json();
    if (!Array.isArray(remote)) { syncLog('❌ 云端数据格式不正确', 'log-err'); return; }

    if (records.length === 0) {
      // 本地为空，直接用云端
      records = remote;
      syncLog(`直接使用云端数据，共 ${remote.length} 条`, 'log-info');
    } else {
      const replace = confirm(
        `本地有 ${records.length} 条，云端有 ${remote.length} 条。\n\n` +
        `确定 → 智能合并（按时间戳解决冲突）\n取消 → 用云端完全覆盖本地`
      );
      if (!replace) {
        records = remote;
        syncLog(`已用云端数据覆盖本地，共 ${remote.length} 条`, 'log-info');
      } else {
        const { records: merged, added, updated } = mergeRecords(records, remote);
        records = merged;
        syncLog(`智能合并完成：新增 ${added} 条，冲突更新 ${updated} 条，共 ${records.length} 条`, 'log-info');
      }
    }

    // 拉取后保存，抑制自动回推
    _suppressAutoSync = true;
    saveRecords();
    _suppressAutoSync = false;

    renderStats();
    renderTable();
    syncLog(`✅ 拉取成功，共 ${records.length} 条`, 'log-ok');
    toast('已从云端同步 ✅', 'success');
  } catch (err) {
    const msg = err.message || '';
    if (msg === 'Failed to fetch' || err instanceof TypeError) {
      syncLog(
        '❌ 拉取失败（网络/CORS 错误）\n' +
        '  可能原因：WebDAV 服务器将请求重定向到不支持 CORS 的 CDN\n' +
        '  解决方案：\n' +
        '  · 在 WebDAV 代理上配置 CORS 响应头，确保服务器直接返回数据而非跳转\n' +
        '  · 或使用支持 CORS 的 WebDAV 服务（如 Nextcloud、Alist）',
        'log-err'
      );
    } else {
      syncLog(`❌ 拉取错误：${msg}`, 'log-err');
    }
  }
}
