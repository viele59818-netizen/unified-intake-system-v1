const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const frontendDir = path.join(__dirname, "..", "weixin-intake-v1");

const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(dataDir, "uploads");
const entriesFile = path.join(dataDir, "entries.json");
const topicNotesFile = path.join(dataDir, "topic-notes.json");
const topicActionsFile = path.join(dataDir, "topic-actions.json");

ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      respondJson(res, 200, { ok: true, service: "intake-backend-v1" });
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      serveStaticFile(res, path.join(frontendDir, "index.html"));
      return;
    }

    if (req.method === "GET" && req.url === "/styles.css") {
      serveStaticFile(res, path.join(frontendDir, "styles.css"));
      return;
    }

    if (req.method === "GET" && req.url === "/app.js") {
      serveStaticFile(res, path.join(frontendDir, "app.js"));
      return;
    }

    if (req.method === "GET" && req.url === "/api/entries") {
      const entries = readEntries();
      respondJson(res, 200, { ok: true, entries });
      return;
    }

    if (req.method === "POST" && req.url === "/api/entries") {
      const payload = await readJsonBody(req);
      const entry = normalizeEntry(payload);
      persistAssets(entry);

      const entries = readEntries();
      entries.unshift(entry);
      writeEntries(entries);

      respondJson(res, 201, { ok: true, entry });
      return;
    }

    if (req.method === "PATCH" && req.url.startsWith("/api/entries/")) {
      const entryId = decodeURIComponent(req.url.replace("/api/entries/", ""));
      const payload = await readJsonBody(req);
      const entries = readEntries();
      const target = entries.find((entry) => entry.id === entryId);

      if (!target) {
        respondJson(res, 404, { ok: false, error: "Entry not found" });
        return;
      }

      if (typeof payload.status === "string" && payload.status.trim()) {
        target.status = payload.status.trim();
      }

      if (typeof payload.starred === "boolean") {
        target.starred = payload.starred;
      }

      writeEntries(entries);
      respondJson(res, 200, { ok: true, entry: target });
      return;
    }

    if (req.method === "GET" && req.url === "/api/topic-notes") {
      respondJson(res, 200, { ok: true, notes: readTopicNotes() });
      return;
    }

    if (req.method === "PATCH" && req.url.startsWith("/api/topic-notes/")) {
      const topic = decodeURIComponent(req.url.replace("/api/topic-notes/", ""));
      const payload = await readJsonBody(req);
      const notes = readTopicNotes();
      notes[topic] = String(payload.note || "").trim();
      writeTopicNotes(notes);
      respondJson(res, 200, { ok: true, topic, note: notes[topic] });
      return;
    }

    if (req.method === "GET" && req.url === "/api/topic-actions") {
      respondJson(res, 200, { ok: true, actions: readTopicActions() });
      return;
    }

    if (req.method === "PATCH" && req.url.startsWith("/api/topic-actions/")) {
      const topic = decodeURIComponent(req.url.replace("/api/topic-actions/", ""));
      const payload = await readJsonBody(req);
      const actions = readTopicActions();
      actions[topic] = Array.isArray(payload.actions) ? payload.actions : [];
      writeTopicActions(actions);
      respondJson(res, 200, { ok: true, topic, actions: actions[topic] });
      return;
    }

    if (req.method === "DELETE" && req.url.startsWith("/api/topics/")) {
      const topic = decodeURIComponent(req.url.replace("/api/topics/", ""));
      const entries = readEntries().filter((entry) => entry.topic !== topic);
      writeEntries(entries);

      const notes = readTopicNotes();
      delete notes[topic];
      writeTopicNotes(notes);

      const actions = readTopicActions();
      delete actions[topic];
      writeTopicActions(actions);

      respondJson(res, 200, { ok: true, topic });
      return;
    }

    if (req.method === "DELETE" && req.url === "/api/entries") {
      clearEntries();
      respondJson(res, 200, { ok: true });
      return;
    }

    respondJson(res, 404, { ok: false, error: "Not Found" });
  } catch (error) {
    console.error(error);
    respondJson(res, 500, { ok: false, error: error.message || "Internal Server Error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`intake-backend-v1 listening on http://${HOST}:${PORT}`);
});

function ensureStorage() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(entriesFile)) {
    fs.writeFileSync(entriesFile, "[]\n", "utf8");
  }
  if (!fs.existsSync(topicNotesFile)) {
    fs.writeFileSync(topicNotesFile, "{}\n", "utf8");
  }
  if (!fs.existsSync(topicActionsFile)) {
    fs.writeFileSync(topicActionsFile, "{}\n", "utf8");
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function respondJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function serveStaticFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    respondJson(res, 404, { ok: false, error: "Static file not found" });
    return;
  }

  const extension = path.extname(filePath);
  res.writeHead(200, { "Content-Type": `${getContentType(extension)}; charset=utf-8` });
  res.end(fs.readFileSync(filePath));
}

function readEntries() {
  return JSON.parse(fs.readFileSync(entriesFile, "utf8"));
}

function writeEntries(entries) {
  fs.writeFileSync(entriesFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function clearEntries() {
  writeEntries([]);
}

function readTopicNotes() {
  return JSON.parse(fs.readFileSync(topicNotesFile, "utf8"));
}

function writeTopicNotes(notes) {
  fs.writeFileSync(topicNotesFile, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
}

function readTopicActions() {
  return JSON.parse(fs.readFileSync(topicActionsFile, "utf8"));
}

function writeTopicActions(actions) {
  fs.writeFileSync(topicActionsFile, `${JSON.stringify(actions, null, 2)}\n`, "utf8");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEntry(payload) {
  return {
    id: randomUUID(),
    topic: String(payload.topic || "").trim(),
    title: String(payload.title || "").trim(),
    sourceType: String(payload.sourceType || "其他").trim(),
    rawContent: String(payload.rawContent || "").trim(),
    link: String(payload.link || "").trim(),
    note: String(payload.note || "").trim(),
    imageFiles: normalizeFiles(payload.imageFiles),
    videoFiles: normalizeFiles(payload.videoFiles),
    createdAt: new Date().toISOString(),
    status: "待处理",
    starred: Boolean(payload.starred),
  };
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .filter((file) => file && file.name && file.dataUrl)
    .map((file) => ({
      name: String(file.name),
      type: String(file.type || "application/octet-stream"),
      size: Number(file.size || 0),
      dataUrl: String(file.dataUrl),
    }));
}

function persistAssets(entry) {
  entry.imageFiles = entry.imageFiles.map((file) => persistFile(file, entry.id, "image"));
  entry.videoFiles = entry.videoFiles.map((file) => persistFile(file, entry.id, "video"));
}

function persistFile(file, entryId, category) {
  const extension = guessExtension(file);
  const safeName = `${entryId}-${category}-${randomUUID()}${extension}`;
  const outputPath = path.join(uploadsDir, safeName);
  const base64 = file.dataUrl.split(",")[1];
  fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    storedAs: safeName,
    relativePath: path.relative(dataDir, outputPath),
  };
}

function guessExtension(file) {
  if (file.name && path.extname(file.name)) return path.extname(file.name);
  if (file.type === "image/png") return ".png";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "video/mp4") return ".mp4";
  return "";
}

function getContentType(extension) {
  switch (extension) {
    case ".html":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
      return "application/javascript";
    default:
      return "application/octet-stream";
  }
}
