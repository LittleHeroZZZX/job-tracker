/* ── webdav.js: WebDAV 远程同步 ── */
'use strict';

const DAV_CONFIG_KEY = 'job_tracker_dav';

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
}

function openSyncModal() {
  const cfg = loadDavConfig();
  document.getElementById('dav_url').value  = cfg.url  || '';
  document.getElementById('dav_user').value = cfg.user || '';
  document.getElementById('dav_pass').value = cfg.pass || '';
  document.getElementById('syncLog').textContent = '';
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

async function davTest() {
  const { cfg, headers } = davHeaders();
  if (!cfg.url) { syncLog('❌ 未填写 WebDAV 地址', 'log-err'); return; }
  syncLog('正在测试连接…', 'log-info');
  try {
    const res = await fetch(davFileUrl(cfg), {
      method: 'HEAD',
      headers,
    });
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

    const mode = records.length === 0
      ? 'replace'
      : confirm(`本地有 ${records.length} 条，云端有 ${remote.length} 条。\n\n确定 → 合并（去重）\n取消 → 用云端覆盖本地`)
        ? 'merge' : 'replace';

    if (mode === 'replace') {
      records = remote;
    } else {
      const existIds = new Set(records.map(r => r.id));
      let added = 0;
      remote.forEach(r => {
        if (r.id && !existIds.has(r.id)) { records.push(r); added++; }
      });
      syncLog(`合并完成，新增 ${added} 条`, 'log-info');
    }

    saveRecords();
    renderStats();
    renderTable();
    syncLog(`✅ 拉取成功，共 ${records.length} 条`, 'log-ok');
    toast('已从云端同步 ✅', 'success');
  } catch (err) {
    syncLog(`❌ 拉取错误：${err.message}`, 'log-err');
  }
}
