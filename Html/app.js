/* ==========================================================================
   1. CONFIGURATION & HELPERS
   --------------------------------------------------------------------------
   Global settings and utility functions used throughout the app.
   ========================================================================== */

// This is the API key for Google Gemini (AI features).
// In a real production app, you should never store keys in frontend code.
const GLOBAL_API_KEY = "API_KEY";

// A shortcut helper. Instead of typing document.getElementById("id") every time,
// we can just type $("id"). This saves a lot of typing!
const $ = (id) => document.getElementById(id);

/* ==========================================================================
   2. DATABASE MANAGER (IndexedDB)
   --------------------------------------------------------------------------
   Local Storage is too small for PDF files (limit is usually 5MB).
   We use "IndexedDB", a browser database, to store large files efficiently.
   ========================================================================== */
const StorageManager = {
  dbName: "StudyHubDB",
  storeName: "files", // We are creating a "table" called 'files'

  // Opens a connection to the browser's database
  async open() {
    return new Promise((resolve, reject) => {
      // Version 2 of the database
      const request = indexedDB.open(this.dbName, 2);

      // This runs only if the DB is new or version number changes
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Create the 'files' store if it doesn't exist yet
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (e) => resolve(e.target.result); // Success!
      request.onerror = (e) => reject("DB Error"); // Failed
    });
  },

  // A helper to handle the complex transaction logic of IndexedDB
  async transaction(mode, callback) {
    const db = await this.open();
    const tx = db.transaction(this.storeName, mode); // 'readonly' or 'readwrite'
    const store = tx.objectStore(this.storeName);
    return new Promise((resolve) => {
      const request = callback(store); // Run the actual DB command
      request.onsuccess = (e) => resolve(e.target.result);
    });
  },

  // Public methods to Save, Get, and Delete PDFs
  savePdf: (id, file) =>
    StorageManager.transaction("readwrite", (store) => store.put(file, id)),
  getPdf: (id) =>
    StorageManager.transaction("readonly", (store) => store.get(id)),
  deletePdf: (id) =>
    StorageManager.transaction("readwrite", (store) => store.delete(id)),
};

/* ==========================================================================
   3. AUTHENTICATION MANAGER
   --------------------------------------------------------------------------
   Handles Login, Signup, and Logout.
   NOTE: This uses LocalStorage, so it's a "fake" backend for demo purposes.
   User data lives only in the user's browser.
   ========================================================================== */
const AuthManager = {
  // Load existing users from memory, or start with empty object {}
  usersDB: JSON.parse(localStorage.getItem("usersDB") || "{}"),
  currentUser: localStorage.getItem("currentUser"),

  // Run on page load
  init() {
    if (this.currentUser) {
      this.showApp(); // If user is remembered, go to Dashboard
    } else {
      this.showAuth("login"); // Otherwise, show Login screen
    }
  },

  // Switch between Login form and Signup form
  toggleForm(view) {
    $("loginCard").classList.add("hidden");
    $("signupCard").classList.add("hidden");
    // Show the requested card
    $(view === "login" ? "loginCard" : "signupCard").classList.remove("hidden");
    // Clear old error messages
    $("loginError").classList.add("hidden");
    $("signupError").classList.add("hidden");
  },

  // Switch between the Auth Screen (Login) and the Main App (Dashboard)
  showAuth(view) {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    this.toggleForm(view);
  },

  showApp() {
    $("authView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("displayUser").innerText = this.currentUser; // Show "Welcome, User"
    TaskManager.render(); // Load the task list
  },

  // Logic for logging in
  login(e) {
    e.preventDefault(); // Stop page refresh
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value.trim();

    // Check if user exists AND password matches
    if (this.usersDB[u] && this.usersDB[u] === p) {
      this.currentUser = u;
      localStorage.setItem("currentUser", u); // Remember user
      this.showApp();
      UIManager.notify(`Welcome back, ${u}!`);
      // Clear inputs
      $("loginUser").value = "";
      $("loginPass").value = "";
    } else {
      $("loginError").innerText = "Invalid credentials";
      $("loginError").classList.remove("hidden");
    }
  },

  // Logic for creating new account
  signup(e) {
    e.preventDefault();
    const u = $("regUser").value.trim();
    const p = $("regPass").value.trim();

    // Validation checks
    if (this.usersDB[u]) {
      $("signupError").innerText = "Username taken";
      $("signupError").classList.remove("hidden");
      return;
    }
    if (p.length < 4) {
      $("signupError").innerText = "Password too short";
      $("signupError").classList.remove("hidden");
      return;
    }

    // Save user
    this.usersDB[u] = p;
    localStorage.setItem("usersDB", JSON.stringify(this.usersDB));

    // Auto login after signup
    this.currentUser = u;
    localStorage.setItem("currentUser", u);
    this.showApp();
    UIManager.notify("Account created!");
    $("regUser").value = "";
    $("regPass").value = "";
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem("currentUser");
    this.showAuth("login");
    UIManager.notify("Logged out");
  },
};

/* ==========================================================================
   4. TASK MANAGER
   --------------------------------------------------------------------------
   The Brain of the app. Handles Creating, Reading, Updating, Deleting (CRUD),
   plus Sorting, Filtering, and Pagination logic.
   ========================================================================== */
const TaskManager = {
  // Load tasks from storage or start empty []
  tasks: JSON.parse(localStorage.getItem("tasks") || "[]"),
  viewMode: localStorage.getItem("viewMode") || "grid", // 'grid' or 'list'
  editingId: null, // If set, we are editing this specific task ID

  // --- STATE VARIABLES ---
  currentPage: 1,
  itemsPerPage: 10,
  searchQuery: "", // Text typed in search bar
  activeFilter: "All", // Dropdown filter (e.g., "High", "Completed")

  // Called when app starts
  init() {
    this.updateViewToggles(); // Set correct Grid/List icons
  },

  // Save current state to LocalStorage and update UI
  save() {
    localStorage.setItem("tasks", JSON.stringify(this.tasks));
    this.render(); // Redraw the screen
  },

  // Switch between Grid and List view
  toggleView(mode) {
    this.viewMode = mode;
    localStorage.setItem("viewMode", mode);
    this.updateViewToggles();
    this.render();
  },

  // Updates CSS classes based on view mode (hides/shows table headers, etc.)
  updateViewToggles() {
    $("btnGrid").classList.toggle("active-view", this.viewMode === "grid");
    $("btnList").classList.toggle("active-view", this.viewMode === "list");

    const grid = $("taskGrid");
    if (this.viewMode === "list") {
      grid.classList.remove("grid");
      grid.classList.add("list-layout");
      $("listHeader").classList.remove("hidden"); // Show table headers
    } else {
      grid.classList.add("grid");
      grid.classList.remove("list-layout");
      $("listHeader").classList.add("hidden"); // Hide headers
    }
  },

  // Handles BOTH Creating New Tasks and Updating Existing ones
  async saveTask(e) {
    e.preventDefault();
    const file = $("pdfFile").files[0];
    const rawTitle = $("taskTitle").value;
    // Capitalize first letter
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    if (this.editingId) {
      // === SCENARIO 1: EDITING ===
      const index = this.tasks.findIndex((t) => t.id === this.editingId);
      if (index > -1) {
        // Update task details
        this.tasks[index].title = title;
        this.tasks[index].priority = $("taskPriority").value;
        this.tasks[index].date = $("taskDate").value;

        // Only update PDF if the user uploaded a NEW one
        if (file) {
          await StorageManager.savePdf(this.editingId, file);
          this.tasks[index].hasPdf = true;
        }
        UIManager.notify("Task updated");
      }
    } else {
      // === SCENARIO 2: CREATING NEW ===
      const id = Date.now(); // Use timestamp as unique ID
      if (file) await StorageManager.savePdf(id, file);

      this.tasks.push({
        id,
        title,
        priority: $("taskPriority").value,
        date: $("taskDate").value,
        hasPdf: !!file,
        isCompleted: false,
        createdBy: AuthManager.currentUser,
        progress: {}, // Tracks page number for each user
      });
      UIManager.notify("Task created");
    }

    this.save();
    UIManager.toggleModal("taskModal", false); // Close modal
  },

  // Marks task as Done/Undone
  toggleComplete(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.isCompleted = !task.isCompleted;
      this.save();
      if (task.isCompleted) UIManager.notify("Task completed", "success");
    }
  },

  // Opens confirmation modal before deleting
  requestDelete(id) {
    this.pendingDeleteId = id; // Remember which task to delete
    UIManager.toggleModal("confirmModal", true);

    // Setup the "Yes, Delete" button click
    $("confirmDeleteBtn").onclick = () => {
      this.tasks = this.tasks.filter((t) => t.id !== this.pendingDeleteId);
      StorageManager.deletePdf(this.pendingDeleteId); // Delete file from DB
      this.save();
      UIManager.toggleModal("confirmModal", false);
      UIManager.notify("Task deleted", "error");
    };
  },

  // --- FILTERING & PAGINATION LOGIC ---

  handleSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    this.currentPage = 1; // Reset to page 1 on new search
    this.render();
  },

  handleFilter(filter) {
    this.activeFilter = filter;
    this.currentPage = 1;
    this.render();
  },

  changePage(direction) {
    this.currentPage += direction;
    this.render();
    window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top
  },

  // Logic for the "Rows per page" dropdown
  changePageSize(size) {
    this.itemsPerPage = parseInt(size); // Convert string "20" to number 20
    this.currentPage = 1; // Reset to page 1 to prevent being on non-existent page
    this.render();
  },

  // --- MAIN RENDER FUNCTION ---
  // This function runs the pipeline: Filter -> Sort -> Paginate -> Draw HTML
  render() {
    const grid = $("taskGrid");
    // Priority scoring for sorting
    const scores = { High: 3, Medium: 2, Low: 1 };

    // 1. FILTER: By Search text AND Dropdown category
    let filtered = this.tasks.filter((t) =>
      t.title.toLowerCase().includes(this.searchQuery)
    );

    if (this.activeFilter !== "All") {
      if (this.activeFilter === "Completed")
        filtered = filtered.filter((t) => t.isCompleted);
      else
        filtered = filtered.filter(
          (t) => t.priority === this.activeFilter && !t.isCompleted
        );
    }

    // 2. SORT: High priority first
    filtered.sort((a, b) => scores[b.priority] - scores[a.priority]);

    // 3. PAGINATE: Calculate which items to show
    const totalPages = Math.ceil(filtered.length / this.itemsPerPage) || 1;

    // Safety check: Don't let user stay on Page 5 if only 1 page exists
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const currentTasks = filtered.slice(start, start + this.itemsPerPage);

    // 4. UPDATE UI CONTROLS
    $("currPage").innerText = this.currentPage;
    $("totalPage").innerText = totalPages;
    $("btnPrev").disabled = this.currentPage === 1;
    $("btnNext").disabled = this.currentPage === totalPages;
    // Hide controls if list is empty
    $("paginationControls").classList.toggle("hidden", filtered.length === 0);

    // 5. DRAW: Create HTML for empty state or task list
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="center-content text-muted" style="grid-column:1/-1; margin-top:50px">
                <span class="material-icons-round" style="font-size:48px; opacity:0.5">inventory_2</span>
                <p>No tasks found.</p>
            </div>`;
      return;
    }

    // Map data to HTML strings
    grid.innerHTML = currentTasks
      .map((t) => {
        // Get user's reading progress for this task
        const page = t.progress[AuthManager.currentUser] || 0;
        const isGrid = this.viewMode === "grid";

        // Use templates from UIManager
        return isGrid
          ? UIManager.templates.gridCard(t, page)
          : UIManager.templates.listRow(t, page);
      })
      .join("");
  },
};

/* ==========================================================================
   5. UI MANAGER
   --------------------------------------------------------------------------
   Handles DOM interactions, Modals, Themes, and HTML Templates.
   Separating this from logic makes code cleaner.
   ========================================================================== */
const UIManager = {
  init() {
    // Check if user previously selected Light Mode
    if (localStorage.getItem("theme") === "light") {
      document.body.classList.add("light-mode");
      $("themeIcon").innerText = "light_mode";
    }
  },

  toggleTheme() {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    // Save preference
    localStorage.setItem("theme", isLight ? "light" : "dark");
    $("themeIcon").innerText = isLight ? "light_mode" : "dark_mode";
  },

  // Generic function to Show/Hide any modal
  toggleModal(id, show) {
    $(id).classList[show ? "remove" : "add"]("hidden");

    // Special cleanup if closing/opening the Task Modal
    if (id === "taskModal") {
      if (!show) this.resetTaskForm(); // Clean form when closing
      else if (!TaskManager.editingId) this.resetTaskForm(); // Clean if creating new
    }
  },

  // Updates the file input UI when a user picks a file
  handleFileSelect(input) {
    const file = input.files[0];
    $("fileName").innerText = file ? file.name : "Click to upload document";
    const icon = document.querySelector(".icon-circle");

    // Change border color to Green (success) or Gray (default)
    $("fileLabel").style.borderColor = file ? "var(--low)" : "var(--border)";
    if (icon) {
      icon.style.color = file ? "var(--low)" : "var(--primary)";
      icon.style.background = file
        ? "rgba(16, 185, 129, 0.1)"
        : "rgba(99, 102, 241, 0.1)";
    }
  },

  resetTaskForm() {
    $("taskForm").reset();
    TaskManager.editingId = null;
    $("modalTitle").innerText = "Create New Task";
    $("modalSubmitBtn").innerText = "Save Task";
    this.handleFileSelect($("pdfFile")); // Reset file UI
  },

  // Creates a floating "Toast" notification (e.g., "Task Saved!")
  notify(msg, type = "success") {
    const t = document.createElement("div");
    t.className = "toast";
    // Green for success, Red for error
    t.style.borderLeftColor = type === "success" ? "var(--low)" : "var(--high)";
    t.innerHTML = `
            <span class="material-icons-round" style="color:${
              type === "success" ? "var(--low)" : "var(--high)"
            }">
                ${type === "success" ? "check_circle" : "error"}
            </span> ${msg}`;
    $("toastContainer").appendChild(t);

    // Animate out after 3 seconds
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },

  // Pre-fills the modal with task data for editing
  openEditModal(id) {
    const task = TaskManager.tasks.find((t) => t.id === id);
    if (!task) return;

    TaskManager.editingId = id;
    $("taskTitle").value = task.title;
    $("taskPriority").value = task.priority;
    $("taskDate").value = task.date;

    $("modalTitle").innerText = "Edit Task";
    $("modalSubmitBtn").innerText = "Update Task";

    if (task.hasPdf) {
      $("fileName").innerText = "Current PDF attached (Upload to replace)";
      $("fileName").classList.add("italic");
    }

    this.toggleModal("taskModal", true);
  },

  // Calculates stats and shows the Dashboard Modal
  showInfoDashboard() {
    const tasks = TaskManager.tasks;
    if (!tasks.length) return this.notify("No tasks to track", "error");

    const completed = tasks.filter((t) => t.isCompleted).length;
    const pending = tasks.filter((t) => !t.isCompleted);
    const high = pending.filter((t) => t.priority === "High").length;

    // Progress Bar Calculation
    const percent = Math.round((completed / tasks.length) * 100);
    $("progressBar").style.width = `${percent}%`;
    $("progressText").innerText = `${percent}% Complete`;

    // Stats
    $("countPending").innerText = pending.length;
    $("countHigh").innerText = high;

    // Calculate tasks due in next 3 days
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 3);

    const dueSoon = pending.filter((t) => {
      const d = new Date(t.date);
      return d >= today && d <= limit;
    }).length;
    $("countDue").innerText = dueSoon;

    // Find the very next deadline
    const nextTask = pending.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    )[0];

    $("nextTaskDisplay").innerHTML = nextTask
      ? `<span class="material-icons-round color-primary">double_arrow</span>
               <div>
                   <div class="font-bold">${nextTask.title}</div>
                   <div class="text-muted" style="font-size:0.8rem">Due: ${nextTask.date} • ${nextTask.priority}</div>
               </div>`
      : `<p class="color-primary font-bold" style="margin:0">All caught up! 🎉</p>`;

    this.toggleModal("infoModal", true);
  },

  // HTML Strings for Grid cards and List rows.
  // We keep HTML here to keep the Logic section clean.
  templates: {
    gridCard: (t, page) => `
            <div class="card bounce-in ${t.isCompleted ? "task-done" : ""}">
                <div class="card-header">
                    <h3 class="task-title" ${
                      t.hasPdf
                        ? `onclick="PDFManager.open(${t.id}, '${t.title}')"`
                        : ""
                    }>
                        ${t.title} ${
      t.hasPdf
        ? '<span class="material-icons-round" style="font-size:16px">attachment</span>'
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
                    ${
                      t.hasPdf
                        ? `<button class="btn-read" onclick="PDFManager.open(${t.id}, '${t.title}')"><span class="material-icons-round">menu_book</span> Pg ${page}</button>`
                        : `<button class="btn-secondary" disabled style="flex:1; opacity:0.5">No PDF</button>`
                    }
                    <button class="btn-icon ${
                      t.isCompleted ? "btn-check-active" : ""
                    }" onclick="TaskManager.toggleComplete(${t.id})">
                        <span class="material-icons-round">${
                          t.isCompleted
                            ? "check_circle"
                            : "radio_button_unchecked"
                        }</span>
                    </button>
                    <button class="btn-icon" onclick="UIManager.openEditModal(${
                      t.id
                    })"><span class="material-icons-round">edit</span></button>
                    <button class="btn-icon" onclick="TaskManager.requestDelete(${
                      t.id
                    })"><span class="material-icons-round" style="color:var(--high)">delete</span></button>
                </div>
            </div>`,

    listRow: (t, page) => `
            <div class="list-item-row bounce-in ${
              t.isCompleted ? "task-done" : ""
            }">
                <button class="btn-icon ${
                  t.isCompleted ? "btn-check-active" : ""
                }" onclick="TaskManager.toggleComplete(${t.id})">
                     <span class="material-icons-round">${
                       t.isCompleted ? "check_circle" : "radio_button_unchecked"
                     }</span>
                </button>
                <div class="task-title" ${
                  t.hasPdf
                    ? `onclick="PDFManager.open(${t.id}, '${t.title}')" style="cursor:pointer"`
                    : ""
                }>${t.title}</div>
                <div><span class="badge ${t.priority}">${
      t.priority
    }</span></div>
                <div class="text-muted"><span class="material-icons-round" style="font-size:16px; vertical-align:middle">event</span> ${
                  t.date
                }</div>
                <div class="text-muted">Pg ${page}</div>
                <div class="row-actions">
                    ${
                      t.hasPdf
                        ? `<button class="btn-icon" onclick="PDFManager.open(${t.id}, '${t.title}')"><span class="material-icons-round color-primary">menu_book</span></button>`
                        : ""
                    }
                    <button class="btn-icon" onclick="UIManager.openEditModal(${
                      t.id
                    })"><span class="material-icons-round">edit</span></button>
                    <button class="btn-icon" onclick="TaskManager.requestDelete(${
                      t.id
                    })"><span class="material-icons-round" style="color:var(--high)">delete</span></button>
                </div>
            </div>`,
  },
};

/* ==========================================================================
   6. PDF MANAGER
   --------------------------------------------------------------------------
   Handles fetching PDFs from DB, rendering them to canvas using pdf.js,
   and saving page progress.
   ========================================================================== */
const PDFManager = {
  pdf: null,
  page: 1,
  scale: 1.2, // Default zoom level
  currentTaskId: null,

  async open(id, title) {
    this.currentTaskId = id;
    $("docName").innerText = title;

    try {
      // 1. Get blob from Database
      const blob = await StorageManager.getPdf(id);
      if (!blob) return UIManager.notify("File not found", "error");

      // 2. Load into PDF.js
      this.pdf = await pdfjsLib.getDocument(URL.createObjectURL(blob)).promise;
      $("pgTotal").innerText = this.pdf.numPages;

      // 3. Load user's last saved page
      const task = TaskManager.tasks.find((t) => t.id === id);
      this.page =
        (task.progress && task.progress[AuthManager.currentUser]) || 1;

      // 4. Calculate "Smart Zoom" to fit screen width
      const p = await this.pdf.getPage(1);
      const viewport = p.getViewport({ scale: 1 });
      const screenWidth = window.innerWidth * 0.8;
      this.scale = Math.min(1.5, screenWidth / viewport.width);

      // 5. Draw
      await this.renderPage();
      UIManager.toggleModal("pdfViewerModal", true);
    } catch (e) {
      console.error(e);
      UIManager.notify("Error opening PDF", "error");
    }
  },

  async renderPage() {
    // Get the specific page object
    const page = await this.pdf.getPage(this.page);
    const viewport = page.getViewport({ scale: this.scale });
    const canvas = $("pdfCanvas");
    const ctx = canvas.getContext("2d");

    // Resize canvas to match PDF size
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render onto the canvas context
    await page.render({ canvasContext: ctx, viewport }).promise;
    $("pgNum").innerText = this.page;

    // AUTO-SAVE: Update progress in tasks array and save to local storage
    const task = TaskManager.tasks.find((t) => t.id === this.currentTaskId);
    if (task) {
      if (!task.progress) task.progress = {};
      task.progress[AuthManager.currentUser] = this.page;
      localStorage.setItem("tasks", JSON.stringify(TaskManager.tasks));
    }
  },

  // Pagination controls for PDF
  changePage(delta) {
    const newPage = this.page + delta;
    if (newPage > 0 && newPage <= this.pdf.numPages) {
      this.page = newPage;
      this.renderPage();
    }
  },

  // Zoom controls
  zoom(delta) {
    const newScale = this.scale + delta;
    if (newScale >= 0.5 && newScale <= 3.0) {
      this.scale = newScale;
      this.renderPage();
    }
  },

  close() {
    UIManager.toggleModal("pdfViewerModal", false);
    TaskManager.render(); // Refresh UI to update "Pg X" button on the card
  },
};

/* ==========================================================================
   7. AI MANAGER (Google Gemini)
   --------------------------------------------------------------------------
   Sends task data to Google's AI model to get a summary report.
   ========================================================================== */
const AIManager = {
  async generateReport() {
    if (!TaskManager.tasks.length)
      return UIManager.notify("No tasks to analyze", "error");

    UIManager.toggleModal("summaryModal", true);
    $("aiLoading").classList.remove("hidden");
    $("aiResult").innerHTML = "";

    const prompt = this.buildPrompt();

    try {
      const html = await this.callApi(prompt);
      $("aiLoading").classList.add("hidden");
      $("aiResult").innerHTML = html; // Inject generated HTML
    } catch (e) {
      console.error(e);
      $("aiLoading").classList.add("hidden");
      $("aiResult").innerHTML = this.getErrorHTML();
    }
  },

  // Constructs the instruction for the AI
  buildPrompt() {
    // Convert task objects into a simple text list
    const dataStr = TaskManager.tasks
      .map(
        (t, i) =>
          `Task ${i + 1}: "${t.title}" | Priority: ${t.priority} | Due: ${
            t.date
          } | Status: ${t.isCompleted ? "DONE" : "PENDING"}`
      )
      .join("\n");

    // We ask the AI to return raw HTML so we can style it easily
    return `
            You are a Project Manager. Analyze this data:
            ${dataStr}
            Output ONLY valid HTML using this structure (no markdown):
            <div class="report-container fade-in">
                <div class="report-summary-box">
                    <h3><span class="material-icons-round">analytics</span> Executive Summary</h3>
                    <p>[2 sentence summary]</p>
                </div>
                <div class="report-grid">
                    <div class="report-card danger"><h4><span class="material-icons-round">warning</span> Bottlenecks</h4><ul><li>[List risks]</li></ul></div>
                    <div class="report-card success"><h4><span class="material-icons-round">thumb_up</span> Performing Well</h4><ul><li>[List successes]</li></ul></div>
                    <div class="report-card info"><h4><span class="material-icons-round">fact_check</span> Recommendations</h4><ul><li>[Next steps]</li></ul></div>
                    <div class="report-card warning"><h4><span class="material-icons-round">event</span> Deadlines</h4><ul><li>[Upcoming dates]</li></ul></div>
                </div>
            </div>`;
  },

  // Sends the network request to Google
  async callApi(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GLOBAL_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }] }),
    });

    if (!response.ok) throw new Error("API Error");
    const json = await response.json();
    // Clean up response (sometimes AI adds markdown code blocks like ```html ... ```)
    return json.candidates[0].content.parts[0].text.replace(/```html|```/g, "");
  },

  getErrorHTML() {
    return `
        <div class="report-summary-box" style="border-left-color:var(--high)">
            <h3><span class="material-icons-round">error_outline</span> Analysis Failed</h3>
            <p>Could not generate report. Check internet connection or API Key.</p>
        </div>`;
  },
};

/* ==========================================================================
   8. STARTUP
   --------------------------------------------------------------------------
   Wait for the HTML to fully load, then start the managers.
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  UIManager.init();
  AuthManager.init();
  TaskManager.init();
});
