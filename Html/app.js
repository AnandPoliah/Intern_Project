const API_KEY = "AIzaSyCl8iVdu0tUkjLbPFz3A0PY4XFjkmfFQNg";
const $ = (id) => document.getElementById(id);

const app = {
  tasks: JSON.parse(localStorage.getItem("tasks") || "[]"),
  user: "Intern_1",

  init() {
    if (localStorage.getItem("theme") === "light")
      document.body.classList.add("light-mode");
    this.render();
    $("taskForm").onsubmit = (e) => {
      e.preventDefault();
      this.addTask();
    };

    // Inject CSS for scrolling and loader
    document.head.insertAdjacentHTML(
      "beforeend",
      `<style>#aiResult{max-height:60vh;overflow-y:auto;padding:15px;background:#f8f9fa;border-radius:8px}.loader{border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;width:30px;height:30px;animation:spin 1s linear infinite;margin:10px auto}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>`
    );
  },

  toggleTheme() {
    document.body.classList.toggle("light-mode");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("light-mode") ? "light" : "dark"
    );
  },

  switchUser() {
    this.user = $("currentUser").value;
    this.render();
  },

  async addTask() {
    const file = $("pdfFile").files[0];
    const id = Date.now();
    if (file) await db.savePdf(id, file);

    this.tasks.push({
      id,
      title: $("taskTitle").value,
      priority: $("taskPriority").value,
      date: $("taskDate").value,
      hasPdf: !!file,
      createdBy: this.user,
      progress: {},
    });
    this.save();
    this.toggleModal(false);
    $("taskForm").reset();
  },

  deleteTask(id) {
    if (confirm("Delete this task?")) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
      db.deletePdf(id);
      this.save();
    }
  },

  save() {
    localStorage.setItem("tasks", JSON.stringify(this.tasks));
    this.render();
  },

  toggleModal(show) {
    $("taskModal").classList[show ? "remove" : "add"]("hidden");
  },

  render() {
    const grid = $("taskGrid");
    grid.innerHTML = "";
    const pMap = { High: 3, Medium: 2, Low: 1 };

    if (!this.tasks.length)
      return (grid.innerHTML = `<p style="text-align:center;opacity:0.6;width:100%">No tasks yet.</p>`);

    this.tasks
      .sort((a, b) => pMap[b.priority] - pMap[a.priority])
      .forEach((t) => {
        const btn = t.hasPdf
          ? `<button class="btn-read" onclick="viewer.open(${t.id}, '${
              t.title
            }')">📖 Read (Pg ${t.progress[this.user] || 1})</button>`
          : `<button class="btn-secondary" disabled>No PDF</button>`;

        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
        <div class="card-header"><h3>${t.title}</h3><span class="badge ${
          t.priority
        }">${t.priority}</span></div>
        <div class="card-meta">
            <span>👤 ${t.createdBy.replace("_", " ")}</span><span>📅 ${
          t.date || "No Date"
        }</span>
        </div>
        <div class="card-actions">${btn}<button class="btn-text btn-del" onclick="app.deleteTask(${
          t.id
        })">🗑</button></div>`;
        grid.appendChild(div);
      });
  },
};

const reporter = {
  async generate() {
    if (!app.tasks.length) return alert("No tasks to analyze!");

    const reportData = app.tasks
      .map((t, i) => {
        const prog =
          Object.entries(t.progress)
            .map(([u, p]) => `   - ${u}: Pg ${p}`)
            .join("\n") || "   - No progress";
        return `${i + 1}. "${t.title}" (${
          t.priority
        })\n   - TEAM PROGRESS:\n${prog}`;
      })
      .join("\n\n");

    $("summaryModal").classList.remove("hidden");
    $("aiResult").innerHTML = "";
    $("aiLoading").classList.remove("hidden");
    $(
      "aiLoading"
    ).innerHTML = `<div class="loader"></div><p>Generating Report...</p>`;

    try {
      const html = await this.fetchWithRetry(`PROJECT STATE:\n${reportData}`);
      $("aiLoading").classList.add("hidden");
      $("aiResult").innerHTML = `<div class="summary-content">${html}</div>`;
    } catch (e) {
      $("aiLoading").classList.add("hidden");
      $(
        "aiResult"
      ).innerHTML = `<div style="color:red;text-align:center"><h3>❌ Failed</h3><p>${e.message}</p></div>`;
    }
  },

  async fetchWithRetry(data, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Act as Project Manager. Analyze:\n${data}\nOutput valid HTML (no markdown). Sections: <h3>📊 Summary</h3>, <h4>🚨 Bottlenecks</h4>, <h4>🏆 Leaderboard</h4>, <h4>✅ Actions</h4> and also keep in mind to use less tokens as possible`,
                    },
                  ],
                },
              ],
            }),
          }
        );
        if (!res.ok) {
          if (res.status === 429) throw new Error("429");
          throw new Error(res.statusText);
        }
        const json = await res.json();
        return json.candidates[0].content.parts[0].text.replace(
          /```html|```/g,
          ""
        );
      } catch (e) {
        if (i === retries - 1 || !e.message.includes("429")) throw e;
        const w = 2000 * Math.pow(2, i);
        $(
          "aiLoading"
        ).innerHTML = `<div class="loader"></div><p>Busy. Retrying in ${
          w / 1000
        }s...</p>`;
        await new Promise((r) => setTimeout(r, w));
      }
    }
  },
  close() {
    $("summaryModal").classList.add("hidden");
  },
};

const viewer = {
  pdf: null,
  page: 1,
  taskId: null,
  async open(id, title) {
    this.taskId = id;
    $("docName").innerText = title;
    try {
      const blob = await db.getPdf(id);
      if (!blob) return alert("File not found!");
      this.pdf = await pdfjsLib.getDocument(URL.createObjectURL(blob)).promise;
      $("pgTotal").innerText = this.pdf.numPages;
      this.page = app.tasks.find((t) => t.id === id).progress[app.user] || 1;
      this.renderPage();
      $("pdfViewerModal").classList.remove("hidden");
    } catch (e) {
      alert("Viewer Error");
    }
  },
  async renderPage() {
    const p = await this.pdf.getPage(this.page);
    const vp = p.getViewport({ scale: 1.5 });
    const cvs = $("pdfCanvas");
    cvs.height = vp.height;
    cvs.width = vp.width;
    await p.render({ canvasContext: cvs.getContext("2d"), viewport: vp })
      .promise;
    $("pgNum").innerText = this.page;
    app.tasks.find((t) => t.id === this.taskId).progress[app.user] = this.page;
    localStorage.setItem("tasks", JSON.stringify(app.tasks));
  },
  changePage(d) {
    if (this.page + d > 0 && this.page + d <= this.pdf.numPages) {
      this.page += d;
      this.renderPage();
    }
  },
  close() {
    $("pdfViewerModal").classList.add("hidden");
    app.render();
  },
};

const db = {
  init: () =>
    new Promise((r) => {
      const req = indexedDB.open("StudyHubDB", 2);
      req.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains("files"))
          e.target.result.createObjectStore("files");
      };
      req.onsuccess = (e) => r(e.target.result);
    }),
  op: async (mode, fn) => {
    const d = await db.init();
    return new Promise(
      (r) =>
        (fn(d.transaction("files", mode).objectStore("files")).onsuccess = (
          e
        ) => r(e.target.result))
    );
  },
  savePdf: (id, f) => db.op("readwrite", (s) => s.put(f, id)),
  getPdf: (id) => db.op("readonly", (s) => s.get(id)),
  deletePdf: (id) => db.op("readwrite", (s) => s.delete(id)),
};

app.init();
const ui = {
  closeViewer: () => viewer.close(),
  closeReport: () => reporter.close(),
  toggleModal: (s) => app.toggleModal(s),
};
