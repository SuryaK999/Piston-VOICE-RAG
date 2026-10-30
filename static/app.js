/* Piston Frontend Logic - v2.3.0 */

const DOM = {
  uploadInput: document.getElementById('doc-upload'),
  docList: document.getElementById('doc-list'),
  stageTitle: document.getElementById('stage-title'),
  stageSubtitle: document.getElementById('stage-subtitle'),
  orb: document.getElementById('orb'),
  orbCanvas: document.getElementById('orb-canvas'),
  activeContextName: document.getElementById('active-context-name'),
  contextCount: document.getElementById('context-count'),
  btnMute: document.getElementById('btn-mute'),
  btnInterrupt: document.getElementById('btn-interrupt'),
  btnEnd: document.getElementById('btn-end'),
  transcript: document.getElementById('transcript'),
  liveIndicator: document.querySelector('.live-indicator'),
  btnMenuMobile: document.getElementById('btn-menu-mobile'),
  btnMenuDesktop: document.getElementById('btn-menu-desktop'),
  btnUncollapseLeft: document.getElementById('btn-uncollapse-left') || document.getElementById('btn-uncollapse'),
  btnUncollapseRight: document.getElementById('btn-uncollapse-right'),
  btnCollapseRight: document.getElementById('btn-collapse-right'),
  btnTranscript: document.getElementById('btn-transcript'),
  leftPanel: document.querySelector('.left-panel'),
  rightPanel: document.querySelector('.right-panel'),
  btnContext: document.getElementById('btn-context'),
  btnContextCount: document.getElementById('btn-context-count'),
  contextDropdown: document.getElementById('context-dropdown'),
  contextDropdownList: document.getElementById('context-dropdown-list'),
  docSearch: document.getElementById('doc-search'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnClearDocs: document.getElementById('btn-clear-docs'),
  toastContainer: document.getElementById('toast-container')
};

let orbVisualizer = null;
const VisualizerClass = window.VoiceOrbVisualizer || window.OrbVisualizer;
if (VisualizerClass && DOM.orbCanvas) {
  try {
    orbVisualizer = new VisualizerClass(DOM.orbCanvas);
  } catch (err) {
    console.warn('Canvas VoiceOrbVisualizer fallback to CSS orb:', err);
  }
}

let uploadedDocs = [];
let activeDocId = null;

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// --- Theme Management with IndexedDB ---
async function initTheme() {
  let isDark = false;
  if (window.pistonDB) {
    const saved = await window.pistonDB.getSetting('theme');
    if (saved !== null) {
      isDark = saved === 'dark';
    } else {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  if (isDark) {
    document.body.classList.add('dark-mode');
    updateThemeIcons(true);
  } else {
    document.body.classList.remove('dark-mode');
    updateThemeIcons(false);
  }
}

function updateThemeIcons(isDark) {
  if (!DOM.btnThemeToggle) return;
  const sunIcon = DOM.btnThemeToggle.querySelector('.sun-icon');
  const moonIcon = DOM.btnThemeToggle.querySelector('.moon-icon');
  if (sunIcon && moonIcon) {
    sunIcon.style.display = isDark ? 'none' : 'block';
    moonIcon.style.display = isDark ? 'block' : 'none';
  }
}

if (DOM.btnThemeToggle) {
  DOM.btnThemeToggle.addEventListener('click', async () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    if (window.pistonDB) {
      await window.pistonDB.setSetting('theme', isDark ? 'dark' : 'light');
    }
    updateThemeIcons(isDark);
  });
}

initTheme();

let ws = null;
let audioCtx = null;
let workletNode = null;
let mediaStream = null;
let nextPlayTime = 0;
let liveSources = new Set();
let currentBubble = { user: null, agent: null };
let isMuted = false;
let isIntentionalClose = false;

// Audio Analyzers
let micAnalyzer = null;
let aiAnalyzer = null;
let animationFrameId = null;
let appState = 'idle'; // idle, listening, searching, speaking, error
let isInterrupting = false;
let inactivityTimer = null;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (appState === 'listening' && ws && ws.readyState === WebSocket.OPEN) {
      playEndSound();
      stopSession(false, 'Session Timeout', 'No activity for 10 minutes. Tap orb to resume.');
    }
  }, 600000); // 10 minutes
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

function playEndSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

function setState(newState, message, subtitle) {
  appState = newState;
  DOM.orb.className = `orb state-${newState}`;
  if (orbVisualizer) {
    orbVisualizer.setState(newState);
    if (newState === 'idle' || newState === 'error') {
      orbVisualizer.setAudioLevel(0);
    }
  }
  
  if (message) DOM.stageTitle.textContent = message;
  if (subtitle !== undefined) DOM.stageSubtitle.textContent = subtitle;
  
  DOM.liveIndicator.classList.toggle('active', ['listening', 'searching', 'speaking'].includes(newState));
  
  const isInactive = newState === 'idle' || newState === 'error';
  DOM.btnMute.disabled = isInactive;
  DOM.btnInterrupt.disabled = isInactive;
  DOM.btnEnd.disabled = isInactive;
}

// --- Document Management & IndexedDB Persistence ---

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getIconType(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md') return 'md';
  return 'txt';
}

function syncContextToBackend() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const activeDoc = activeDocId ? uploadedDocs.find(d => d.id === activeDocId) : null;
    ws.send(JSON.stringify({
      type: 'set_context',
      doc_name: activeDoc ? activeDoc.name : null
    }));
  }
}

function createDocItem(doc, inDropdown = false) {
  const li = document.createElement('li');
  const isActive = doc.id === activeDocId;
  li.className = `doc-item ${isActive ? 'active' : ''}`;
  
  li.addEventListener('click', () => selectDoc(doc.id));

  const iconType = getIconType(doc.name);
  const chunkText = doc.chunks_count ? `${doc.chunks_count} chunks` : '';
  const metaParts = [iconType.toUpperCase(), formatSize(doc.size), chunkText].filter(Boolean).join(' • ');

  const iconDiv = document.createElement('div');
  iconDiv.className = `doc-icon ${iconType}`;
  iconDiv.textContent = iconType.toUpperCase();

  const infoDiv = document.createElement('div');
  infoDiv.className = 'doc-info';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'doc-title';
  titleDiv.title = doc.name;
  titleDiv.textContent = doc.name;

  const metaDiv = document.createElement('div');
  metaDiv.className = 'doc-meta';

  if (doc.parsed) {
    metaDiv.innerHTML = `<span>${metaParts}</span><span class="doc-status"><span class="status-dot"></span>Indexed</span>`;
  } else {
    metaDiv.innerHTML = `<span>${iconType.toUpperCase()} • ${formatSize(doc.size)}</span><span class="doc-status" style="color:#f59e0b">Uploading...</span>`;
  }

  infoDiv.appendChild(titleDiv);
  infoDiv.appendChild(metaDiv);

  li.appendChild(iconDiv);
  li.appendChild(infoDiv);

  if (!inDropdown) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-doc-delete';
    delBtn.title = `Remove "${doc.name}"`;
    delBtn.setAttribute('aria-label', `Remove "${doc.name}"`);
    delBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    delBtn.addEventListener('click', (e) => deleteDoc(e, doc.name));
    li.appendChild(delBtn);
  } else if (isActive) {
    const badge = document.createElement('span');
    badge.className = 'context-active-badge';
    badge.textContent = 'Active';
    li.appendChild(badge);
  }

  return li;
}

function renderDocList() {
  if (DOM.btnClearDocs) {
    DOM.btnClearDocs.style.display = uploadedDocs.length > 0 ? 'inline-flex' : 'none';
  }

  // 1. Sidebar Document List
  if (DOM.docList) {
    if (uploadedDocs.length === 0) {
      DOM.docList.innerHTML = `<li class="empty-state">No documents uploaded.</li>`;
    } else {
      DOM.docList.innerHTML = '';
      uploadedDocs.forEach(doc => {
        DOM.docList.appendChild(createDocItem(doc, false));
      });
    }
  }

  // 2. Center Stage Context Dropdown
  if (DOM.contextDropdownList) {
    DOM.contextDropdownList.innerHTML = '';

    const allLi = document.createElement('li');
    const isAllActive = activeDocId === null;
    allLi.className = `doc-item context-option-all ${isAllActive ? 'active' : ''}`;
    allLi.addEventListener('click', () => selectDoc(null));
    allLi.innerHTML = `
      <div class="doc-icon all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <div class="doc-info">
        <div class="doc-title">Everything (All Documents)</div>
        <div class="doc-meta"><span>Search across all ${uploadedDocs.length} indexed files</span></div>
      </div>
      ${isAllActive ? '<span class="context-active-badge">Active</span>' : ''}
    `;
    DOM.contextDropdownList.appendChild(allLi);

    if (uploadedDocs.length > 0) {
      uploadedDocs.forEach(doc => {
        DOM.contextDropdownList.appendChild(createDocItem(doc, true));
      });
    }
  }

  // 3. Update Context Display
  const activeDoc = activeDocId ? uploadedDocs.find(d => d.id === activeDocId) : null;
  if (!activeDoc) {
    DOM.activeContextName.textContent = uploadedDocs.length > 0 ? 'Everything' : 'No documents';
    DOM.contextCount.textContent = `${uploadedDocs.length} document${uploadedDocs.length === 1 ? '' : 's'} in context`;
  } else {
    DOM.activeContextName.textContent = activeDoc.name;
    DOM.contextCount.textContent = '1 document focused (click to change)';
  }

  // 4. Re-apply search filter
  if (DOM.docSearch && DOM.docSearch.value) {
    DOM.docSearch.dispatchEvent(new Event('input'));
  }
}

async function loadDocuments() {
  // 1. Instant load from local IndexedDB (zero flash)
  if (window.pistonDB) {
    try {
      const localDocs = await window.pistonDB.getAllDocuments();
      if (localDocs && localDocs.length > 0) {
        uploadedDocs = localDocs;
        const savedActive = await window.pistonDB.getSetting('activeDocId');
        if (savedActive && uploadedDocs.some(d => d.id === savedActive)) {
          activeDocId = savedActive;
        }
        renderDocList();
      }
    } catch (err) {
      console.warn('Could not read documents from IndexedDB', err);
    }
  }

  // 2. Authoritative sync with backend
  try {
    const res = await fetch('/documents');
    if (res.ok) {
      const data = await res.json();
      uploadedDocs = data;

      if (window.pistonDB) {
        await window.pistonDB.setAllDocuments(uploadedDocs);
        const savedActive = await window.pistonDB.getSetting('activeDocId');
        if (savedActive && uploadedDocs.some(d => d.id === savedActive)) {
          activeDocId = savedActive;
        } else if (activeDocId && !uploadedDocs.some(d => d.id === activeDocId)) {
          activeDocId = null;
          await window.pistonDB.deleteSetting('activeDocId');
        }
      }

      renderDocList();
      syncContextToBackend();
    }
  } catch (err) {
    console.error('Failed to load documents from backend', err);
  }
}

async function selectDoc(id) {
  activeDocId = id;
  if (window.pistonDB) {
    if (id) {
      await window.pistonDB.setSetting('activeDocId', id);
    } else {
      await window.pistonDB.deleteSetting('activeDocId');
    }
  }
  
  if (id) {
    const doc = uploadedDocs.find(d => d.id === id);
    showToast(`Context focused: ${doc ? doc.name : 'Document'}`, 'info');
  } else {
    showToast('Context: Everything (All Documents)', 'info');
  }
  
  renderDocList();
  syncContextToBackend();
  if (DOM.contextDropdown && DOM.contextDropdown.classList.contains('open')) {
    DOM.contextDropdown.classList.remove('open');
  }
}

async function deleteDoc(e, docName) {
  if (e) e.stopPropagation();
  if (!confirm(`Are you sure you want to remove "${docName}" from the knowledge base?`)) {
    return;
  }
  try {
    const res = await fetch(`/documents/${encodeURIComponent(docName)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove document');

    uploadedDocs = uploadedDocs.filter(d => d.name !== docName);
    if (window.pistonDB) {
      await window.pistonDB.deleteDocument(docName);
    }

    const activeDoc = uploadedDocs.find(d => d.id === activeDocId);
    if (!activeDoc) {
      activeDocId = null;
      if (window.pistonDB) {
        await window.pistonDB.deleteSetting('activeDocId');
      }
    }

    renderDocList();
    syncContextToBackend();
    showToast(`Removed "${docName}"`, 'info');
  } catch (err) {
    alert(`Could not remove document: ${err.message}`);
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function clearAllDocs() {
  if (!uploadedDocs.length) return;
  if (!confirm("Are you sure you want to remove ALL documents from the knowledge base? This action cannot be undone.")) {
    return;
  }
  try {
    const res = await fetch('/documents', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear documents');

    uploadedDocs = [];
    activeDocId = null;
    if (window.pistonDB) {
      await window.pistonDB.clearDocuments();
      await window.pistonDB.deleteSetting('activeDocId');
    }

    renderDocList();
    syncContextToBackend();
    showToast("All documents removed", 'info');
  } catch (err) {
    alert(`Could not clear documents: ${err.message}`);
    showToast(`Error: ${err.message}`, 'error');
  }
}

if (DOM.btnClearDocs) {
  DOM.btnClearDocs.addEventListener('click', clearAllDocs);
}

DOM.uploadInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || !files.length) return;
  
  for (const file of files) {
    const docId = `doc-${file.name}`;
    const newDoc = {
      id: docId,
      name: file.name,
      size: file.size,
      chunks_count: 0,
      parsed: false
    };
    
    uploadedDocs = uploadedDocs.filter(d => d.name !== file.name);
    uploadedDocs.push(newDoc);
    renderDocList();
    
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/upload', { method: 'POST', body: formData });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        throw new Error(res.status >= 500 ? 'Server error occurred during upload.' : 'Invalid response from server.');
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      newDoc.parsed = true;
      if (data.doc && data.doc.chunks_count) {
        newDoc.chunks_count = data.doc.chunks_count;
      }
      if (window.pistonDB) {
        await window.pistonDB.putDocument(newDoc);
      }
      showToast(`"${file.name}" indexed successfully!`, 'success');
    } catch (err) {
      alert(`Error uploading ${file.name}: ${err.message}`);
      uploadedDocs = uploadedDocs.filter(d => d.name !== file.name);
      if (window.pistonDB) {
        await window.pistonDB.deleteDocument(file.name);
      }
      showToast(`Failed to upload "${file.name}"`, 'error');
    }
    renderDocList();
    syncContextToBackend();
  }
  DOM.uploadInput.value = '';
});

// --- Document Search Filter ---
if (DOM.docSearch) {
  DOM.docSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    const filterList = (targetList) => {
      if (!targetList) return;
      Array.from(targetList.querySelectorAll('.doc-item')).forEach(item => {
        if (item.classList.contains('context-option-all')) return;
        const titleNode = item.querySelector('.doc-title');
        if (titleNode) {
          const title = titleNode.textContent.toLowerCase();
          item.style.display = title.includes(query) ? '' : 'none';
        }
      });
    };
    
    filterList(DOM.docList);
    filterList(DOM.contextDropdownList);
  });
}

// --- Transcript Management with IndexedDB ---

async function saveTranscript() {
  if (!window.pistonDB) return;
  const messages = [];
  DOM.transcript.querySelectorAll('.msg').forEach(msgNode => {
    const isUser = msgNode.classList.contains('user');
    const textNode = msgNode.querySelector('.msg-text');
    const timeNode = msgNode.querySelector('.msg-time');
    if (textNode && timeNode) {
      messages.push({
        role: isUser ? 'user' : 'agent',
        text: textNode.textContent,
        time: timeNode.textContent,
        timestamp: Date.now()
      });
    }
  });
  
  try {
    await window.pistonDB.clearTranscripts();
    for (const msg of messages) {
      await window.pistonDB.addTranscriptMessage(msg);
    }
  } catch (err) {
    console.warn('Could not persist transcript to IndexedDB', err);
  }
}

async function loadTranscript() {
  if (!window.pistonDB) return;
  try {
    const messages = await window.pistonDB.getTranscripts();
    if (messages && messages.length > 0) {
      const empty = DOM.transcript.querySelector('.empty-transcript');
      if (empty) empty.remove();
      
      messages.forEach(m => {
        const div = document.createElement('div');
        div.className = `msg ${m.role}`;
        div.innerHTML = `
          <div class="msg-avatar">${m.role === 'user' ? 'Y' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v4M8 8v12M12 4v20M16 8v12M20 12v4"/></svg>'}</div>
          <div class="msg-content">
            <div class="msg-header">
              <span class="msg-author">${m.role === 'user' ? 'You' : 'Piston'}</span>
              <span class="msg-time">${m.time}</span>
            </div>
            <div class="msg-text">${m.text}</div>
          </div>
        `;
        DOM.transcript.appendChild(div);
      });
      DOM.transcript.scrollTop = DOM.transcript.scrollHeight;
    }
  } catch (e) {
    console.error('Failed to parse transcript from IndexedDB', e);
  }
}

function formatTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addBubble(role) {
  const empty = DOM.transcript.querySelector('.empty-transcript');
  if (empty) empty.remove();
  
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? 'Y' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v4M8 8v12M12 4v20M16 8v12M20 12v4"/></svg>'}</div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${role === 'user' ? 'You' : 'Piston'}</span>
        <span class="msg-time">${formatTime()}</span>
      </div>
      <div class="msg-text interim"></div>
    </div>
  `;
  DOM.transcript.appendChild(div);
  DOM.transcript.scrollTop = DOM.transcript.scrollHeight;
  return div.querySelector('.msg-text');
}

function onTranscript(role, text, isFinal) {
  if (!currentBubble[role]) {
    currentBubble[role] = addBubble(role);
    currentBubble[role].textContent = text;
  } else {
    currentBubble[role].textContent += text;
  }
  
  if (isFinal) {
    currentBubble[role].classList.remove('interim');
    currentBubble[role] = null;
    saveTranscript();
  }
  
  const isScrolledToBottom = DOM.transcript.scrollHeight - DOM.transcript.clientHeight <= DOM.transcript.scrollTop + 50;
  if (isScrolledToBottom) {
    DOM.transcript.scrollTop = DOM.transcript.scrollHeight;
  }
}

function onToolEvent(ev) {
  if (ev.status === 'running') {
    setState('searching', 'Searching...', 'Connecting to knowledge base');
    
    const chip = document.createElement('div');
    chip.className = 'trace-chip';
    chip.id = 'pending-tool';
    chip.innerHTML = `
      <div class="trace-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Searching context...</div>
      <div class="trace-body">${ev.detail || 'Extracting relevant passages'}</div>
    `;
    DOM.transcript.appendChild(chip);
  } else {
    const pending = document.getElementById('pending-tool');
    if (pending) {
      pending.removeAttribute('id');
      const sourcesCount = ev.sources ? ev.sources.length : 0;
      pending.innerHTML = `
        <div class="trace-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Searched context • ${sourcesCount} relevant passages</div>
        <div class="trace-body">"${ev.detail}"</div>
      `;
    }
  }
  DOM.transcript.scrollTop = DOM.transcript.scrollHeight;
}

// --- Audio Playback & Voice Streaming ---

function flushPlayback() {
  liveSources.forEach(s => { try { s.stop(); } catch (_) {} });
  liveSources.clear();
  nextPlayTime = 0;
}

function playPcm24k(bytes) {
  if (isInterrupting) return;
  if (!bytes || bytes.byteLength < 2) return;

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (appState !== 'speaking') {
    const activeDoc = activeDocId ? uploadedDocs.find(d => d.id === activeDocId) : null;
    setState('speaking', 'Piston is speaking', `Answering from ${activeDoc ? activeDoc.name : 'knowledge base'}`);
    stopInactivityTimer();
  }
  
  const safeLength = bytes.byteLength - (bytes.byteLength % 2);
  const pcm = new Int16Array(bytes.slice ? bytes.slice(0, safeLength) : bytes);
  if (pcm.length === 0) return;

  const f32 = new Float32Array(pcm.length);
  let sumSquare = 0;
  for (let i = 0; i < pcm.length; i++) {
    const val = pcm[i] / 32768;
    f32[i] = val;
    sumSquare += val * val;
  }
  
  if (aiAnalyzer) {
    aiAnalyzer.rms = Math.sqrt(sumSquare / pcm.length);
  }

  const buf = audioCtx.createBuffer(1, f32.length, 24000);
  buf.getChannelData(0).set(f32);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  if (nextPlayTime < now) {
    nextPlayTime = now + 0.04;
  }
  src.start(nextPlayTime);
  nextPlayTime += buf.duration;
  liveSources.add(src);
  
  src.onended = () => {
    liveSources.delete(src);
    if (liveSources.size === 0) {
      nextPlayTime = 0;
      setTimeout(() => {
        if (liveSources.size === 0 && appState === 'speaking' && !isInterrupting) {
          setState('listening', 'Listening...', 'Capturing your voice');
          resetInactivityTimer();
        }
      }, 350);
    }
  };
}

async function startSession() {
  if (ws) return;
  isIntentionalClose = false;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.binaryType = 'arraybuffer';

  ws.onopen = async () => {
    setState('idle', 'Connecting...', 'Initializing microphone');
    syncContextToBackend();

    try {
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        audioCtx = new AudioContext();
        await audioCtx.audioWorklet.addModule('/static/pcm-worklet.js?v=2.0.0');
        const source = audioCtx.createMediaStreamSource(mediaStream);
        workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture');
        
        micAnalyzer = { rms: 0 };
        aiAnalyzer = { rms: 0 };
        
        workletNode.port.onmessage = (e) => {
          const pcm = new Int16Array(e.data);
          let sum = 0;
          for (let i = 0; i < pcm.length; i += 10) { 
            const val = pcm[i] / 32768;
            sum += val * val; 
          }
          micAnalyzer.rms = Math.sqrt(sum / (pcm.length / 10));
          
          if (micAnalyzer.rms > 0.03) {
            resetInactivityTimer();
          }

          // Half-duplex acoustic gating: only stream mic when Piston is in 'listening' state!
          if (!isMuted && appState === 'listening' && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };
        source.connect(workletNode);
        startAnimationLoop();
      }
      
      setState('listening', 'Listening...', 'Capturing your voice');
      resetInactivityTimer();
    } catch (err) {
      setState('error', 'Microphone Error', err.message);
      stopSession(true);
    }
  };

  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return playPcm24k(e.data);
    const msg = JSON.parse(e.data);
    switch (msg.type) {
      case 'status': 
        if (msg.status === 'ready' && appState === 'idle') {
          setState('listening', 'Listening...', 'Capturing your voice');
          resetInactivityTimer();
        }
        break;
      case 'transcript': 
        onTranscript(msg.role, msg.text, false); 
        break;
      case 'turn_complete': 
        isInterrupting = false;
        if (currentBubble.user) currentBubble.user.classList.remove('interim');
        if (currentBubble.agent) currentBubble.agent.classList.remove('interim');
        currentBubble = { user: null, agent: null }; 
        if (appState === 'speaking' && liveSources.size === 0) {
          setState('listening', 'Listening...', 'Capturing your voice');
          resetInactivityTimer();
        }
        saveTranscript();
        break;
      case 'tool': onToolEvent(msg); break;
      case 'interrupted': 
        isInterrupting = false;
        flushPlayback(); 
        currentBubble = { user: null, agent: null }; 
        setState('listening', 'Listening...', 'Capturing your voice');
        resetInactivityTimer();
        break;
      case 'end_session':
        stopSession(false, 'Session ended', 'Session closed by voice command');
        break;
      case 'error': 
        setState('error', 'Session Error', msg.message);
        stopSession(true); 
        break;
    }
  };

  ws.onclose = () => {
    if (!isIntentionalClose && appState !== 'error') {
      ws = null;
      setState('idle', 'Reconnecting...', 'Restoring session');
      setTimeout(() => startSession(), 1000);
    } else {
      stopSession(false, 'Session ended', 'Tap the orb to restart');
    }
  };
}

function stopSession(isError = false, title = 'Ready to start', subtitle = 'Tap the orb or select a document') {
  isIntentionalClose = true;
  stopInactivityTimer();
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  if (workletNode) { workletNode.disconnect(); workletNode = null; }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  flushPlayback();
  
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
  
  if (!isError) setState('idle', title, subtitle);
  currentBubble = { user: null, agent: null };
}

// Animation Loop for Waveform / Orb
function startAnimationLoop() {
  const miniBars = document.querySelectorAll('.mini-waveform .bar');
  
  function render() {
    let currentLevel = 0;
    
    if (appState === 'listening' && micAnalyzer) {
      currentLevel = micAnalyzer.rms;
      miniBars.forEach(b => b.style.height = `${Math.max(4, currentLevel * 40)}px`);
      micAnalyzer.rms *= 0.85;
    } else if (appState === 'speaking' && aiAnalyzer) {
      currentLevel = aiAnalyzer.rms;
      miniBars.forEach(b => b.style.height = `${Math.max(4, currentLevel * 35)}px`);
      aiAnalyzer.rms *= 0.90;
    } else {
      miniBars.forEach(b => b.style.height = '4px');
    }
    
    if (orbVisualizer) {
      orbVisualizer.setAudioLevel(currentLevel);
    }
    
    animationFrameId = requestAnimationFrame(render);
  }
  render();
}

// User Controls
DOM.orb.addEventListener('click', () => {
  if (appState === 'idle' || appState === 'error') {
    startSession();
  } else if (appState === 'speaking') {
    isInterrupting = true;
    flushPlayback();
    setState('listening', 'Listening...', 'Capturing your voice');
    resetInactivityTimer();
    if (orbVisualizer && orbVisualizer.triggerInterruptRipple) {
      orbVisualizer.triggerInterruptRipple();
    }
  }
});

DOM.btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  DOM.btnMute.classList.toggle('active', isMuted);
  DOM.btnMute.querySelector('span').textContent = isMuted ? 'Unmute' : 'Mute';
  const svg = DOM.btnMute.querySelector('svg');
  if (isMuted) {
    svg.innerHTML = '<path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
    svg.style.color = 'var(--danger)';
  } else {
    svg.innerHTML = '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
    svg.style.color = 'inherit';
  }
});

DOM.btnInterrupt.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    isInterrupting = true;
    flushPlayback();
    setState('listening', 'Listening...', 'Capturing your voice');
    resetInactivityTimer();
    if (orbVisualizer && orbVisualizer.triggerInterruptRipple) {
      orbVisualizer.triggerInterruptRipple();
    }
  }
});

DOM.btnEnd.addEventListener('click', () => {
  stopSession(false, 'Session ended', 'Tap the orb to restart');
});

// Clear transcript
const transcriptHeader = document.querySelector('.right-panel .panel-header h2');
if (transcriptHeader) {
  transcriptHeader.style.cursor = 'pointer';
  transcriptHeader.title = 'Double click to clear chat history';
  transcriptHeader.addEventListener('dblclick', async () => {
    if (window.pistonDB) {
      await window.pistonDB.clearTranscripts();
    }
    DOM.transcript.innerHTML = '<div class="empty-transcript">Start speaking to see transcript</div>';
  });
}

if (DOM.btnMenuMobile && DOM.leftPanel) {
  DOM.btnMenuMobile.addEventListener('click', () => {
    DOM.leftPanel.classList.toggle('open');
    if (DOM.rightPanel) DOM.rightPanel.classList.remove('open');
  });
}

// --- Dual Sidebar Collapse Management ---
function setLeftPanelCollapsed(collapsed) {
  if (!DOM.leftPanel) return;
  DOM.leftPanel.classList.toggle('collapsed', collapsed);
  if (DOM.btnUncollapseLeft) {
    DOM.btnUncollapseLeft.classList.toggle('visible', collapsed);
  }
  localStorage.setItem('piston_left_collapsed', collapsed ? 'true' : 'false');
}

function setRightPanelCollapsed(collapsed) {
  if (!DOM.rightPanel) return;
  DOM.rightPanel.classList.toggle('collapsed', collapsed);
  if (DOM.btnUncollapseRight) {
    DOM.btnUncollapseRight.classList.toggle('visible', collapsed);
  }
  localStorage.setItem('piston_right_collapsed', collapsed ? 'true' : 'false');
}

function initSidebars() {
  if (window.innerWidth > 1024) {
    const leftCollapsed = localStorage.getItem('piston_left_collapsed') === 'true';
    const rightCollapsed = localStorage.getItem('piston_right_collapsed') === 'true';
    if (leftCollapsed) setLeftPanelCollapsed(true);
    if (rightCollapsed) setRightPanelCollapsed(true);
  }
}

if (DOM.btnMenuDesktop) {
  DOM.btnMenuDesktop.addEventListener('click', () => setLeftPanelCollapsed(true));
}
if (DOM.btnUncollapseLeft) {
  DOM.btnUncollapseLeft.addEventListener('click', () => setLeftPanelCollapsed(false));
}

if (DOM.btnCollapseRight) {
  DOM.btnCollapseRight.addEventListener('click', () => setRightPanelCollapsed(true));
}
if (DOM.btnUncollapseRight) {
  DOM.btnUncollapseRight.addEventListener('click', () => setRightPanelCollapsed(false));
}

// Global Keyboard Shortcuts (Cmd/Ctrl + [ for left, Cmd/Ctrl + ] for right)
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? e.metaKey : e.ctrlKey;
  if (!modifier) return;
  
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === '[' || e.keyCode === 219) {
    e.preventDefault();
    const isCurrentlyCollapsed = DOM.leftPanel && DOM.leftPanel.classList.contains('collapsed');
    setLeftPanelCollapsed(!isCurrentlyCollapsed);
  } else if (e.key === ']' || e.keyCode === 221) {
    e.preventDefault();
    const isCurrentlyCollapsed = DOM.rightPanel && DOM.rightPanel.classList.contains('collapsed');
    setRightPanelCollapsed(!isCurrentlyCollapsed);
  }
});

if (DOM.btnTranscript && DOM.rightPanel) {
  DOM.btnTranscript.addEventListener('click', () => {
    DOM.rightPanel.classList.toggle('open');
    if (DOM.leftPanel) DOM.leftPanel.classList.remove('open');
  });
}

// Dropdown Logic
function toggleDropdown(e) {
  if (DOM.contextDropdown) {
    e.stopPropagation();
    
    if (!DOM.contextDropdown.classList.contains('open')) {
      const btnRect = (DOM.btnContext || DOM.btnContextCount).getBoundingClientRect();
      const spaceBelow = window.innerHeight - btnRect.bottom;
      
      if (spaceBelow < 320) {
        DOM.contextDropdown.style.top = 'auto';
        DOM.contextDropdown.style.bottom = 'calc(100% + 8px)';
        DOM.contextDropdown.style.transformOrigin = 'bottom center';
      } else {
        DOM.contextDropdown.style.bottom = 'auto';
        DOM.contextDropdown.style.top = 'calc(100% + 8px)';
        DOM.contextDropdown.style.transformOrigin = 'top center';
      }
    }
    
    DOM.contextDropdown.classList.toggle('open');
  }
}
if (DOM.btnContext) DOM.btnContext.addEventListener('click', toggleDropdown);
if (DOM.btnContextCount) DOM.btnContextCount.addEventListener('click', toggleDropdown);

document.addEventListener('click', (e) => {
  if (DOM.contextDropdown && DOM.contextDropdown.classList.contains('open')) {
    if (!DOM.contextDropdown.contains(e.target)) {
      DOM.contextDropdown.classList.remove('open');
    }
  }
});

// App Startup
loadTranscript();
loadDocuments();
initSidebars();
