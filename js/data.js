/* ── data.js: CRUD, localStorage, 常量, import/export ── */
"use strict";

const STORAGE_KEY = "job_tracker_v2";
let records = [];

/* ── 公司域名映射（用于自动获取 Logo） ── */
const COMPANY_DOMAINS = {
  字节跳动: "bytedance.com",
  腾讯: "tencent.com",
  阿里巴巴: "alibaba.com",
  阿里云: "aliyun.com",
  百度: "baidu.com",
  美团: "meituan.com",
  京东: "jd.com",
  小红书: "xiaohongshu.com",
  B站: "bilibili.com",
  哔哩哔哩: "bilibili.com",
  快手: "kuaishou.com",
  滴滴出行: "didiglobal.com",
  蚂蚁集团: "antgroup.com",
  网易: "netease.com",
  得物: "dewu.com",
  Shopee: "shopee.com",
  PingCAP: "pingcap.com",
  货拉拉: "huolala.cn",
  Figma: "figma.com",
  Vercel: "vercel.com",
  OPPO: "oppo.com",
  vivo: "vivo.com.cn",
  华为: "huawei.com",
  小米: "mi.com",
  拼多多: "pinduoduo.com",
  携程: "trip.com",
  爱奇艺: "iqiyi.com",
  GitHub: "github.com",
  Google: "google.com",
  Meta: "meta.com",
  Apple: "apple.com",
  Microsoft: "microsoft.com",
  Netflix: "netflix.com",
  Airbnb: "airbnb.com",
  Stripe: "stripe.com",
  Notion: "notion.so",
  Linear: "linear.app",
  Atlassian: "atlassian.com",
  Shopify: "shopify.com",
};

/* ── 事件类型定义 ── */
const EVENT_TYPES = {
  apply: { label: "投递", color: "#48b0f1" },
  written: { label: "笔试", color: "#00c8e0" },
  interview1: { label: "一面", color: "#6c63ff" },
  interview2: { label: "二面", color: "#8a83ff" },
  interview3: { label: "三面", color: "#a89eff" },
  interview4: { label: "四面+", color: "#c4bcff" },
  hr: { label: "HR面", color: "#f5a623" },
  offer: { label: "Offer", color: "#3ecf8e" },
  reject: { label: "拒信", color: "#f56565" },
  other: { label: "其他", color: "#8892b0" },
};

function getEventType(type) {
  return EVENT_TYPES[type] || EVENT_TYPES.other;
}

/* ── 已知招聘平台域名（链接域名不用于公司图标） ── */
const PLATFORM_HOSTS = new Set([
  "zhipin.com",
  "boss.zhipin.com",
  "lagou.com",
  "zhaopin.com",
  "51job.com",
  "liepin.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "maimai.cn",
  "weixin.qq.com",
  "mp.weixin.qq.com",
  "github.com", // 招聘帖子链接，但公司 logo 用 company 名来查
]);

function domainFromLink(link) {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return PLATFORM_HOSTS.has(host) ? null : host;
  } catch {
    return null;
  }
}

function getCompanyDomain(r) {
  return (
    r.domain || domainFromLink(r.link) || COMPANY_DOMAINS[r.company] || null
  );
}

function logoUrl(r) {
  const d = getCompanyDomain(r);
  return d ? `https://img.logo.dev/${d}?token=pk_IsGXuD4nTdCNiHvLCLfRYQ` : null;
}

/* ── CRUD ── */
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch {
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getRecord(id) {
  return records.find((r) => r.id === id);
}

function addRecord(r) {
  r.id = uid();
  r.createdAt = new Date().toISOString();
  r.updatedAt = r.createdAt;
  records.unshift(r);
  saveRecords();
}

function updateRecord(r) {
  r.updatedAt = new Date().toISOString();
  const idx = records.findIndex((x) => x.id === r.id);
  if (idx !== -1) records[idx] = r;
  saveRecords();
}

function removeRecord(id) {
  records = records.filter((r) => r.id !== id);
  saveRecords();
}

function clearRecords() {
  records = [];
  saveRecords();
}

/* ── 获取所有事件（跨记录打平） ── */
function getAllEvents() {
  const all = [];
  records.forEach((r) => {
    const evts =
      r.events && r.events.length
        ? r.events
        : [{ id: "auto", type: "apply", date: r.applyDate, note: "" }];
    evts.forEach((e) => {
      if (e.date) all.push({ ...e, record: r });
    });
  });
  return all;
}

/* ── 获取某日期的所有事件 ── */
function getEventsByDate(dateStr) {
  return getAllEvents().filter((e) => e.date === dateStr);
}

/* ── Export ── */
function exportJSON() {
  if (!records.length) {
    toast("暂无数据", "info");
    return;
  }
  const blob = new Blob([JSON.stringify(records, null, 2)], {
    type: "application/json",
  });
  dlBlob(blob, `job-tracker-${today()}.json`);
  toast("已导出 JSON ✅", "success");
}

function exportCSV() {
  if (!records.length) {
    toast("暂无数据", "info");
    return;
  }
  const headers = [
    "公司",
    "事业群/部门",
    "岗位",
    "城市",
    "渠道",
    "投递日期",
    "状态",
    "面试轮次",
    "笔试",
    "最近进展日期",
    "薪资下限K",
    "薪资上限K",
    "薪资结构",
    "期权股票",
    "其他福利",
    "意向度",
    "匹配度",
    "文化印象",
    "团队氛围",
    "进展备注",
    "综合备注",
  ];
  const rows = records.map((r) =>
    [
      r.company,
      r.department,
      r.position,
      r.city,
      r.channel,
      r.applyDate,
      r.status,
      interviewLabel(r.interviewRound),
      r.written,
      r.lastUpdate,
      r.salaryMin,
      r.salaryMax,
      r.salaryType,
      r.equity,
      r.benefits,
      r.intent,
      r.match,
      r.culture,
      r.team,
      r.progress,
      r.notes,
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  dlBlob(blob, `job-tracker-${today()}.csv`);
  toast("已导出 CSV ✅", "success");
}

function importData() {
  document.getElementById("importFile").click();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error("非数组");
      const existIds = new Set(records.map((r) => r.id));
      let added = 0;
      imported.forEach((r) => {
        if (r.id && r.company && r.position) {
          if (!existIds.has(r.id)) {
            records.push(r);
            added++;
          }
        }
      });
      saveRecords();
      renderStats();
      renderTable();
      toast(`导入完成，新增 ${added} 条 ✅`, "success");
    } catch {
      toast("导入失败：格式不正确", "error");
    }
    e.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

/* ── 工具函数 ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dlBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function interviewLabel(v) {
  const map = {
    0: "未开始",
    1: "一面",
    2: "二面",
    3: "三面",
    4: "四面+",
    5: "HR面",
  };
  return map[String(v)] || "—";
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function salaryStr(r) {
  if (!r.salaryMin && !r.salaryMax) return "—";
  return `${r.salaryMin || "?"}~${r.salaryMax || "?"}K`;
}

function statusBadge(status) {
  const map = {
    Offer: "offer",
    面试中: "process",
    笔试: "test",
    待回复: "pending",
    已拒绝: "reject",
    已鸽: "ghost",
  };
  return `<span class="badge badge-${map[status] || "ghost"}">${esc(status)}</span>`;
}

function starsHtml(n, max = 5) {
  n = Number(n) || 0;
  return `<span class="stars">${"★".repeat(n)}<span class="empty">${"★".repeat(max - n)}</span></span>`;
}

function avatarColor(company) {
  const palette = [
    "#5a52e0",
    "#2b8fd4",
    "#27ae60",
    "#e67e22",
    "#e74c3c",
    "#8e44ad",
    "#16a085",
    "#2980b9",
  ];
  let h = 0;
  for (const c of company || "?")
    h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[Math.abs(h)];
}

function statusDotColor(status) {
  const map = {
    Offer: "#3ecf8e",
    面试中: "#8a83ff",
    笔试: "#48b0f1",
    待回复: "#f5a623",
    已拒绝: "#f56565",
    已鸽: "#8892b0",
  };
  return map[status] || "#8892b0";
}

/* ── 公司头像 HTML（支持 Logo + 字母降级） ── */
function avatarHtml(r, size = 34) {
  const url = logoUrl(r);
  const bg = avatarColor(r.company);
  const letter = esc((r.company || "?")[0].toUpperCase());
  const radius = Math.round(size * 0.26);
  const fs = Math.round(size * 0.41);

  if (url) {
    return `<div class="co-avatar" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg}">
      <span class="av-letter" style="font-size:${fs}px">${letter}</span>
      <img class="av-img" src="${url}" alt="${letter}"
           onerror="this.setAttribute('data-error','1')" />
    </div>`;
  }
  return `<div class="co-avatar" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg}">
    <span class="av-letter" style="font-size:${fs}px">${letter}</span>
  </div>`;
}
