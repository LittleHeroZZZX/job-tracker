/* ── ui.js: 统计栏 + 表格渲染 + Toast ── */
"use strict";

function renderStats() {
  const total = records.length;
  const offer = records.filter((r) => r.status === "Offer").length;
  const process = records.filter((r) =>
    ["笔试", "面试中"].includes(r.status),
  ).length;
  const reject = records.filter((r) => r.status === "已拒绝").length;
  const pending = records.filter((r) => r.status === "待回复").length;
  const rate = total ? Math.round((offer / total) * 100) : 0;

  document.getElementById("statsBar").innerHTML = `
    <div class="stat-card"><div class="stat-num c-total">${total}</div><div class="stat-label">累计投递</div></div>
    <div class="stat-card"><div class="stat-num c-process">${process}</div><div class="stat-label">进行中</div></div>
    <div class="stat-card"><div class="stat-num c-pending">${pending}</div><div class="stat-label">待回复</div></div>
    <div class="stat-card"><div class="stat-num c-offer">${offer}</div><div class="stat-label">Offer 🎉</div></div>
    <div class="stat-card"><div class="stat-num c-reject">${reject}</div><div class="stat-label">已拒绝</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--warn)">${rate}%</div><div class="stat-label">Offer 率</div></div>
  `;
}

function renderTable() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const statusF = document.getElementById("filterStatus").value;
  const intentF = document.getElementById("filterIntent").value;
  const [sk, sd] = document.getElementById("sortKey").value.split("_");

  let list = records.filter((r) => {
    const company = (r.company || "").toLowerCase();
    const department = (r.department || "").toLowerCase();
    const position = (r.position || "").toLowerCase();
    if (
      search &&
      !company.includes(search) &&
      !department.includes(search) &&
      !position.includes(search)
    )
      return false;
    if (statusF && r.status !== statusF) return false;
    if (intentF && String(r.intent) !== intentF) return false;
    return true;
  });

  list.sort((a, b) => {
    let av = a[sk] ?? "",
      bv = b[sk] ?? "";
    if (sk === "intent") {
      av = Number(av);
      bv = Number(bv);
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sd === "asc" ? cmp : -cmp;
  });

  const tbody = document.getElementById("tableBody");
  const empty = document.getElementById("emptyState");

  if (!list.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = list
    .map((r) => {
      const sal = salaryStr(r);
      return `
    <tr onclick="openDetail('${r.id}')">
      <td>
        <div class="company-cell">
          ${avatarHtml(r, 34)}
          <div>
            <div class="company-name">${esc(r.company)}${r.department ? ` · <span style="color:var(--text2);font-weight:500">${esc(r.department)}</span>` : ""}</div>
            <div class="company-sub">${esc(r.position)}${r.city ? " · " + esc(r.city) : ""}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--text2);font-size:.8rem;white-space:nowrap">${r.applyDate || "—"}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="font-size:.82rem;color:var(--text2)">${interviewLabel(r.interviewRound)}</td>
      <td style="font-size:.82rem;color:${r.salaryMin || r.salaryMax ? "var(--success)" : "var(--text2)"}">${sal}</td>
      <td>${starsHtml(r.intent)}</td>
      <td>${starsHtml(r.match)}</td>
      <td onclick="event.stopPropagation()">
        <div class="row-actions">
          ${r.link ? `<a class="btn btn-secondary btn-sm btn-icon" href="${esc(r.link)}" target="_blank" rel="noopener" title="打开 JD 链接">🔗</a>` : ""}
          <button class="btn btn-secondary btn-sm btn-icon" title="编辑" onclick="openModal('${r.id}')">✏️</button>
          <button class="btn btn-secondary btn-sm btn-icon" title="删除" onclick="confirmDelete('${r.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function confirmDelete(id) {
  const r = getRecord(id);
  if (!r) return;
  if (!confirm(`删除「${r.company} · ${r.position}」？此操作不可撤销。`))
    return;
  removeRecord(id);
  renderStats();
  renderTable();
  toast("已删除", "info");
}

/* ── Toast ── */
function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  el.innerHTML = `<span>${icons[type] || ""}</span><span>${msg}</span>`;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .4s";
    setTimeout(() => el.remove(), 400);
  }, 2800);
}
