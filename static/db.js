/**
 * Piston IndexedDB Client
 * Robust, promise-based native browser database persistence for documents,
 * transcripts, and session settings.
 */

class PistonDatabase {
  constructor() {
    this.dbName = 'PistonDB';
    this.version = 1;
    this._db = null;
    this._isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Open or return existing database connection.
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    if (!this._isSupported) {
      throw new Error('IndexedDB is not supported in this environment');
    }
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Documents Store: keyed by filename
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'name' });
          docStore.createIndex('id', 'id', { unique: false });
        }

        // Transcripts Store: auto-incrementing ID
        if (!db.objectStoreNames.contains('transcripts')) {
          db.createObjectStore('transcripts', { keyPath: 'id', autoIncrement: true });
        }

        // Settings Store: key-value configuration
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = (event) => {
        console.error('PistonDatabase failed to open:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Helper to retrieve an ObjectStore in a new transaction.
   * @param {string} storeName
   * @param {IDBTransactionMode} mode
   * @returns {Promise<IDBObjectStore>}
   */
  async _getStore(storeName, mode = 'readonly') {
    const db = await this.open();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ==========================================
  // Document Operations
  // ==========================================

  /**
   * Get all persisted documents.
   * @returns {Promise<Array<Object>>}
   */
  async getAllDocuments() {
    try {
      const store = await this._getStore('documents', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB getAllDocuments error:', err);
      return [];
    }
  }

  /**
   * Put (insert or update) a single document.
   * @param {Object} doc
   * @returns {Promise<void>}
   */
  async putDocument(doc) {
    if (!doc || !doc.name) return;
    try {
      const store = await this._getStore('documents', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(doc);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB putDocument error:', err);
    }
  }

  /**
   * Replace all documents in the store with an authoritative list.
   * @param {Array<Object>} docs
   * @returns {Promise<void>}
   */
  async setAllDocuments(docs) {
    try {
      const db = await this.open();
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      store.clear();
      if (Array.isArray(docs)) {
        for (const doc of docs) {
          if (doc && doc.name) {
            store.put(doc);
          }
        }
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB setAllDocuments error:', err);
    }
  }

  /**
   * Remove a document by its filename key.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async deleteDocument(name) {
    if (!name) return;
    try {
      const store = await this._getStore('documents', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB deleteDocument error:', err);
    }
  }

  /**
   * Clear all documents from local database.
   * @returns {Promise<void>}
   */
  async clearDocuments() {
    try {
      const store = await this._getStore('documents', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB clearDocuments error:', err);
    }
  }

  // ==========================================
  // Transcript Operations
  // ==========================================

  /**
   * Get all transcript messages.
   * @returns {Promise<Array<Object>>}
   */
  async getTranscripts() {
    try {
      const store = await this._getStore('transcripts', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB getTranscripts error:', err);
      return [];
    }
  }

  /**
   * Append a message to the transcript store.
   * @param {Object} msg { role, text, time, timestamp }
   * @returns {Promise<number>}
   */
  async addTranscriptMessage(msg) {
    try {
      const store = await this._getStore('transcripts', 'readwrite');
      const item = { ...msg, timestamp: msg.timestamp || Date.now() };
      return new Promise((resolve, reject) => {
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB addTranscriptMessage error:', err);
    }
  }

  /**
   * Clear all transcript history.
   * @returns {Promise<void>}
   */
  async clearTranscripts() {
    try {
      const store = await this._getStore('transcripts', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB clearTranscripts error:', err);
    }
  }

  // ==========================================
  // Settings Operations
  // ==========================================

  /**
   * Get a settings value by key.
   * @param {string} key
   * @param {*} defaultValue
   * @returns {Promise<*>}
   */
  async getSetting(key, defaultValue = null) {
    try {
      const store = await this._getStore('settings', 'readonly');
      return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result !== undefined ? req.result.value : defaultValue);
        };
        req.onerror = () => resolve(defaultValue);
      });
    } catch (err) {
      return defaultValue;
    }
  }

  /**
   * Save a settings key-value pair.
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    try {
      const store = await this._getStore('settings', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB setSetting error:', err);
    }
  }

  /**
   * Delete a setting key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async deleteSetting(key) {
    try {
      const store = await this._getStore('settings', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB deleteSetting error:', err);
    }
  }
}

// Global instance exposed on window
window.pistonDB = new PistonDatabase();
