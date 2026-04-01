/* ── views.js: 时间线 + 日历 + 统计图表 ── */
"use strict";

/* ══════════════════════════════════════════════════════
   时间线（事件流，按日期展开）
══════════════════════════════════════════════════════ */
function renderTimeline() {
  const el = document.getElementById("timelineContent");
  const allEvts = getAllEvents();

  if (!allEvts.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><h3>暂无记录</h3><p>添加投递并记录事件后，时间线将在此展示</p></div>`;
    return;
  }

  // Sort desc by date
  allEvts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  // Group by date
  const groups = {};
  allEvts.forEach((e) => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  const todayStr = today();

  el.innerHTML =
    `<div style="max-width:720px">` +
    Object.entries(groups)
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([date, evts]) => {
        const d = new Date(date + "T00:00:00");
        const isToday = date === todayStr;
        const dayLabel = d.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        });
        const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
        const relLabel = isToday
          ? "今天"
          : daysAgo === 1
            ? "昨天"
            : daysAgo > 0
              ? `${daysAgo}天前`
              : `${-daysAgo}天后`;

        return `
          <div class="tl-date-group">
            <div class="tl-date-header ${isToday ? "is-today" : ""}">
              <span class="tl-date-label">${dayLabel}</span>
              <span class="tl-date-rel">${relLabel}</span>
              <span class="tl-date-count">${evts.length}件</span>
            </div>
            <div class="tl-track">
              ${evts.map((e) => renderTlEvent(e)).join("")}
            </div>
          </div>`;
      })
      .join("") +
    `</div>`;
}

function renderTlEvent(e) {
  const r = e.record;
  const et = getEventType(e.type);

  return `
    <div class="tl-item" onclick="openDetail('${r.id}')">
      <div class="tl-dot" style="background:${et.color}"></div>
      <div class="tl-item-inner">
        ${avatarHtml(r, 32)}
        <div class="tl-item-body">
          <div class="tl-item-header">
            <span class="tl-company">${esc(r.company)}</span>
            ${r.department ? `<span class="tl-position">· ${esc(r.department)}</span>` : ""}
            <span class="tl-position">· ${esc(r.position)}</span>
            <span class="evt-chip" style="background:${et.color}22;color:${et.color};border:1px solid ${et.color}44">${et.label}</span>
          </div>
          ${e.note ? `<div class="tl-note">"${esc(e.note)}"</div>` : ""}
          <div class="tl-meta-row">
            ${r.city ? `<span class="tl-meta-tag">📍${esc(r.city)}</span>` : ""}
            ${salaryStr(r) !== "—" ? `<span class="tl-meta-tag" style="color:var(--success)">💰${salaryStr(r)}</span>` : ""}
            ${+r.intent > 0 ? `<span class="tl-meta-tag">${starsHtml(r.intent)}</span>` : ""}
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   日历
══════════════════════════════════════════════════════ */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let calSelectedDate = null;

function renderCalendar() {
  updateCalHeader();
  drawCalGrid();
}

function calNav(delta) {
  calMonth += delta;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
}

function calGoToday() {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
  calSelectedDate = today();
  renderCalendar();
  renderDayPanel(calSelectedDate);
}

function updateCalHeader() {
  const mn = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ];
  document.getElementById("calTitle").textContent =
    `${calYear}年 ${mn[calMonth]}`;

  // Month stats
  const prefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const monthEvts = getAllEvents().filter((e) => e.date.startsWith(prefix));
  const applyC = monthEvts.filter((e) => e.type === "apply").length;
  const interviewC = monthEvts.filter((e) =>
    ["interview1", "interview2", "interview3", "interview4", "hr"].includes(
      e.type,
    ),
  ).length;
  const offerC = monthEvts.filter((e) => e.type === "offer").length;
  const writtenC = monthEvts.filter((e) => e.type === "written").length;

  document.getElementById("calStats").innerHTML = `
    <span class="cal-stat-item" style="color:var(--accent2)">投递 ${applyC}</span>
    <span class="cal-stat-sep">·</span>
    <span class="cal-stat-item" style="color:var(--accent)">笔试 ${writtenC}</span>
    <span class="cal-stat-sep">·</span>
    <span class="cal-stat-item" style="color:#8a83ff">面试 ${interviewC}</span>
    <span class="cal-stat-sep">·</span>
    <span class="cal-stat-item" style="color:var(--success)">Offer ${offerC}</span>
  `;
}

function drawCalGrid() {
  const grid = document.getElementById("calGrid");
  const todayStr = today();
  const first = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
  const startWd = first.getDay(); // 0=Sun

  // Build event index for this month
  const prefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const evtMap = {};
  getAllEvents()
    .filter((e) => e.date.startsWith(prefix))
    .forEach((e) => {
      if (!evtMap[e.date]) evtMap[e.date] = [];
      evtMap[e.date].push(e);
    });

  let html = "";

  // Leading empty cells
  for (let i = 0; i < startWd; i++) {
    html += `<div class="cal-cell cal-cell-empty"></div>`;
  }

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evts = evtMap[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isSel = dateStr === calSelectedDate;
    const hasEvt = evts.length > 0;

    const chips = evts
      .slice(0, 2)
      .map((e) => {
        const et = getEventType(e.type);
        return `<div class="cal-chip" style="background:${et.color}22;color:${et.color};border-left:2px solid ${et.color}">
        ${avatarHtml(e.record, 16)} <span>${et.label}</span>
      </div>`;
      })
      .join("");

    const more =
      evts.length > 2
        ? `<div class="cal-chip-more">+${evts.length - 2}</div>`
        : "";

    html += `
      <div class="cal-cell ${isToday ? "is-today" : ""} ${isSel ? "is-selected" : ""} ${hasEvt ? "has-events" : ""}"
           onclick="calSelectDay('${dateStr}')">
        <div class="cal-day-num">${d}</div>
        <div class="cal-chips">${chips}${more}</div>
      </div>`;
  }

  grid.innerHTML = html;
}

function calSelectDay(dateStr) {
  calSelectedDate = dateStr;
  // Re-highlight selected cell without full redraw
  document
    .querySelectorAll(".cal-cell")
    .forEach((c) => c.classList.remove("is-selected"));
  document.querySelectorAll(".cal-cell").forEach((c) => {
    const onclick = c.getAttribute("onclick");
    if (onclick && onclick.includes(`'${dateStr}'`))
      c.classList.add("is-selected");
  });
  renderDayPanel(dateStr);
}

function renderDayPanel(dateStr) {
  const panel = document.getElementById("calDayPanel");
  const evts = getEventsByDate(dateStr);
  const d = new Date(dateStr + "T00:00:00");
  const dayLabel = d.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  if (!evts.length) {
    panel.innerHTML = `
      <div class="cal-panel-header">${dayLabel}</div>
      <div class="cal-day-empty" style="margin-top:40px">当天没有事件</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="cal-panel-header">${dayLabel} <span style="color:var(--text2);font-size:.8rem">${evts.length}件</span></div>
    ${evts
      .map((e) => {
        const r = e.record;
        const et = getEventType(e.type);
        return `
        <div class="cal-panel-event" onclick="openDetail('${r.id}')">
          <div class="cal-panel-evt-dot" style="background:${et.color}"></div>
          <div class="cal-panel-evt-body">
            <div class="cal-panel-evt-header">
              ${avatarHtml(r, 22)}
              <span class="cal-panel-company">${esc(r.company)}</span>
              ${r.department ? `<span style="font-size:.75rem;color:var(--text2)">· ${esc(r.department)}</span>` : ""}
              <span class="evt-chip cal-panel-evt-chip" style="background:${et.color}22;color:${et.color};border:1px solid ${et.color}44;font-size:.7rem">${et.label}</span>
            </div>
            <div class="cal-panel-position">${esc(r.position)}${r.city ? " · " + esc(r.city) : ""}</div>
            ${e.note ? `<div class="cal-panel-note">"${esc(e.note)}"</div>` : ""}
          </div>
        </div>`;
      })
      .join("")}`;
}

/* ══════════════════════════════════════════════════════
   统计图表
══════════════════════════════════════════════════════ */
function renderCharts() {
  const el = document.getElementById("chartsContent");
  if (!records.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>暂无数据</h3></div>`;
    return;
  }

  el.innerHTML = `
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">状态分布</div>
        <canvas id="cvStatus" width="260" height="200"></canvas>
        <div id="statusLegend" style="margin-top:12px"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">投递漏斗</div>
        <div class="funnel" id="funnelChart"></div>
      </div>
      <div class="chart-card full">
        <div class="chart-title">每月投递量</div>
        <canvas id="cvMonthly" width="900" height="180"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">渠道分布</div>
        <div id="channelChart"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">薪资区间分布 (K/月)</div>
        <canvas id="cvSalary" width="260" height="180"></canvas>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    drawStatusDonut();
    drawMonthlyBar();
    drawFunnel();
    drawChannelBars();
    drawSalaryBar();
  });
}

/* ── Donut ── */
function prepareChartCanvas(canvas, cssW, cssH) {
  const W = Math.max(1, Math.round(cssW || canvas.clientWidth || canvas.width));
  const H = Math.max(
    1,
    Math.round(cssH || canvas.clientHeight || canvas.height),
  );
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

function drawStatusDonut() {
  const canvas = document.getElementById("cvStatus");
  if (!canvas) return;
  const { ctx, W, H } = prepareChartCanvas(canvas);
  const groups = {
    Offer: { color: "#3ecf8e", label: "Offer" },
    面试中: { color: "#8a83ff", label: "面试中" },
    笔试: { color: "#48b0f1", label: "笔试" },
    待回复: { color: "#f5a623", label: "待回复" },
    已拒绝: { color: "#f56565", label: "已拒绝" },
    已鸽: { color: "#8892b0", label: "已鸽" },
  };
  const counts = {};
  records.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });
  const data = Object.entries(groups)
    .map(([k, v]) => ({ ...v, count: counts[k] || 0 }))
    .filter((d) => d.count > 0);
  const total = data.reduce((s, d) => s + d.count, 0);
  const cx = W / 2,
    cy = H / 2,
    R = Math.min(cx, cy) - 10,
    r = R * 0.58;
  ctx.clearRect(0, 0, W, H);
  let angle = -Math.PI / 2;
  data.forEach((d) => {
    const slice = (d.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.strokeStyle = getCSSVar("--surface");
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += slice;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = getCSSVar("--surface");
  ctx.fill();
  ctx.fillStyle = getCSSVar("--text");
  ctx.font = `bold 22px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total, cx, cy - 8);
  ctx.font = `11px system-ui`;
  ctx.fillStyle = getCSSVar("--text2");
  ctx.fillText("总投递", cx, cy + 12);
  document.getElementById("statusLegend").innerHTML = data
    .map(
      (d) =>
        `<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;margin-bottom:4px">
      <span style="width:10px;height:10px;border-radius:50%;background:${d.color};display:inline-block;flex-shrink:0"></span>
      <span style="color:var(--text)">${d.label}</span>
      <span style="color:var(--text2);margin-left:auto">${d.count} (${Math.round((d.count / total) * 100)}%)</span>
    </div>`,
    )
    .join("");
}

/* ── Monthly bar ── */
function drawMonthlyBar() {
  const canvas = document.getElementById("cvMonthly");
  if (!canvas) return;
  const monthMap = {};
  records.forEach((r) => {
    if (!r.applyDate) return;
    const key = r.applyDate.slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + 1;
  });
  const keys = Object.keys(monthMap).sort();
  if (!keys.length) return;
  const { ctx, W, H } = prepareChartCanvas(
    canvas,
    canvas.offsetWidth || canvas.width,
    canvas.height,
  );
  ctx.clearRect(0, 0, W, H);
  const pad = { left: 30, right: 14, top: 12, bottom: 32 };
  const chartW = W - pad.left - pad.right,
    chartH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...Object.values(monthMap));
  const barW = Math.max(14, Math.min(40, chartW / keys.length - 8));
  ctx.fillStyle = getCSSVar("--text2");
  ctx.font = "10px system-ui";
  ctx.textAlign = "right";
  [0, Math.ceil(maxVal / 2), maxVal].forEach((v) => {
    const y = pad.top + chartH - (v / maxVal) * chartH;
    ctx.fillText(v, pad.left - 4, y + 3);
    ctx.strokeStyle = getCSSVar("--border");
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  });
  const accent = getCSSVar("--accent"),
    accent2 = getCSSVar("--accent2");
  keys.forEach((key, i) => {
    const val = monthMap[key];
    const x =
      pad.left + (i / keys.length) * chartW + (chartW / keys.length - barW) / 2;
    const barH = (val / maxVal) * chartH;
    const y = pad.top + chartH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, accent2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();
    if (barH > 16) {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 10px system-ui";
      ctx.fillText(val, x + barW / 2, y + 12);
    }
    ctx.fillStyle = getCSSVar("--text2");
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    const [yr, mo] = key.split("-");
    ctx.fillText(`${yr.slice(2)}/${mo}`, x + barW / 2, H - pad.bottom + 14);
  });
}

/* ── Funnel ── */
function drawFunnel() {
  const el = document.getElementById("funnelChart");
  if (!el) return;
  const total = records.length;
  const steps = [
    { label: "投递", count: total, color: "#48b0f1" },
    {
      label: "笔试",
      count: records.filter(
        (r) => r.written && !["无笔试", "未参加"].includes(r.written),
      ).length,
      color: "#6c63ff",
    },
    {
      label: "面试",
      count: records.filter(
        (r) => +r.interviewRound >= 1 || r.status === "面试中",
      ).length,
      color: "#8a83ff",
    },
    {
      label: "Offer",
      count: records.filter((r) => r.status === "Offer").length,
      color: "#3ecf8e",
    },
  ];
  el.innerHTML = steps
    .map((s) => {
      const pct = total > 0 ? ((s.count / total) * 100).toFixed(0) : 0;
      return `
      <div class="funnel-row">
        <span class="funnel-label">${s.label}</span>
        <div class="funnel-bar" style="width:${Math.max(20, +pct)}%;background:${s.color}">${s.count}</div>
        <span class="funnel-count">${pct}%</span>
      </div>`;
    })
    .join("");
}

/* ── Channel horizontal bars ── */
function drawChannelBars() {
  const el = document.getElementById("channelChart");
  if (!el) return;
  const counts = {};
  records.forEach((r) => {
    if (r.channel) counts[r.channel] = (counts[r.channel] || 0) + 1;
  });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  const colors = [
    "#6c63ff",
    "#48b0f1",
    "#3ecf8e",
    "#f5a623",
    "#f56565",
    "#8e44ad",
    "#16a085",
    "#e67e22",
  ];
  el.innerHTML = sorted
    .map(
      ([name, val], i) => `
    <div class="hbar-item">
      <div class="hbar-label"><span class="name">${esc(name)}</span><span class="val">${val}</span></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(val / max) * 100}%;background:${colors[i % colors.length]}"></div></div>
    </div>`,
    )
    .join("");
}

/* ── Salary bar ── */
function drawSalaryBar() {
  const canvas = document.getElementById("cvSalary");
  if (!canvas) return;
  const { ctx, W, H } = prepareChartCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  const buckets = {
    "0-10K": 0,
    "10-15K": 0,
    "15-20K": 0,
    "20-30K": 0,
    "30-40K": 0,
    "40K+": 0,
  };
  records.forEach((r) => {
    const min = +r.salaryMin,
      max = +r.salaryMax;
    if (!min && !max) return;
    const mid = (min + (max || min)) / 2;
    if (mid < 10) buckets["0-10K"]++;
    else if (mid < 15) buckets["10-15K"]++;
    else if (mid < 20) buckets["15-20K"]++;
    else if (mid < 30) buckets["20-30K"]++;
    else if (mid < 40) buckets["30-40K"]++;
    else buckets["40K+"]++;
  });
  const entries = Object.entries(buckets).filter(([, v]) => v > 0);
  if (!entries.length) {
    ctx.fillStyle = getCSSVar("--text2");
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("暂无薪资数据", W / 2, H / 2);
    return;
  }
  const maxVal = Math.max(...entries.map(([, v]) => v));
  const pad = { left: 10, right: 10, top: 14, bottom: 28 };
  const chartW = W - pad.left - pad.right,
    chartH = H - pad.top - pad.bottom;
  const allKeys = Object.keys(buckets);
  const barW = chartW / allKeys.length - 6;
  const colors = [
    "#48b0f1",
    "#6c63ff",
    "#8a83ff",
    "#3ecf8e",
    "#f5a623",
    "#f56565",
  ];
  allKeys.forEach((key, i) => {
    const val = buckets[key];
    if (!val) return;
    const x = pad.left + i * (barW + 6);
    const barH = (val / maxVal) * chartH;
    const y = pad.top + chartH - barH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = getCSSVar("--text");
    ctx.font = "bold 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(val, x + barW / 2, y - 4);
    ctx.fillStyle = getCSSVar("--text2");
    ctx.font = "8px system-ui";
    ctx.fillText(key, x + barW / 2, H - pad.bottom + 12);
  });
}

function getCSSVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
