// ⚠️ GLOBAL CONFIGURATION
const GLOBAL_API_KEY = "API";
const $ = (id) => document.getElementById(id);

const app = {
  tasks: JSON.parse(localStorage.getItem("tasks") || "[]"),
  usersDB: JSON.parse(localStorage.getItem("usersDB") || "{}"),
  user: null,
  viewMode: localStorage.getItem("viewMode") || "grid",

  init() {
    // 1. Theme Check
    if (localStorage.getItem("theme") === "light") {
      document.body.classList.add("light-mode");
      $("themeIcon").innerText = "light_mode";
    }

    // 2. Auth Check
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      this.user = savedUser;
      this.showApp();
    } else {
      this.showAuth("login");
    }

    // 3. Load View Mode UI
    this.updateViewToggles();

    // 5. Listeners
    $("pdfFile").onchange = function () {
      const fileName = this.files[0]
        ? this.files[0].name
        : "Click to upload document";
      $("fileName").innerText = fileName;

      const icon = document.querySelector(".icon-circle");
      if (this.files[0]) {
        $("fileLabel").style.borderColor = "var(--low)";
        icon.style.color = "var(--low)";
        icon.style.background = "rgba(16, 185, 129, 0.1)";
      } else {
        $("fileLabel").style.borderColor = "var(--border)";
        icon.style.color = "var(--primary)";
        icon.style.background = "rgba(99, 102, 241, 0.1)";
      }
    };

    $("taskForm").onsubmit = (e) => {
      e.preventDefault();
      this.addTask();
    };
  },

  // --- VIEW LOGIC ---
  toggleView(mode) {
    this.viewMode = mode;
    localStorage.setItem("viewMode", mode);
    this.updateViewToggles();
    this.render();
  },

  updateViewToggles() {
    $("btnGrid").classList.toggle("active-view", this.viewMode === "grid");
    $("btnList").classList.toggle("active-view", this.viewMode === "list");

    const grid = $("taskGrid");
    if (this.viewMode === "list") {
      grid.classList.remove("grid");
      grid.classList.add("list-layout");
      $("listHeader").classList.remove("hidden");
    } else {
      grid.classList.add("grid");
      grid.classList.remove("list-layout");
      $("listHeader").classList.add("hidden");
    }
  },

  // --- THEME LOGIC (FIXED) ---
  toggleTheme() {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    $("themeIcon").innerText = isLight ? "light_mode" : "dark_mode";
  },

  // --- AUTH LOGIC (FIXED) ---
  toggleAuth(view) {
    $("loginCard").classList.add("hidden");
    $("signupCard").classList.add("hidden");
    if (view === "login") $("loginCard").classList.remove("hidden");
    else $("signupCard").classList.remove("hidden");
    $("loginError").classList.add("hidden");
    $("signupError").classList.add("hidden");
  },

  showAuth(view) {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    this.toggleAuth(view);
  },

  showApp() {
    $("authView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("displayUser").innerText = this.user;
    this.render();
  },

  signup(e) {
    e.preventDefault();
    const u = $("regUser").value.trim();
    const p = $("regPass").value.trim();
    if (this.usersDB[u]) {
      $("signupError").innerText = "Username already exists";
      $("signupError").classList.remove("hidden");
      return;
    }
    if (p.length < 4) {
      $("signupError").innerText = "Password too short";
      $("signupError").classList.remove("hidden");
      return;
    }
    this.usersDB[u] = p;
    localStorage.setItem("usersDB", JSON.stringify(this.usersDB));
    this.user = u;
    localStorage.setItem("currentUser", u);
    this.showApp();
    ui.notify("Account created successfully!");
    $("regUser").value = "";
    $("regPass").value = "";
  },

  login(e) {
    e.preventDefault();
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value.trim();
    if (this.usersDB[u] && this.usersDB[u] === p) {
      this.user = u;
      localStorage.setItem("currentUser", u);
      this.showApp();
      ui.notify(`Welcome back, ${u}!`);
      $("loginUser").value = "";
      $("loginPass").value = "";
    } else {
      $("loginError").innerText = "Invalid username or password";
      $("loginError").classList.remove("hidden");
    }
  },

  logout() {
    this.user = null;
    localStorage.removeItem("currentUser");
    this.showAuth("login");
    ui.notify("Logged out");
  },

  // --- TASK CREATION LOGIC (FIXED) ---
  async addTask() {
    const file = $("pdfFile").files[0];
    const rawTitle = $("taskTitle").value;
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const id = Date.now();

    if (file) {
      ui.notify("Uploading PDF...", "success");
      await db.savePdf(id, file);
    }

    const newTask = {
      id,
      title: title,
      priority: $("taskPriority").value,
      date: $("taskDate").value,
      hasPdf: !!file,
      createdBy: this.user,
      progress: {},
    };

    this.tasks.push(newTask);
    this.save();
    ui.toggleModal("taskModal", false);
    ui.notify("Task created successfully");
  },

  taskIdToDelete: null,
  requestDelete(id) {
    this.taskIdToDelete = id;
    ui.toggleModal("confirmModal", true);
    $("confirmDeleteBtn").onclick = () => {
      this.tasks = this.tasks.filter((t) => t.id !== this.taskIdToDelete);
      db.deletePdf(this.taskIdToDelete);
      this.save();
      ui.toggleModal("confirmModal", false);
      ui.notify("Task deleted", "error");
    };
  },

  save() {
    localStorage.setItem("tasks", JSON.stringify(this.tasks));
    this.render();
  },

  render() {
    const grid = $("taskGrid");

    if (!this.tasks.length) {
      grid.innerHTML = `<div class="center-content" style="grid-column:1/-1; margin-top:50px; color:var(--text-muted)">
        <span class="material-icons-round" style="font-size:48px; opacity:0.5">inventory_2</span>
        <p>No tasks yet.</p>
      </div>`;
      return;
    }

    // --- TEMPLATE HELPERS ---
    const getGridCard = (t, page, clickAttr, pdfAction) => {
      const readBtn = t.hasPdf
        ? `<button class="btn-read" onclick="${pdfAction}"><span class="material-icons-round">menu_book</span> Read (Pg ${page})</button>`
        : `<button class="btn-secondary" disabled style="opacity:0.5;flex:1">No PDF</button>`;

      return `
        <div class="card">
            <div class="card-header">
                <h3 class="task-title" ${clickAttr} title="${
        t.hasPdf ? "Read PDF" : ""
      }">
                    ${t.title} ${
        t.hasPdf
          ? '<span class="material-icons-round" style="font-size:16px; margin-left:5px">attachment</span>'
          : ""
      }
                </h3>
                <span class="badge ${t.priority}">${t.priority}</span>
            </div>
            <div class="card-meta">
                <div class="meta-row"><span class="material-icons-round" style="font-size:16px">event</span> ${
                  t.date
                }</div>
                <div class="meta-row"><span class="material-icons-round" style="font-size:16px">person</span> ${
                  t.createdBy
                }</div>
            </div>
            <div class="card-actions">
                ${readBtn}
                <button class="btn-del" onclick="app.requestDelete(${
                  t.id
                })"><span class="material-icons-round">delete</span></button>
            </div>
        </div>`;
    };

    const getListRow = (t, page, clickAttr, pdfAction) => {
      const readIcon = t.hasPdf
        ? `<button class="btn-icon" onclick="${pdfAction}" title="Read PDF"><span class="material-icons-round" style="color:var(--primary)">menu_book</span></button>`
        : `<span class="material-icons-round" style="color:var(--border); padding:8px">block</span>`;

      return `
        <div class="list-item-row">
            <div class="task-title" ${clickAttr}>${t.title}</div>
            <div><span class="badge ${t.priority}">${t.priority}</span></div>
            <div class="meta-text"><span class="material-icons-round" style="font-size:16px">event</span> ${t.date}</div>
            <div class="meta-text">Pg ${page}</div>
            <div class="row-actions">
                ${readIcon}
                <button class="btn-icon" onclick="app.requestDelete(${t.id})" title="Delete">
                    <span class="material-icons-round" style="color:var(--high)">delete</span>
                </button>
            </div>
        </div>`;
    };

    // --- MAIN LOGIC ---
    const scores = { High: 3, Medium: 2, Low: 1 };
    const isGrid = this.viewMode === "grid";

    grid.innerHTML = this.tasks
      .sort((a, b) => scores[b.priority] - scores[a.priority])
      .map((t) => {
        const page = t.progress[this.user] || 0;
        const pdfAction = `viewer.open(${t.id}, '${t.title}')`;
        // Pre-calculate clickable attributes to keep HTML clean
        const clickAttr = t.hasPdf
          ? `onclick="${pdfAction}" style="cursor:pointer"`
          : `style="cursor:default"`;

        return isGrid
          ? getGridCard(t, page, clickAttr, pdfAction)
          : getListRow(t, page, clickAttr, pdfAction);
      })
      .join("");
  },
};

const ui = {
  toggleModal(id, show) {
    $(id).classList[show ? "remove" : "add"]("hidden");
    if (!show && id === "taskModal") {
      $("taskForm").reset();
      $("fileName").innerText = "Click to upload document";
      $("fileLabel").style.borderColor = "var(--border)";
      const icon = document.querySelector(".icon-circle");
      if (icon) {
        icon.style.color = "var(--primary)";
        icon.style.background = "rgba(99, 102, 241, 0.1)";
      }
    }
  },
  closeConfirm: () => ui.toggleModal("confirmModal", false),
  closeReport: () => ui.toggleModal("summaryModal", false),
  notify(msg, type = "success") {
    const t = document.createElement("div");
    t.className = `toast`;
    t.style.borderLeftColor = type === "success" ? "var(--low)" : "var(--high)";
    t.innerHTML = `<span class="material-icons-round" style="color:${
      type === "success" ? "var(--low)" : "var(--high)"
    }">${type === "success" ? "check_circle" : "error"}</span> ${msg}`;
    $("toastContainer").appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },
};

const viewer = {
  pdf: null,
  page: 1,
  taskId: null,
  scale: 1.2,
  async open(id, title) {
    this.taskId = id;
    $("docName").innerText = title;
    try {
      const blob = await db.getPdf(id);
      if (!blob) return ui.notify("File not found", "error");
      this.pdf = await pdfjsLib.getDocument(URL.createObjectURL(blob)).promise;
      $("pgTotal").innerText = this.pdf.numPages;
      this.page = app.tasks.find((t) => t.id === id).progress[app.user] || 1;

      // Auto-fit Logic
      const p = await this.pdf.getPage(1);
      const viewport = p.getViewport({ scale: 1 });
      const availableWidth = window.innerWidth * 0.8;
      this.scale = Math.min(1.5, availableWidth / viewport.width);

      await this.renderPage();
      ui.toggleModal("pdfViewerModal", true);
    } catch (e) {
      ui.notify("Error opening PDF", "error");
    }
  },
  async renderPage() {
    const p = await this.pdf.getPage(this.page);
    const vp = p.getViewport({ scale: this.scale });
    const cvs = $("pdfCanvas");
    const ctx = cvs.getContext("2d");

    cvs.height = vp.height;
    cvs.width = vp.width;

    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    $("pgNum").innerText = this.page;

    const task = app.tasks.find((t) => t.id === this.taskId);
    if (task) {
      if (!task.progress) task.progress = {};
      task.progress[app.user] = this.page;
      localStorage.setItem("tasks", JSON.stringify(app.tasks));
    }
  },
  changePage(d) {
    if (this.page + d > 0 && this.page + d <= this.pdf.numPages) {
      this.page += d;
      this.renderPage();
    }
  },
  zoom(delta) {
    const newScale = this.scale + delta;
    if (newScale >= 0.5 && newScale <= 3.0) {
      this.scale = newScale;
      this.renderPage();
    }
  },
  close() {
    ui.toggleModal("pdfViewerModal", false);
    app.render();
  },
};

const reporter = {
  getStructure(state = "loading") {
    const isError = state === "error";
    const icon = isError ? "error_outline" : "hourglass_empty";
    const titleText = isError ? "Analysis Failed" : "Analyzing Team Data...";
    const listText = isError
      ? "<li style='color:var(--high)'>Unable to generate insights.</li>"
      : "<li class='skeleton-text'>Gathering intelligence...</li>";

    return `
      <div class="report-container fade-in">
        <div class="report-summary-box">
          <h3><span class="material-icons-round">${icon}</span> ${titleText}</h3>
          <p>${
            isError
              ? "Check your internet connection or API Key."
              : "Please wait while we generate your project status report..."
          }</p>
        </div>
        <div class="report-grid">
          <div class="report-card danger"><h4><span class="material-icons-round">warning</span> Bottlenecks & Risks</h4><ul>${listText}</ul></div>
          <div class="report-card success"><h4><span class="material-icons-round">thumb_up</span> Top Performers</h4><ul>${listText}</ul></div>
          <div class="report-card info"><h4><span class="material-icons-round">fact_check</span> Recommended Actions</h4><ul>${listText}</ul></div>
          <div class="report-card warning"><h4><span class="material-icons-round">event</span> Upcoming Deadlines</h4><ul>${listText}</ul></div>
        </div>
      </div>
    `;
  },

  async generate() {
    if (!app.tasks.length) return ui.notify("No tasks to analyze", "error");

    const savedKey = localStorage.getItem("geminiKey");
    const activeKey =
      savedKey && savedKey.length > 10 ? savedKey : GLOBAL_API_KEY;

    const reportData = app.tasks
      .map(
        (t, i) =>
          `Task ${i + 1}: "${t.title}" | Priority: ${t.priority} | Due: ${
            t.date
          } | Status: ${t.progress[app.user] ? "In Progress" : "Not Started"}`
      )
      .join("\n");

    ui.toggleModal("summaryModal", true);
    $("aiLoading").classList.add("hidden");
    $("aiResult").innerHTML = this.getStructure("loading");

    try {
      const html = await this.callGemini(reportData, activeKey);
      $("aiResult").innerHTML = html;
    } catch (e) {
      console.error(e);
      $("aiResult").innerHTML = this.getStructure("error");
      ui.notify("Report generation failed", "error");
    }
  },

  async callGemini(data, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const promptText = `
      You are a Project Manager. Analyze this task data:
      ${data}
      Output ONLY valid HTML based on the structure below. Do not use Markdown.
      <div class="report-container fade-in">
        <div class="report-summary-box">
          <h3><span class="material-icons-round">analytics</span> Executive Summary</h3>
          <p>[Write a 2-sentence summary of the overall workload and status here]</p>
        </div>
        <div class="report-grid">
          <div class="report-card danger"><h4><span class="material-icons-round">warning</span> Bottlenecks & Risks</h4><ul><li>[List high priority or overdue items]</li></ul></div>
          <div class="report-card success"><h4><span class="material-icons-round">thumb_up</span> Top Performers</h4><ul><li>[List completed or well-progressing items]</li></ul></div>
          <div class="report-card info"><h4><span class="material-icons-round">fact_check</span> Recommended Actions</h4><ul><li>[Specific next steps to take]</li></ul></div>
          <div class="report-card warning"><h4><span class="material-icons-round">event</span> Upcoming Deadlines</h4><ul><li>[List nearest dates]</li></ul></div>
        </div>
      </div>
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
    });

    if (!response.ok) throw new Error("API Connection Error");
    const json = await response.json();
    let text = json.candidates[0].content.parts[0].text;
    return text.replace(/```html/g, "").replace(/```/g, "");
  },
};

const db = {
  init: () =>
    new Promise((r) => {
      const q = indexedDB.open("StudyHubDB", 2);
      q.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains("files"))
          e.target.result.createObjectStore("files");
      };
      q.onsuccess = (e) => r(e.target.result);
    }),
  op: async (m, f) => {
    const d = await db.init();
    return new Promise(
      (r) =>
        (f(d.transaction("files", m).objectStore("files")).onsuccess = (e) =>
          r(e.target.result))
    );
  },
  savePdf: (i, f) => db.op("readwrite", (s) => s.put(f, i)),
  getPdf: (i) => db.op("readonly", (s) => s.get(i)),
  deletePdf: (i) => db.op("readwrite", (s) => s.delete(i)),
};

app.init();
