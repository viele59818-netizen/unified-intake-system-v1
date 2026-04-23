const STORAGE_KEY = "weixin-intake-v1.entries";
const PREFS_STORAGE_KEY = "weixin-intake-v1.prefs";
const API_BASE_URL = resolveApiBaseUrl();

const form = document.getElementById("intakeForm");
const entryList = document.getElementById("entryList");
const emptyState = document.getElementById("emptyState");
const entryTemplate = document.getElementById("entryTemplate");
const entryCount = document.getElementById("entryCount");
const topicCount = document.getElementById("topicCount");
const lastUpdated = document.getElementById("lastUpdated");
const topicList = document.getElementById("topicList");
const starFilter = document.getElementById("starFilter");
const statusFilter = document.getElementById("statusFilter");
const topicFilter = document.getElementById("topicFilter");
const topicInput = document.getElementById("topic");
const sourceTypeInput = document.getElementById("sourceType");
const imageFilesInput = document.getElementById("imageFiles");
const videoFilesInput = document.getElementById("videoFiles");
const imageFileList = document.getElementById("imageFileList");
const videoFileList = document.getElementById("videoFileList");
const toast = document.getElementById("toast");
const quickSourceButtons = Array.from(document.querySelectorAll(".quick-source-button"));
const topicFocusPanel = document.getElementById("topicFocusPanel");
const topicFocusTitle = document.getElementById("topicFocusTitle");
const topicFocusSubtitle = document.getElementById("topicFocusSubtitle");
const topicFocusStats = document.getElementById("topicFocusStats");
const topicFocusSummary = document.getElementById("topicFocusSummary");
const topicNoteInput = document.getElementById("topicNoteInput");
const saveTopicNoteButton = document.getElementById("saveTopicNoteButton");
const topicActionInput = document.getElementById("topicActionInput");
const addTopicActionButton = document.getElementById("addTopicActionButton");
const saveTopicActionButton = document.getElementById("saveTopicActionButton");
const topicActionList = document.getElementById("topicActionList");
const topicRecentEntries = document.getElementById("topicRecentEntries");
const exportTopicSummaryButton = document.getElementById("exportTopicSummaryButton");
const exportTopicActionsButton = document.getElementById("exportTopicActionsButton");
const exportTaskFormatButton = document.getElementById("exportTaskFormatButton");
const deleteTopicButton = document.getElementById("deleteTopicButton");
const clearTopicFocusButton = document.getElementById("clearTopicFocusButton");

let currentEntries = [];
let selectedImageFiles = [];
let selectedVideoFiles = [];
let toastTimer = null;
let activeTopic = "全部";
let topicNotes = {};
let topicActions = {};
let editingTopicActions = [];

document.getElementById("resetFormButton").addEventListener("click", resetForm);
document.getElementById("seedDemoButton").addEventListener("click", seedDemoData);
document.getElementById("clearEntriesButton").addEventListener("click", clearEntries);
document.getElementById("exportJsonButton").addEventListener("click", exportJson);
document.getElementById("exportMarkdownButton").addEventListener("click", exportMarkdown);
starFilter.addEventListener("change", applyFilters);
statusFilter.addEventListener("change", applyFilters);
topicFilter.addEventListener("change", applyFilters);
clearTopicFocusButton.addEventListener("click", clearTopicFocus);
exportTopicSummaryButton.addEventListener("click", exportActiveTopicSummary);
exportTopicActionsButton.addEventListener("click", exportActiveTopicActions);
exportTaskFormatButton.addEventListener("click", exportActiveTopicTaskFormat);
deleteTopicButton.addEventListener("click", deleteActiveTopic);
saveTopicNoteButton.addEventListener("click", saveActiveTopicNote);
addTopicActionButton.addEventListener("click", addTopicAction);
saveTopicActionButton.addEventListener("click", saveActiveTopicAction);
topicInput.addEventListener("input", persistPreferences);
sourceTypeInput.addEventListener("change", () => {
  syncQuickSourceButtons();
  persistPreferences();
});
quickSourceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sourceTypeInput.value = button.dataset.source;
    syncQuickSourceButtons();
    persistPreferences();
    showToast(`来源已切换为「${button.dataset.source}」`);
  });
});
imageFilesInput.addEventListener("change", (event) => {
  selectedImageFiles = mergeSelectedFiles(selectedImageFiles, event.target.files);
  imageFilesInput.value = "";
  renderSelectedFiles();
});
videoFilesInput.addEventListener("change", (event) => {
  selectedVideoFiles = mergeSelectedFiles(selectedVideoFiles, event.target.files);
  videoFilesInput.value = "";
  renderSelectedFiles();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const entry = await readFormEntry();
  const result = await saveEntry(entry);
  setEntries(result.entries);
  persistPreferences();
  showToast(result.mode === "backend" ? "已提交到输入池" : "后端不可用，已暂存到本地");
  form.reset();
  restorePreferences();
});

initialize();

async function initialize() {
  restorePreferences();
  syncQuickSourceButtons();
  topicNotes = await getTopicNotes();
  topicActions = await getTopicActions();
  const entries = await getEntries();
  setEntries(entries);
}

function setEntries(entries) {
  currentEntries = entries;
  renderTopicList(entries);
  updateTopicFilter(entries);
  renderTopicFocus(entries);
  renderEntries(getFilteredEntries(entries));
}

function resolveApiBaseUrl() {
  if (window.location.protocol === "file:") {
    return "http://127.0.0.1:8787";
  }

  return window.location.origin;
}

async function readFormEntry() {
  const imageFiles = await serializeFiles(selectedImageFiles);
  const videoFiles = await serializeFiles(selectedVideoFiles);

  return {
    id: crypto.randomUUID(),
    topic: valueOf("topic"),
    title: valueOf("title"),
    sourceType: valueOf("sourceType"),
    rawContent: valueOf("rawContent"),
    link: valueOf("link"),
    note: valueOf("note"),
    imageFiles,
    videoFiles,
    createdAt: new Date().toISOString(),
    status: "待处理",
  };
}

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

async function serializeFiles(fileList) {
  const files = Array.from(fileList);
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file),
    })),
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Failed to parse entries:", error);
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function saveEntry(entry) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      throw new Error(`Backend save failed with status ${response.status}`);
    }

    const entries = await fetchEntriesFromBackend();
    return { mode: "backend", entries };
  } catch (error) {
    console.warn("Falling back to local storage:", error);
    const entries = loadEntries();
    entries.unshift(entry);
    saveEntries(entries);
    return { mode: "local", entries };
  }
}

async function getEntries() {
  try {
    return await fetchEntriesFromBackend();
  } catch (error) {
    console.warn("Backend unavailable, reading local entries:", error);
    return loadEntries();
  }
}

async function fetchEntriesFromBackend() {
  const response = await fetch(`${API_BASE_URL}/api/entries`);
  if (!response.ok) {
    throw new Error(`Backend fetch failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.entries || [];
}

function renderEntries(entries) {
  entryList.innerHTML = "";
  emptyState.hidden = entries.length > 0;

  entries.forEach((entry) => {
    const fragment = entryTemplate.content.cloneNode(true);
    const topicElement = fragment.querySelector(".entry-topic");
    topicElement.textContent = entry.topic || "未命名专题";
    topicElement.classList.toggle("starred", Boolean(entry.starred));
    fragment.querySelector(".entry-title").textContent = entry.title || "未命名输入";
    fragment.querySelector(".entry-source").textContent = entry.sourceType || "其他";
    fragment.querySelector(".entry-meta").textContent =
      `${formatDate(entry.createdAt)} · ${entry.status}`;

    const body = fragment.querySelector(".entry-body");
    appendParagraph(body, entry.rawContent, "原始内容");
    appendParagraph(body, entry.link, "链接");
    appendParagraph(body, entry.note, "备注");

    const statusSelect = fragment.querySelector(".entry-status-select");
    statusSelect.value = entry.status || "待处理";
    statusSelect.addEventListener("change", async (event) => {
      const nextStatus = event.target.value;
      await updateEntryStatus(entry.id, nextStatus);
    });

    const starButton = fragment.querySelector(".entry-star-button");
    syncStarButton(starButton, Boolean(entry.starred));
    starButton.addEventListener("click", async () => {
      await updateEntryStar(entry.id, !entry.starred);
    });

    const summary = fragment.querySelector(".entry-summary");
    appendParagraph(summary, summarizeEntry(entry), "");

    const detail = fragment.querySelector(".entry-detail");
    const toggleButton = fragment.querySelector(".entry-toggle-button");
    toggleButton.addEventListener("click", () => {
      const willExpand = detail.hidden;
      detail.hidden = !willExpand;
      toggleButton.textContent = willExpand ? "收起详情" : "展开详情";
    });

    const assets = fragment.querySelector(".entry-assets");
    renderAssetChips(assets, "图片", entry.imageFiles || []);
    renderAssetChips(assets, "视频", entry.videoFiles || []);

    entryList.appendChild(fragment);
  });

  updateStats(entries);
}

function renderTopicList(entries) {
  const groups = groupEntriesByTopic(entries);
  topicList.innerHTML = "";

  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>还没有专题</h3><p>提交几条输入后，这里会按专题聚合显示。</p>";
    topicList.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    const card = document.createElement("article");
    card.className = "topic-card";
    card.classList.toggle("active", activeTopic === group.topic);
    card.innerHTML = `
      <h3>${escapeHtml(group.topic)}</h3>
      <p>输入数：${group.count}</p>
      <p>待处理：${group.pending} · 处理中：${group.processing} · 已归档：${group.archived}</p>
    `;
    card.addEventListener("click", () => {
      activeTopic = group.topic;
      topicFilter.value = group.topic;
      renderTopicList(currentEntries);
      renderTopicFocus(currentEntries);
      applyFilters();
      showToast(`已聚焦专题「${group.topic}」`);
    });
    topicList.appendChild(card);
  });
}

function updateTopicFilter(entries) {
  const currentValue = topicFilter.value;
  const topics = Array.from(new Set(entries.map((entry) => entry.topic).filter(Boolean))).sort();
  topicFilter.innerHTML = '<option value="全部">全部专题</option>';

  topics.forEach((topic) => {
    const option = document.createElement("option");
    option.value = topic;
    option.textContent = topic;
    topicFilter.appendChild(option);
  });

  if (topics.includes(currentValue)) {
    topicFilter.value = currentValue;
  }
}

function applyFilters() {
  if (topicFilter.value === "全部") {
    activeTopic = "全部";
  } else {
    activeTopic = topicFilter.value;
  }
  renderTopicList(currentEntries);
  renderTopicFocus(currentEntries);
  renderEntries(getFilteredEntries(currentEntries));
}

function getFilteredEntries(entries) {
  return entries.filter((entry) => {
    const matchesStar = starFilter.value === "全部" || Boolean(entry.starred);
    const matchesStatus = statusFilter.value === "全部" || entry.status === statusFilter.value;
    const matchesTopic = topicFilter.value === "全部" || entry.topic === topicFilter.value;
    return matchesStar && matchesStatus && matchesTopic;
  });
}

function renderTopicFocus(entries) {
  if (activeTopic === "全部") {
    topicFocusPanel.hidden = true;
    topicFocusStats.innerHTML = "";
    topicFocusSummary.innerHTML = "";
    topicNoteInput.value = "";
    topicActionInput.value = "";
    editingTopicActions = [];
    renderTopicActions();
    topicRecentEntries.innerHTML = "";
    return;
  }

  const topicEntries = entries.filter((entry) => entry.topic === activeTopic);
  if (!topicEntries.length) {
    topicFocusPanel.hidden = true;
    topicFocusStats.innerHTML = "";
    topicFocusSummary.innerHTML = "";
    topicNoteInput.value = "";
    topicActionInput.value = "";
    editingTopicActions = [];
    renderTopicActions();
    topicRecentEntries.innerHTML = "";
    return;
  }

  const counts = topicEntries.reduce(
    (accumulator, entry) => {
      accumulator.total += 1;
      if (entry.status === "处理中") accumulator.processing += 1;
      else if (entry.status === "已归档") accumulator.archived += 1;
      else accumulator.pending += 1;
      return accumulator;
    },
    { total: 0, pending: 0, processing: 0, archived: 0 },
  );

  topicFocusPanel.hidden = false;
  topicFocusTitle.textContent = activeTopic;
  topicFocusSubtitle.textContent = `当前专题共有 ${counts.total} 条输入，可继续筛选状态后查看。`;
  topicFocusStats.innerHTML = `
    <article class="stat-card">
      <span>输入总数</span>
      <strong>${counts.total}</strong>
    </article>
    <article class="stat-card">
      <span>待处理</span>
      <strong>${counts.pending}</strong>
    </article>
    <article class="stat-card">
      <span>处理中 / 已归档</span>
      <strong>${counts.processing} / ${counts.archived}</strong>
    </article>
  `;
  topicFocusSummary.innerHTML = `
    <h3>专题摘要</h3>
    <p>${escapeHtml(buildTopicSummary(topicEntries))}</p>
  `;
  topicNoteInput.value = topicNotes[activeTopic] || "";
  editingTopicActions = cloneActions(topicActions[activeTopic] || []);
  renderTopicActions();
  renderTopicRecentEntries(topicEntries);
}

function appendParagraph(container, content, label) {
  if (!content) return;
  const paragraph = document.createElement("p");
  paragraph.textContent = label ? `${label}：${content}` : content;
  container.appendChild(paragraph);
}

function renderAssetChips(container, label, files) {
  if (!files.length) return;
  const title = document.createElement("p");
  title.textContent = `${label}：`;
  container.appendChild(title);

  files.forEach((file) => {
    const isImage = String(file.type || "").startsWith("image/");
    const isVideo = String(file.type || "").startsWith("video/");
    const source = resolveAssetUrl(file);

    if (source && isImage) {
      const link = document.createElement("a");
      link.className = "asset-preview-link";
      link.href = source;
      link.target = "_blank";
      link.rel = "noreferrer";

      const preview = document.createElement("img");
      preview.className = "asset-preview-image";
      preview.alt = file.name;
      preview.src = source;
      link.appendChild(preview);
      container.appendChild(link);
    }

    if (source && isVideo) {
      const video = document.createElement("video");
      video.className = "asset-preview-video";
      video.src = source;
      video.controls = true;
      video.preload = "metadata";
      container.appendChild(video);
    }

    const chip = source ? document.createElement("a") : document.createElement("span");
    chip.className = "asset-chip";
    if (source) {
      chip.href = source;
      chip.target = "_blank";
      chip.rel = "noreferrer";
    }
    chip.textContent = `${file.name} (${formatBytes(file.size)})`;
    container.appendChild(chip);
  });
}

function resolveAssetUrl(file) {
  if (file.publicUrl) {
    return file.publicUrl.startsWith("http") ? file.publicUrl : `${API_BASE_URL}${file.publicUrl}`;
  }

  if (file.dataUrl) {
    return file.dataUrl;
  }

  return "";
}

function updateStats(entries) {
  entryCount.textContent = String(entries.length);
  topicCount.textContent = String(new Set(entries.map((entry) => entry.topic).filter(Boolean)).size);
  lastUpdated.textContent = entries[0] ? formatDate(entries[0].createdAt) : "暂无";
}

function groupEntriesByTopic(entries) {
  const map = new Map();

  entries.forEach((entry) => {
    const topic = entry.topic || "未命名专题";
    if (!map.has(topic)) {
      map.set(topic, { topic, count: 0, pending: 0, processing: 0, archived: 0 });
    }

    const group = map.get(topic);
    group.count += 1;
    if (entry.status === "处理中") group.processing += 1;
    else if (entry.status === "已归档") group.archived += 1;
    else group.pending += 1;
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function summarizeEntry(entry) {
  const content = entry.rawContent || entry.note || entry.link || "暂无摘要";
  return content.length > 80 ? `${content.slice(0, 80)}...` : content;
}

function buildTopicSummary(entries) {
  if (!entries.length) return "暂无专题摘要。";

  const latest = entries[0];
  const summary = summarizeEntry(latest);
  return `最近一条输入是「${latest.title || "未命名输入"}」，当前专题的主要上下文可以先从这条开始看：${summary}`;
}

function renderTopicRecentEntries(entries) {
  topicRecentEntries.innerHTML = "";

  entries.slice(0, 3).forEach((entry) => {
    const item = document.createElement("article");
    item.className = "topic-recent-item";
    item.innerHTML = `
      <strong>${escapeHtml(entry.title || "未命名输入")}</strong>
      <p>${escapeHtml(summarizeEntry(entry))}</p>
      <p>${escapeHtml(formatDate(entry.createdAt))} · ${escapeHtml(entry.status || "待处理")}</p>
    `;
    topicRecentEntries.appendChild(item);
  });
}

function syncStarButton(button, starred) {
  button.textContent = starred ? "取消重点" : "标记重点";
  button.classList.toggle("active", starred);
}

async function getTopicNotes() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topic-notes`);
    if (!response.ok) {
      throw new Error(`Topic notes fetch failed with status ${response.status}`);
    }

    const payload = await response.json();
    return payload.notes || {};
  } catch (error) {
    console.warn("Backend unavailable, reading local topic notes:", error);
    return loadLocalTopicNotes();
  }
}

async function saveActiveTopicNote() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const note = topicNoteInput.value.trim();

  try {
    const response = await fetch(`${API_BASE_URL}/api/topic-notes/${encodeURIComponent(activeTopic)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      throw new Error(`Topic note save failed with status ${response.status}`);
    }

    topicNotes[activeTopic] = note;
    showToast("专题备注已保存");
  } catch (error) {
    console.warn("Backend unavailable, saving topic note locally:", error);
    topicNotes[activeTopic] = note;
    saveLocalTopicNotes(topicNotes);
    showToast("专题备注已暂存到本地");
  }
}

async function getTopicActions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/topic-actions`);
    if (!response.ok) {
      throw new Error(`Topic actions fetch failed with status ${response.status}`);
    }

    const payload = await response.json();
    return payload.actions || {};
  } catch (error) {
    console.warn("Backend unavailable, reading local topic actions:", error);
    return loadLocalTopicActions();
  }
}

async function saveActiveTopicAction() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/topic-actions/${encodeURIComponent(activeTopic)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: editingTopicActions }),
    });

    if (!response.ok) {
      throw new Error(`Topic action save failed with status ${response.status}`);
    }

    topicActions[activeTopic] = cloneActions(editingTopicActions);
    showToast("下一步动作已保存");
  } catch (error) {
    console.warn("Backend unavailable, saving topic action locally:", error);
    topicActions[activeTopic] = cloneActions(editingTopicActions);
    saveLocalTopicActions(topicActions);
    showToast("下一步动作已暂存到本地");
  }
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function resetForm() {
  form.reset();
  selectedImageFiles = [];
  selectedVideoFiles = [];
  renderSelectedFiles();
  restorePreferences();
  syncQuickSourceButtons();
  showToast("表单已重置");
}

function clearEntries() {
  if (!window.confirm("确定要清空所有本地提交记录吗？")) return;
  clearEntryStore();
}

function exportJson() {
  getEntries().then((entries) => {
    downloadFile("weixin-intake-v1-export.json", JSON.stringify(entries, null, 2), "application/json");
  });
}

function exportMarkdown() {
  getEntries().then((entries) => {
    const markdown = entries
      .map((entry, index) => {
        const lines = [
          `## 输入 ${index + 1}`,
          "",
          `- 专题名：${entry.topic || ""}`,
          `- 输入标题：${entry.title || ""}`,
          `- 来源类型：${entry.sourceType || ""}`,
          `- 提交时间：${formatDate(entry.createdAt)}`,
        ];

        if (entry.rawContent) {
          lines.push("", "### 原始内容", "", entry.rawContent);
        }
        if (entry.link) {
          lines.push("", `### 链接`, "", entry.link);
        }
        if (entry.note) {
          lines.push("", `### 备注`, "", entry.note);
        }
        if (entry.imageFiles?.length) {
          lines.push("", "### 图片", "");
          entry.imageFiles.forEach((file) => lines.push(`- ${file.name}`));
        }
        if (entry.videoFiles?.length) {
          lines.push("", "### 视频", "");
          entry.videoFiles.forEach((file) => lines.push(`- ${file.name}`));
        }

        return lines.join("\n");
      })
      .join("\n\n---\n\n");

    downloadFile("weixin-intake-v1-export.md", markdown || "# 暂无记录\n", "text/markdown");
  });
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function seedDemoData() {
  const demoEntry = {
    id: crypto.randomUUID(),
    topic: "产品舒适性问题",
    title: "客户反馈第二版还是按不到位",
    sourceType: "微信",
    rawContent: "客户表示第二版佩戴后按摩头还是碰不到有效区域，虽然包覆比之前软，但感觉作用点不准。",
    link: "",
    note: "这条反馈同时涉及贴合问题和舒适性感知，建议进入主笔记并纳入多体型验证。",
    imageFiles: [],
    videoFiles: [],
    createdAt: new Date().toISOString(),
    status: "待处理",
  };

  getEntries().then((entries) => {
    if (entries.length > 0 && !window.confirm("示例数据会追加到现有记录后面，继续吗？")) return;
    saveEntry(demoEntry).then((result) => setEntries(result.entries));
  });
}

async function clearEntryStore() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/entries`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Backend clear failed with status ${response.status}`);
    }
    setEntries([]);
    showToast("记录已清空");
  } catch (error) {
    console.warn("Backend unavailable, clearing local entries:", error);
    localStorage.removeItem(STORAGE_KEY);
    setEntries([]);
    showToast("本地记录已清空");
  }
}

async function updateEntryStatus(entryId, status) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Backend status update failed with status ${response.status}`);
    }

    const entries = await fetchEntriesFromBackend();
    setEntries(entries);
    showToast(`状态已更新为「${status}」`);
  } catch (error) {
    console.warn("Backend unavailable, updating local entry status:", error);
    const entries = loadEntries().map((entry) => (entry.id === entryId ? { ...entry, status } : entry));
    saveEntries(entries);
    setEntries(entries);
    showToast(`状态已更新为「${status}」`);
  }
}

async function updateEntryStar(entryId, starred) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });

    if (!response.ok) {
      throw new Error(`Backend star update failed with status ${response.status}`);
    }

    const entries = await fetchEntriesFromBackend();
    setEntries(entries);
    showToast(starred ? "已标记为重点" : "已取消重点");
  } catch (error) {
    console.warn("Backend unavailable, updating local entry star:", error);
    const entries = loadEntries().map((entry) => (entry.id === entryId ? { ...entry, starred } : entry));
    saveEntries(entries);
    setEntries(entries);
    showToast(starred ? "已标记为重点" : "已取消重点");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || "{}");
  } catch (error) {
    console.error("Failed to parse prefs:", error);
    return {};
  }
}

function persistPreferences() {
  localStorage.setItem(
    PREFS_STORAGE_KEY,
    JSON.stringify({
      topic: topicInput.value.trim(),
      sourceType: sourceTypeInput.value,
    }),
  );
}

function restorePreferences() {
  const prefs = loadPreferences();
  if (prefs.topic) {
    topicInput.value = prefs.topic;
  }
  if (prefs.sourceType) {
    sourceTypeInput.value = prefs.sourceType;
  }
}

function syncQuickSourceButtons() {
  quickSourceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.source === sourceTypeInput.value);
  });
}

function showToast(message) {
  if (!message) return;
  toast.hidden = false;
  toast.textContent = message;

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = "";
  }, 2200);
}

function mergeSelectedFiles(currentFiles, nextFiles) {
  const merged = [...currentFiles];
  Array.from(nextFiles || []).forEach((file) => {
    const exists = merged.some(
      (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified,
    );
    if (!exists) {
      merged.push(file);
    }
  });
  return merged;
}

function renderSelectedFiles() {
  renderSelectedFileGroup(imageFileList, selectedImageFiles, "image");
  renderSelectedFileGroup(videoFileList, selectedVideoFiles, "video");
}

function clearTopicFocus() {
  activeTopic = "全部";
  topicFilter.value = "全部";
  renderTopicList(currentEntries);
  renderTopicFocus(currentEntries);
  applyFilters();
}

async function deleteActiveTopic() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const confirmed = window.confirm(`确定要删除专题「${activeTopic}」及其相关输入、备注和动作吗？`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/topics/${encodeURIComponent(activeTopic)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Topic delete failed with status ${response.status}`);
    }

    delete topicNotes[activeTopic];
    delete topicActions[activeTopic];
    const nextEntries = currentEntries.filter((entry) => entry.topic !== activeTopic);
    activeTopic = "全部";
    topicFilter.value = "全部";
    setEntries(nextEntries);
    showToast("专题已删除");
  } catch (error) {
    console.warn("Backend unavailable, deleting topic locally:", error);
    delete topicNotes[activeTopic];
    delete topicActions[activeTopic];
    saveLocalTopicNotes(topicNotes);
    saveLocalTopicActions(topicActions);

    const nextEntries = loadEntries().filter((entry) => entry.topic !== activeTopic);
    saveEntries(nextEntries);
    activeTopic = "全部";
    topicFilter.value = "全部";
    setEntries(nextEntries);
    showToast("本地专题已删除");
  }
}

function exportActiveTopicSummary() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const topicEntries = currentEntries.filter((entry) => entry.topic === activeTopic);
  if (!topicEntries.length) {
    showToast("当前专题没有可导出的内容");
    return;
  }

  const counts = topicEntries.reduce(
    (accumulator, entry) => {
      accumulator.total += 1;
      if (entry.status === "处理中") accumulator.processing += 1;
      else if (entry.status === "已归档") accumulator.archived += 1;
      else accumulator.pending += 1;
      if (entry.starred) accumulator.starred += 1;
      return accumulator;
    },
    { total: 0, pending: 0, processing: 0, archived: 0, starred: 0 },
  );

  const topicNote = topicNotes[activeTopic] || "";
  const actions = editingTopicActions.length
    ? editingTopicActions
    : cloneActions(topicActions[activeTopic] || []);

  const markdown = [
    `# ${activeTopic}`,
    "",
    "## 专题概况",
    "",
    `- 输入总数：${counts.total}`,
    `- 待处理：${counts.pending}`,
    `- 处理中：${counts.processing}`,
    `- 已归档：${counts.archived}`,
    `- 重点输入：${counts.starred}`,
    "",
    "## 自动摘要",
    "",
    buildTopicSummary(topicEntries),
    "",
    "## 专题备注",
    "",
    topicNote || "暂无",
    "",
    "## 下一步动作",
    "",
    ...(actions.length
      ? actions.flatMap((action) => [
          `- [${action.completed ? "x" : " "}] ${action.text}`,
          `  - 负责人：${action.owner || "待定"}`,
          `  - 截止时间：${action.dueDate || "待定"}`,
        ])
      : ["- 暂无"]),
    "",
    "## 最近输入",
    "",
    ...topicEntries.slice(0, 5).flatMap((entry, index) => [
      `### 输入 ${index + 1}`,
      "",
      `- 标题：${entry.title || "未命名输入"}`,
      `- 来源：${entry.sourceType || "其他"}`,
      `- 时间：${formatDate(entry.createdAt)}`,
      `- 状态：${entry.status || "待处理"}`,
      `- 是否重点：${entry.starred ? "是" : "否"}`,
      "",
      summarizeEntry(entry),
      "",
    ]),
  ].join("\n");

  downloadFile(`${sanitizeFilename(activeTopic)}-专题摘要.md`, markdown, "text/markdown");
  showToast("专题摘要已导出");
}

function exportActiveTopicActions() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const actions = editingTopicActions.length
    ? editingTopicActions
    : cloneActions(topicActions[activeTopic] || []);

  if (!actions.length) {
    showToast("当前专题没有动作清单");
    return;
  }

  const markdown = [
    `# ${activeTopic} - 动作清单`,
    "",
    ...actions.flatMap((action, index) => [
      `## 动作 ${index + 1}`,
      "",
      `- 内容：${action.text}`,
      `- 状态：${action.completed ? "已完成" : "待推进"}`,
      `- 负责人：${action.owner || "待定"}`,
      `- 截止时间：${action.dueDate || "待定"}`,
      "",
    ]),
  ].join("\n");

  downloadFile(`${sanitizeFilename(activeTopic)}-动作清单.md`, markdown, "text/markdown");
  showToast("动作清单已导出");
}

function exportActiveTopicTaskFormat() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const actions = editingTopicActions.length
    ? editingTopicActions
    : cloneActions(topicActions[activeTopic] || []);

  if (!actions.length) {
    showToast("当前专题没有动作清单");
    return;
  }

  const text = actions
    .map((action, index) => {
      const lines = [
        `[专题动作] ${activeTopic} - ${action.text}`,
        `状态：${action.completed ? "已完成" : "待推进"}`,
        `负责人：${action.owner || "待定"}`,
        `截止时间：${action.dueDate || "待定"}`,
      ];
      return `${index + 1}. ${lines.join("\n")}`;
    })
    .join("\n\n");

  downloadFile(`${sanitizeFilename(activeTopic)}-任务格式.txt`, text, "text/plain");
  showToast("任务格式已导出");
}

function loadLocalTopicNotes() {
  try {
    return JSON.parse(localStorage.getItem("weixin-intake-v1.topic-notes") || "{}");
  } catch (error) {
    console.error("Failed to parse topic notes:", error);
    return {};
  }
}

function saveLocalTopicNotes(notes) {
  localStorage.setItem("weixin-intake-v1.topic-notes", JSON.stringify(notes));
}

function loadLocalTopicActions() {
  try {
    return JSON.parse(localStorage.getItem("weixin-intake-v1.topic-actions") || "{}");
  } catch (error) {
    console.error("Failed to parse topic actions:", error);
    return {};
  }
}

function saveLocalTopicActions(actions) {
  localStorage.setItem("weixin-intake-v1.topic-actions", JSON.stringify(actions));
}

function addTopicAction() {
  if (activeTopic === "全部") {
    showToast("请先选择一个专题");
    return;
  }

  const value = topicActionInput.value.trim();
  if (!value) {
    showToast("先写一条动作内容");
    return;
  }

  editingTopicActions.push({
    id: crypto.randomUUID(),
    text: value,
    completed: false,
  });
  topicActionInput.value = "";
  renderTopicActions();
  showToast("动作已加入清单");
}

function renderTopicActions() {
  topicActionList.innerHTML = "";

  if (!editingTopicActions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>还没有动作</h3><p>先补一条下一步动作，后面可以继续接任务系统。</p>";
    topicActionList.appendChild(empty);
    return;
  }

  editingTopicActions.forEach((action) => {
    const item = document.createElement("div");
    item.className = "topic-action-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(action.completed);
    checkbox.addEventListener("change", () => {
      action.completed = checkbox.checked;
      renderTopicActions();
    });

    const text = document.createElement("span");
    text.textContent = action.text;
    text.classList.toggle("completed", Boolean(action.completed));

    label.appendChild(checkbox);
    label.appendChild(text);
    item.appendChild(label);

    const meta = document.createElement("div");
    meta.className = "topic-action-meta";

    const ownerInput = document.createElement("input");
    ownerInput.type = "text";
    ownerInput.placeholder = "负责人";
    ownerInput.value = action.owner || "";
    ownerInput.addEventListener("input", () => {
      action.owner = ownerInput.value.trim();
    });

    const dueDateInput = document.createElement("input");
    dueDateInput.type = "date";
    dueDateInput.value = action.dueDate || "";
    dueDateInput.addEventListener("input", () => {
      action.dueDate = dueDateInput.value;
    });

    meta.appendChild(ownerInput);
    meta.appendChild(dueDateInput);
    item.appendChild(meta);

    const footer = document.createElement("div");
    footer.className = "topic-action-footer";
    const hint = document.createElement("span");
    hint.textContent = action.completed ? "已完成动作" : "待推进动作";
    hint.classList.toggle("completed", Boolean(action.completed));
    footer.appendChild(hint);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-file-button";
    removeButton.textContent = "删除";
    removeButton.addEventListener("click", () => {
      editingTopicActions = editingTopicActions.filter((candidate) => candidate.id !== action.id);
      renderTopicActions();
      showToast("动作已删除");
    });

    footer.appendChild(removeButton);
    item.appendChild(footer);
    topicActionList.appendChild(item);
  });
}

function cloneActions(actions) {
  return actions.map((action) => ({
    id: action.id || crypto.randomUUID(),
    text: action.text || "",
    completed: Boolean(action.completed),
    owner: action.owner || "",
    dueDate: action.dueDate || "",
  }));
}

function sanitizeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-");
}

function renderSelectedFileGroup(container, files, type) {
  container.innerHTML = "";
  if (!files.length) return;

  files.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "selected-file-item";
    const main = document.createElement("div");
    main.className = "selected-file-main";

    if (type === "image") {
      item.classList.add("has-preview");
      const preview = document.createElement("img");
      preview.className = "selected-file-preview";
      preview.alt = file.name;
      preview.src = URL.createObjectURL(file);
      main.appendChild(preview);
    }

    const text = document.createElement("div");
    text.className = "selected-file-text";
    text.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong>
      <span>${formatBytes(file.size)}</span>
    `;
    main.appendChild(text);
    item.appendChild(main);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-file-button";
    removeButton.textContent = "移除";
    removeButton.addEventListener("click", () => {
      if (type === "image") {
        selectedImageFiles = selectedImageFiles.filter((_, fileIndex) => fileIndex !== index);
      } else {
        selectedVideoFiles = selectedVideoFiles.filter((_, fileIndex) => fileIndex !== index);
      }
      renderSelectedFiles();
      showToast("已移除素材");
    });

    item.appendChild(removeButton);
    container.appendChild(item);
  });
}
