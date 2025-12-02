const DB_NAME = "StudyPlannerDB";
const DB_VERSION = 1;

export const pdfDB = {
  db: null,

  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("files"))
          db.createObjectStore("files");
        if (!db.objectStoreNames.contains("meta"))
          db.createObjectStore("meta", { keyPath: "id" });
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = reject;
    });
  },

  async addFile(file) {
    await this.init();
    const id = Date.now().toString();
    const meta = {
      id,
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + " MB",
      page: 1,
      date: new Date().toLocaleDateString(),
    };

    const tx = this.db.transaction(["files", "meta"], "readwrite");
    tx.objectStore("files").put(file, id);
    tx.objectStore("meta").put(meta);
    return new Promise((r) => (tx.oncomplete = r));
  },

  async getFiles() {
    await this.init();
    return new Promise((r) => {
      this.db.transaction("meta").objectStore("meta").getAll().onsuccess = (
        e
      ) => r(e.target.result || []);
    });
  },

  async getFileBlob(id) {
    await this.init();
    return new Promise((r) => {
      this.db.transaction("files").objectStore("files").get(id).onsuccess = (
        e
      ) => r(e.target.result);
    });
  },

  async updatePage(id, page) {
    await this.init();
    const tx = this.db.transaction("meta", "readwrite");
    const store = tx.objectStore("meta");
    store.get(id).onsuccess = (e) => {
      if (e.target.result) store.put({ ...e.target.result, page });
    };
  },

  async deleteFile(id) {
    await this.init();
    const tx = this.db.transaction(["files", "meta"], "readwrite");
    tx.objectStore("files").delete(id);
    tx.objectStore("meta").delete(id);
    return new Promise((r) => (tx.oncomplete = r));
  },
};

export default pdfDB;
