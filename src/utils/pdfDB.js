// src/utils/pdfDB.js
const DB_NAME = "SimplePdfDB";
const DB_VERSION = 1;
const FILE_STORE = "files";
const META_STORE = "meta";

class PdfDB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => reject("IndexedDB init error");
    });
  }

  async saveFile(file) {
    const id = "doc_" + Date.now();
    const meta = { id, name: file.name, size: (file.size / 1024 / 1024).toFixed(2) + " MB", lastPage: 1, createdAt: Date.now() };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([FILE_STORE, META_STORE], "readwrite");
      tx.objectStore(FILE_STORE).put(file, id);
      tx.objectStore(META_STORE).put(meta);
      tx.oncomplete = () => resolve(meta);
      tx.onerror = () => reject("Failed save file");
    });
  }

  async getAllMeta() {
    return new Promise((resolve) => {
      const tx = this.db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async getFile(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(FILE_STORE, "readonly");
      const req = tx.objectStore(FILE_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async updateProgress(id, page) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(META_STORE, "readwrite");
      const store = tx.objectStore(META_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (!data) return resolve();
        data.lastPage = page;
        store.put(data);
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  async deleteFile(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction([FILE_STORE, META_STORE], "readwrite");
      tx.objectStore(FILE_STORE).delete(id);
      tx.objectStore(META_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

const pdfdb = new PdfDB();
export default pdfdb;
