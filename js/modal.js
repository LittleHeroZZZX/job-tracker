/* ── modal.js: 添加/编辑/详情 Modal ── */
"use strict";

let editingId = null;
let detailId = null;

/* ── Star Picker ── */
function initStarPickers() {
  [
    ["intentPicker", "f_intent"],
    ["matchPicker", "f_match"],
  ].forEach(([pid, fid]) => {
    const wrap = document.getElementById(pid);
    wrap.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement("span");
      s.textContent = "★";
      s.dataset.val = i;
      s.addEventListener("mouseenter", () => highlightStars(pid, i));
      s.addEventListener("mouseleave", () =>
        highlightStars(pid, +document.getElementById(fid).value),
      );
      s.addEventListener("click", () => {
        document.getElementById(fid).value = i;
        highlightStars(pid, i);
      });
      wrap.appendChild(s);
    }
  });
}

function highlightStars(pickerId, val) {
  document.querySelectorAll(`#${pickerId} span`).forEach((s) => {
    s.classList.toggle("active", +s.dataset.val <= val);
  });
}

function setStars(pickerId, fieldId, val) {
  document.getElementById(fieldId).value = val;
  highlightStars(pickerId, val);
}

/* ── Channel "other" ── */
function toggleChannelOther(sel) {
  const other = document.getElementById("f_channelOther");
  const show = sel.value === "其他";
  other.style.display = show ? "block" : "none";
  if (!show) other.value = "";
}

/* ── Events Editor ── */
function renderEventsEditor(events) {
  const container = document.getElementById("eventsEditor");
  container.innerHTML = "";
  (events || []).forEach((e) => addEventRow(e));
}

function addEventRow(evt) {
  const container = document.getElementById("eventsEditor");
  const id = evt?.id || uid();
  const row = document.createElement("div");
  row.className = "event-row";
  row.dataset.id = id;

  const typeOptions = Object.entries(EVENT_TYPES)
    .map(
      ([k, v]) =>
        `<option value="${k}" ${evt?.type === k ? "selected" : ""}>${v.label}</option>`,
    )
    .join("");

  row.innerHTML = `
    <input type="date" class="evt-date" value="${evt?.date || ""}" />
    <select class="evt-type">${typeOptions}</select>
    <input type="text" class="evt-note" placeholder="备注（可选）" value="${esc(evt?.note || "")}" />
    <button class="btn btn-secondary btn-sm btn-icon evt-remove" onclick="removeEventRow(this)" title="删除">×</button>
  `;
  container.appendChild(row);
}

function removeEventRow(btn) {
  btn.closest(".event-row").remove();
}

function collectEvents() {
  return Array.from(document.querySelectorAll("#eventsEditor .event-row"))
    .map((row) => ({
      id: row.dataset.id,
      date: row.querySelector(".evt-date").value,
      type: row.querySelector(".evt-type").value,
      note: row.querySelector(".evt-note").value.trim(),
    }))
    .filter((e) => e.date);
}

/* ── Open Add/Edit ── */
function openModal(id) {
  editingId = id || null;
  document.getElementById("modalTitle").textContent = id
    ? "编辑投递"
    : "添加投递";
  initStarPickers();

  const r = id ? getRecord(id) : null;

  const textFields = [
    "company",
    "department",
    "position",
    "city",
    "link",
    "domain",
    "applyDate",
    "lastUpdate",
    "equity",
    "benefits",
    "progress",
    "notes",
    "salaryMin",
    "salaryMax",
  ];
  textFields.forEach((f) => {
    const el = document.getElementById("f_" + f);
    if (el) el.value = r ? (r[f] ?? "") : f === "applyDate" ? today() : "";
  });

  const selFields = [
    "status",
    "interviewRound",
    "written",
    "size",
    "salaryType",
  ];
  selFields.forEach((f) => {
    const el = document.getElementById("f_" + f);
    if (!el) return;
    el.value = r ? (r[f] ?? el.options[0]?.value) : el.options[0]?.value;
  });

  // Channel
  const chanSel = document.getElementById("f_channel");
  const chanOther = document.getElementById("f_channelOther");
  const knownChannels = Array.from(chanSel.options).map((o) => o.value);
  if (r && r.channel && !knownChannels.includes(r.channel)) {
    chanSel.value = "其他";
    chanOther.value = r.channel;
    chanOther.style.display = "block";
  } else {
    chanSel.value = r
      ? r.channel || chanSel.options[0].value
      : chanSel.options[0].value;
    chanOther.style.display = "none";
    chanOther.value = "";
  }

  // Ranges
  ["culture", "team"].forEach((f) => {
    const val = r ? r[f] || 3 : 3;
    document.getElementById("f_" + f).value = val;
    document.getElementById(f + "Val").textContent = val;
  });

  // Stars
  setStars("intentPicker", "f_intent", r ? r.intent || 0 : 0);
  setStars("matchPicker", "f_match", r ? r.match || 0 : 0);

  // Events — pre-populate with apply event if new record
  const initEvents = r
    ? r.events || []
    : [{ id: uid(), type: "apply", date: today(), note: "" }];
  renderEventsEditor(initEvents);

  document.getElementById("editModal").classList.add("open");
}

function closeModal() {
  document.getElementById("editModal").classList.remove("open");
  editingId = null;
}

function saveRecord() {
  const company = document.getElementById("f_company").value.trim();
  const position = document.getElementById("f_position").value.trim();
  const applyDate = document.getElementById("f_applyDate").value;

  if (!company || !position || !applyDate) {
    toast("请填写公司名称、岗位名称和投递日期", "error");
    return;
  }

  // Resolve channel
  const chanSel = document.getElementById("f_channel");
  let channel = chanSel.value;
  if (channel === "其他") {
    const custom = document.getElementById("f_channelOther").value.trim();
    channel = custom || "其他";
  }

  const record = {
    id: editingId || uid(),
    company,
    department: document.getElementById("f_department").value.trim(),
    position,
    applyDate,
    channel,
    link: document.getElementById("f_link").value.trim(),
    domain: document.getElementById("f_domain").value.trim(),
    city: document.getElementById("f_city").value.trim(),
    size: document.getElementById("f_size").value,
    status: document.getElementById("f_status").value,
    interviewRound: document.getElementById("f_interviewRound").value,
    written: document.getElementById("f_written").value,
    lastUpdate: document.getElementById("f_lastUpdate").value,
    progress: document.getElementById("f_progress").value.trim(),
    salaryMin: document.getElementById("f_salaryMin").value,
    salaryMax: document.getElementById("f_salaryMax").value,
    salaryType: document.getElementById("f_salaryType").value,
    equity: document.getElementById("f_equity").value.trim(),
    benefits: document.getElementById("f_benefits").value.trim(),
    intent: document.getElementById("f_intent").value,
    match: document.getElementById("f_match").value,
    culture: document.getElementById("f_culture").value,
    team: document.getElementById("f_team").value,
    notes: document.getElementById("f_notes").value.trim(),
    events: collectEvents(),
  };

  if (editingId) {
    updateRecord(record);
    toast("已更新 🎉", "success");
  } else {
    addRecord(record);
    toast("投递记录已添加 ✅", "success");
  }

  renderStats();
  renderTable();
  closeModal();
}

/* ── Detail Modal ── */
function openDetail(id) {
  detailId = id;
  const r = getRecord(id);
  if (!r) return;

  document.getElementById("detailTitle").innerHTML =
    `<div style="display:flex;align-items:center;gap:10px">${avatarHtml(r, 28)} ${esc(r.company)} · ${esc(r.position)}</div>`;

  const steps = [
    { label: "投递", done: true },
    {
      label: "笔试",
      done:
        ["笔试", "面试中", "Offer"].includes(r.status) ||
        (r.written && !["无笔试", "未参加"].includes(r.written)),
    },
    { label: "一面", done: +r.interviewRound >= 1 },
    { label: "二面", done: +r.interviewRound >= 2 },
    { label: "三面", done: +r.interviewRound >= 3 },
    { label: "HR面", done: r.interviewRound === "5" },
    { label: "Offer", done: r.status === "Offer" },
  ];
  const isReject = r.status === "已拒绝";
  const progressHtml = `
    <div class="progress-mini">
      ${steps.map((s) => `<div class="step-dot ${s.done ? (isReject ? "reject" : r.status === "Offer" ? "offer" : "done") : ""}" title="${s.label}"></div>`).join("")}
    </div>`;

  // Events timeline inside detail
  const eventsHtml =
    r.events && r.events.length
      ? `<div class="detail-section">
        <div class="detail-section-title">📅 事件时间线</div>
        <div class="detail-events">
          ${[...r.events]
            .sort((a, b) => (a.date > b.date ? 1 : -1))
            .map((e) => {
              const et = getEventType(e.type);
              return `<div class="detail-event-row">
              <div class="det-evt-dot" style="background:${et.color}"></div>
              <div class="det-evt-date">${e.date}</div>
              <span class="badge" style="background:${et.color}22;color:${et.color};border:1px solid ${et.color}44;font-size:.7rem;padding:2px 8px;border-radius:10px">${et.label}</span>
              ${e.note ? `<div class="det-evt-note">${esc(e.note)}</div>` : ""}
            </div>`;
            })
            .join("")}
        </div>
      </div>`
      : "";

  document.getElementById("detailBody").innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">📌 基本信息</div>
      <div class="detail-grid">
        <div class="detail-item"><label>公司</label><span>${esc(r.company)}</span></div>
        <div class="detail-item"><label>事业群/部门</label><span>${esc(r.department) || "—"}</span></div>
        <div class="detail-item"><label>岗位</label><span>${esc(r.position)}</span></div>
        <div class="detail-item"><label>城市</label><span>${esc(r.city) || "—"}</span></div>
        <div class="detail-item"><label>渠道</label><span>${esc(r.channel) || "—"}</span></div>
        <div class="detail-item"><label>投递日期</label><span>${r.applyDate || "—"}</span></div>
        <div class="detail-item"><label>公司规模</label><span>${esc(r.size) || "—"}</span></div>
        ${
          r.link
            ? `<div class="detail-item" style="grid-column:1/-1"><label>招聘链接</label>
          <a href="${esc(r.link)}" target="_blank" rel="noopener" class="detail-link">
            🔗 ${esc(r.link.length > 60 ? r.link.slice(0, 60) + "…" : r.link)}
          </a></div>`
            : ""
        }
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">📊 进度追踪</div>
      ${progressHtml}
      <div class="detail-grid" style="margin-top:12px">
        <div class="detail-item"><label>当前状态</label><span>${statusBadge(r.status)}</span></div>
        <div class="detail-item"><label>面试轮次</label><span>${interviewLabel(r.interviewRound)}</span></div>
        <div class="detail-item"><label>笔试情况</label><span>${esc(r.written) || "—"}</span></div>
        <div class="detail-item"><label>最近进展</label><span>${r.lastUpdate || "—"}</span></div>
      </div>
      ${r.progress ? `<div class="detail-item" style="margin-top:10px"><label>进展备注</label><p style="font-size:.85rem;margin-top:4px;white-space:pre-wrap;line-height:1.6">${esc(r.progress)}</p></div>` : ""}
    </div>
    ${eventsHtml}
    <div class="detail-section">
      <div class="detail-section-title">💰 薪资与福利</div>
      <div class="detail-grid">
        <div class="detail-item"><label>薪资范围</label><span style="color:var(--success)">${salaryStr(r)} · ${esc(r.salaryType) || "—"}</span></div>
        <div class="detail-item"><label>期权/股票</label><span>${esc(r.equity) || "—"}</span></div>
        <div class="detail-item"><label>其他福利</label><span>${esc(r.benefits) || "—"}</span></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">⭐ 主观评价</div>
      <div class="detail-grid">
        <div class="detail-item"><label>意向度</label><span>${starsHtml(r.intent)}</span></div>
        <div class="detail-item"><label>匹配度</label><span>${starsHtml(r.match)}</span></div>
        <div class="detail-item"><label>公司文化</label><span>${starsHtml(r.culture)}</span></div>
        <div class="detail-item"><label>团队氛围</label><span>${starsHtml(r.team)}</span></div>
      </div>
      ${r.notes ? `<div class="detail-item" style="margin-top:10px"><label>综合备注</label><p style="font-size:.85rem;margin-top:4px;white-space:pre-wrap;line-height:1.6">${esc(r.notes)}</p></div>` : ""}
    </div>
  `;

  document.getElementById("detailModal").classList.add("open");
}

function closeDetail() {
  document.getElementById("detailModal").classList.remove("open");
  detailId = null;
}

function editFromDetail() {
  const id = detailId;
  closeDetail();
  openModal(id);
}

function deleteFromDetail() {
  const r = getRecord(detailId);
  if (!r) return;
  if (!confirm(`删除「${r.company} · ${r.position}」？此操作不可撤销。`))
    return;
  removeRecord(detailId);
  renderStats();
  renderTable();
  closeDetail();
  toast("已删除", "info");
}
