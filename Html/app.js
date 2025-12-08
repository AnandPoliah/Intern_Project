// ⚠️ GLOBAL CONFIGURATION
const GLOBAL_API_KEY = "API";
const $ = (id) => document.getElementById(id);

const app = {
  tasks: JSON.parse(localStorage.getItem("tasks") || "[]"),
  usersDB: JSON.parse(localStorage.getItem("usersDB") || "{}"),
  user: null,
  viewMode: localStorage.getItem("viewMode") || "grid",

  // --- PAGINATION SETTINGS ---
  currentPage: 1,
  itemsPerPage: 10, // Set to 8 based on previous conversation

  // --- EDIT STATE ---
  editingId: null,

  // NEW: Search States
  searchQuery: "",
  activeFilter: "All",

  init() {
    if (localStorage.getItem("theme") === "light") {
      document.body.classList.add("light-mode");
      $("themeIcon").innerText = "light_mode";
    }

    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      this.user = savedUser;
      this.showApp();
    } else {
      this.showAuth("login");
    }

    this.updateViewToggles();

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
      this.saveTask();
    };
  },

  // --- LOGIC: MARK COMPLETED (NEW) ---
  toggleComplete(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      // Toggle the boolean
      task.isCompleted = !task.isCompleted;
      this.save();

      // Optional: Notify user
      if (task.isCompleted) ui.notify("Task marked as complete", "success");
    }
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

  toggleTheme() {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    $("themeIcon").innerText = isLight ? "light_mode" : "dark_mode";
  },

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

  openEditModal(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;

    this.editingId = id;
    $("taskTitle").value = task.title;
    $("taskPriority").value = task.priority;
    $("taskDate").value = task.date;

    const modalHeader = document.querySelector(".modal-header-modern h3");
    const modalBtn = document.querySelector(".btn-primary-modern span");
    if (modalHeader) modalHeader.innerText = "Edit Task";
    if (modalBtn) modalBtn.innerText = "Update Task";

    if (task.hasPdf) {
      $("fileName").innerText = "Current PDF attached (Upload new to replace)";
      $("fileName").style.fontStyle = "italic";
    }

    ui.toggleModal("taskModal", true);
  },

  async saveTask() {
    const file = $("pdfFile").files[0];
    const rawTitle = $("taskTitle").value;
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    if (this.editingId) {
      const taskIndex = this.tasks.findIndex((t) => t.id === this.editingId);
      if (taskIndex > -1) {
        this.tasks[taskIndex].title = title;
        this.tasks[taskIndex].priority = $("taskPriority").value;
        this.tasks[taskIndex].date = $("taskDate").value;

        if (file) {
          ui.notify("Updating PDF...", "success");
          await db.savePdf(this.editingId, file);
          this.tasks[taskIndex].hasPdf = true;
        }
        ui.notify("Task updated successfully");
      }
    } else {
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
        isCompleted: false, // Default state
        createdBy: this.user,
        progress: {},
      };
      this.tasks.push(newTask);
      ui.notify("Task created successfully");
    }

    this.save();
    ui.toggleModal("taskModal", false);
  },

  taskIdToDelete: null,
  requestDelete(id) {
    this.taskIdToDelete = id;
    ui.toggleModal("confirmModal", true);
    $("confirmDeleteBtn").onclick = () => {
      this.tasks = this.tasks.filter((t) => t.id !== this.taskIdToDelete);
      db.deletePdf(this.taskIdToDelete);

      const maxPages = Math.ceil(this.tasks.length / this.itemsPerPage);
      if (this.currentPage > maxPages && maxPages > 0) {
        this.currentPage = maxPages;
      }

      this.save();
      ui.toggleModal("confirmModal", false);
      ui.notify("Task deleted", "error");
    };
  },

  save() {
    localStorage.setItem("tasks", JSON.stringify(this.tasks));
    this.render();
  },

  changePage(direction) {
    const sortedTasks = this.getSortedTasks();
    const totalPages = Math.ceil(sortedTasks.length / this.itemsPerPage);
    const newPage = this.currentPage + direction;

    if (newPage > 0 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  },

  // ... inside app object ...

  handleSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    this.currentPage = 1; // Reset to page 1 on search
    this.render();
  },

  handleFilter(filter) {
    this.activeFilter = filter;
    this.currentPage = 1; // Reset to page 1 on filter change
    this.render();
  },

  getSortedTasks() {
    const scores = { High: 3, Medium: 2, Low: 1 };

    // 1. Start with all tasks
    let filtered = [...this.tasks];

    // 2. Apply Search
    if (this.searchQuery) {
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(this.searchQuery)
      );
    }

    // 3. Apply Dropdown Filter
    if (this.activeFilter !== "All") {
      if (this.activeFilter === "Completed") {
        filtered = filtered.filter((t) => t.isCompleted);
      } else {
        // For Priority (High/Med/Low), we also want to hide completed tasks
        // unless the user specifically asked for "Completed"
        filtered = filtered.filter(
          (t) => t.priority === this.activeFilter && !t.isCompleted
        );
      }
    }

    // 4. Sort (Priority High to Low)
    return filtered.sort((a, b) => scores[b.priority] - scores[a.priority]);
  },

  updatePaginationUI(totalPages) {
    const controls = $("paginationControls");
    if (!this.tasks.length || totalPages <= 1) {
      if (controls) controls.classList.add("hidden");
      return;
    }
    if (controls) {
      controls.classList.remove("hidden");
      $("currPage").innerText = this.currentPage;
      $("totalPage").innerText = totalPages;
      $("btnPrev").disabled = this.currentPage === 1;
      $("btnNext").disabled = this.currentPage === totalPages;
    }
  },

  render() {
    const grid = $("taskGrid");

    if (!this.tasks.length) {
      grid.innerHTML = `<div class="center-content" style="grid-column:1/-1; margin-top:50px; color:var(--text-muted)">
        <span class="material-icons-round" style="font-size:48px; opacity:0.5">inventory_2</span>
        <p>No tasks yet.</p>
      </div>`;
      this.updatePaginationUI(0);
      return;
    }

    // --- TEMPLATE HELPERS ---
    const getGridCard = (t, page, clickAttr, pdfAction) => {
      const readBtn = t.hasPdf
        ? `<button class="btn-read" onclick="${pdfAction}"><span class="material-icons-round">menu_book</span> Read (Pg ${page})</button>`
        : `<button class="btn-secondary" disabled style="opacity:0.5;flex:1">No PDF</button>`;

      // Determine Check Button State
      const checkIcon = t.isCompleted
        ? "check_circle"
        : "radio_button_unchecked";
      const checkClass = t.isCompleted ? "btn-check-active" : "";
      const cardClass = t.isCompleted ? "task-done" : "";

      return `
        <div class="card bounce-in ${cardClass}">
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
                
                <button class="btn-icon ${checkClass}" onclick="app.toggleComplete(${
        t.id
      })" title="${t.isCompleted ? "Mark Undone" : "Mark Done"}">
                    <span class="material-icons-round">${checkIcon}</span>
                </button>

                <button class="btn-icon" onclick="app.openEditModal(${
                  t.id
                })" title="Edit">
                    <span class="material-icons-round" style="color:var(--text-main)">edit</span>
                </button>

                <button class="btn-del" onclick="app.requestDelete(${
                  t.id
                })" title="Delete">
                    <span class="material-icons-round">delete</span>
                </button>
            </div>
        </div>`;
    };

    const getListRow = (t, page, clickAttr, pdfAction) => {
      const readIcon = t.hasPdf
        ? `<button class="btn-icon" onclick="${pdfAction}" title="Read PDF"><span class="material-icons-round" style="color:var(--primary)">menu_book</span></button>`
        : `<span class="material-icons-round" style="color:var(--border); padding:8px">block</span>`;

      // Determine Check Button State
      const checkIcon = t.isCompleted
        ? "check_circle"
        : "radio_button_unchecked";
      const checkClass = t.isCompleted ? "btn-check-active" : "";
      const rowClass = t.isCompleted ? "task-done" : "";

      return `
        <div class="list-item-row bounce-in ${rowClass}">
            <button class="btn-icon ${checkClass}" onclick="app.toggleComplete(${t.id})" style="margin-right:10px">
                 <span class="material-icons-round">${checkIcon}</span>
            </button>

            <div class="task-title" ${clickAttr}>${t.title}</div>
            <div><span class="badge ${t.priority}">${t.priority}</span></div>
            <div class="meta-text"><span class="material-icons-round" style="font-size:16px">event</span> ${t.date}</div>
            <div class="meta-text">Pg ${page}</div>
            <div class="row-actions">
                ${readIcon}
                <button class="btn-icon" onclick="app.openEditModal(${t.id})" title="Edit">
                    <span class="material-icons-round" style="color:var(--text-main)">edit</span>
                </button>
                <button class="btn-icon" onclick="app.requestDelete(${t.id})" title="Delete">
                    <span class="material-icons-round" style="color:var(--high)">delete</span>
                </button>
            </div>
        </div>`;
    };

    // --- MAIN RENDER LOGIC ---
    const allSortedTasks = this.getSortedTasks();
    const totalPages = Math.ceil(allSortedTasks.length / this.itemsPerPage);

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const tasksToShow = allSortedTasks.slice(startIndex, endIndex);

    const isGrid = this.viewMode === "grid";

    grid.innerHTML = tasksToShow
      .map((t) => {
        const page = t.progress[this.user] || 0;
        const pdfAction = `viewer.open(${t.id}, '${t.title}')`;
        const clickAttr = t.hasPdf
          ? `onclick="${pdfAction}" style="cursor:pointer"`
          : `style="cursor:default"`;

        return isGrid
          ? getGridCard(t, page, clickAttr, pdfAction)
          : getListRow(t, page, clickAttr, pdfAction);
      })
      .join("");

    this.updatePaginationUI(totalPages);
  },
};

// ... (Rest of ui, viewer, reporter, db objects remain exactly the same as previous) ...

const ui = {
  toggleModal(id, show) {
    $(id).classList[show ? "remove" : "add"]("hidden");
    if (!show && id === "taskModal") {
      this.resetTaskModal();
    } else if (show && id === "taskModal" && !app.editingId) {
      this.resetTaskModal();
    }
  },
  resetTaskModal() {
    $("taskForm").reset();
    app.editingId = null;
    $("fileName").innerText = "Click to upload document";
    $("fileName").style.fontStyle = "normal";
    $("fileLabel").style.borderColor = "var(--border)";
    const icon = document.querySelector(".icon-circle");
    if (icon) {
      icon.style.color = "var(--primary)";
      icon.style.background = "rgba(99, 102, 241, 0.1)";
    }
    const modalHeader = document.querySelector(".modal-header-modern h3");
    const modalBtn = document.querySelector(".btn-primary-modern span");
    if (modalHeader) modalHeader.innerText = "Create New Task";
    if (modalBtn) modalBtn.innerText = "Save Task";
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
  // ... existing toggleModal, closeConfirm, etc ...

  showInfo() {
    const total = app.tasks.length;
    if (total === 0) return this.notify("No tasks to track", "error");

    // 1. Calculate Stats
    const completed = app.tasks.filter((t) => t.isCompleted).length;
    const pending = app.tasks.filter((t) => !t.isCompleted);

    const highPriority = pending.filter((t) => t.priority === "High").length;

    // Sort pending by date to find "Due Soon"
    const sortedPending = pending.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    const nextTask = sortedPending[0]; // The one with the soonest date

    // Calculate percentage
    const percent = Math.round((completed / total) * 100);

    // 2. Update DOM Elements
    $("progressBar").style.width = `${percent}%`;
    $("progressText").innerText = `${percent}% Complete`;

    $("countPending").innerText = pending.length;
    $("countHigh").innerText = highPriority;

    // Count tasks due within 3 days
    const today = new Date();
    const threeDays = new Date();
    threeDays.setDate(today.getDate() + 3);

    const dueSoonCount = pending.filter((t) => {
      const d = new Date(t.date);
      return d >= today && d <= threeDays;
    }).length;
    $("countDue").innerText = dueSoonCount;

    // 3. Show Next Task
    const nextDiv = $("nextTaskDisplay");
    if (nextTask) {
      nextDiv.innerHTML = `
            <span class="material-icons-round">double_arrow</span>
            <div>
                <div style="font-weight:600; color:var(--text-main)">${nextTask.title}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">Due: ${nextTask.date} &bull; ${nextTask.priority} Priority</div>
            </div>
        `;
    } else {
      nextDiv.innerHTML = `<p style="color:var(--low); font-weight:500; margin:0">All caught up! 🎉</p>`;
    }

    // 4. Open Modal
    this.toggleModal("infoModal", true);
  },

  // ... rest of existing ui functions ...
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
          } | Status: ${t.isCompleted ? "COMPLETED" : "In Progress"}`
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
