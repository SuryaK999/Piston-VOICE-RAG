/* Piston Frontend Logic */

const DOM = {
  uploadInput: document.getElementById('doc-upload'),
  docList: document.getElementById('doc-list'),
  stageTitle: document.getElementById('stage-title'),
  stageSubtitle: document.getElementById('stage-subtitle'),
  orb: document.getElementById('orb'),
  activeContextName: document.getElementById('active-context-name'),
  contextCount: document.getElementById('context-count'),
  btnMute: document.getElementById('btn-mute'),
  btnInterrupt: document.getElementById('btn-interrupt'),
  btnEnd: document.getElementById('btn-end'),
  transcript: document.getElementById('transcript'),
  liveIndicator: document.querySelector('.live-indicator'),
  btnMenuMobile: document.getElementById('btn-menu-mobile'),
  btnMenuDesktop: document.getElementById('btn-menu-desktop'),
  btnUncollapse: document.getElementById('btn-uncollapse'),
  btnTranscript: document.getElementById('btn-transcript'),
  leftPanel: document.querySelector('.left-panel'),
  rightPanel: document.querySelector('.right-panel'),
  btnContext: document.getElementById('btn-context'),
  btnContextCount: document.getElementById('btn-context-count'),
  contextDropdown: document.getElementById('context-dropdown'),
  contextDropdownList: document.getElementById('context-dropdown-list'),
  docSearch: document.getElementById('doc-search'),
  btnThemeToggle: document.getElementById('btn-theme-toggle')
};

let uploadedDocs = [];
let activeDocId = null;

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('piston_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  
  if (isDark) {
    document.body.classList.add('dark-mode');
    updateThemeIcons(true);
  } else {
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
  DOM.btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('piston_theme', isDark ? 'dark' : 'light');
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
  }, 600000); // 10 minutes of complete inactivity
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

function playEndSound() {
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
}

function setState(newState, message, subtitle) {
  appState = newState;
  
  DOM.orb.className = `orb state-${newState}`;
  
  if (message) DOM.stageTitle.textContent = message;
  if (subtitle !== undefined) DOM.stageSubtitle.textContent = subtitle;
  
  DOM.liveIndicator.classList.toggle('active', ['listening', 'searching', 'speaking'].includes(newState));
  
  if (newState === 'idle' || newState === 'error') {
    DOM.btnMute.disabled = true;
    DOM.btnInterrupt.disabled = true;
    DOM.btnEnd.disabled = true;
  } else {
    DOM.btnMute.disabled = false;
    DOM.btnInterrupt.disabled = false;
    DOM.btnEnd.disabled = false;
  }
}

// --- Document Management ---

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getIconType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md') return 'md';
  return 'txt';
}

function renderDocList() {
  const renderTarget = (target) => {
    if (uploadedDocs.length === 0) {
      target.innerHTML = `<li class="empty-state">No documents uploaded.</li>`;
      return;
    }
    
    target.innerHTML = '';
    uploadedDocs.forEach(doc => {
      const li = document.createElement('li');
      li.className = `doc-item ${doc.id === activeDocId ? 'active' : ''}`;
      li.onclick = () => selectDoc(doc.id);
      
      const iconType = getIconType(doc.name);
      
      li.innerHTML = `
        <div class="doc-icon ${iconType}">${iconType.toUpperCase()}</div>
        <div class="doc-info">
          <div class="doc-title" title="${doc.name}">${doc.name}</div>
          <div class="doc-meta">
            <span>${iconType.toUpperCase()} • ${formatSize(doc.size)}</span>
            ${doc.parsed ? `<span class="doc-status"><span class="status-dot"></span>Indexed</span>` : `<span class="doc-status" style="color:#f59e0b">Uploading...</span>`}
          </div>
        </div>
        <button class="doc-menu" aria-label="Document options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      `;
      target.appendChild(li);
    });
  };

  renderTarget(DOM.docList);
  if (DOM.contextDropdownList) renderTarget(DOM.contextDropdownList);
  
  if (uploadedDocs.length === 0) {
    DOM.activeContextName.textContent = 'No document selected';
    DOM.contextCount.textContent = '0 documents in context';
  } else {
    const activeDoc = uploadedDocs.find(d => d.id === activeDocId);
    if (activeDoc) {
      DOM.activeContextName.textContent = activeDoc.name;
      DOM.contextCount.textContent = `${uploadedDocs.length} document${uploadedDocs.length > 1 ? 's' : ''} in context`;
    }
  }
  
  // Re-apply search filter if there's text in the search box
  if (DOM.docSearch && DOM.docSearch.value) {
    DOM.docSearch.dispatchEvent(new Event('input'));
  }
}

function selectDoc(id) {
  activeDocId = id;
  renderDocList();
}

DOM.uploadInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || !files.length) return;
  
  for (const file of files) {
    const docId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newDoc = { id: docId, name: file.name, size: file.size, parsed: false };
    uploadedDocs.push(newDoc);
    if (!activeDocId) activeDocId = docId;
    renderDocList();
    
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/upload', { method: 'POST', body: formData });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(res.status >= 500 ? 'Server error occurred during upload.' : 'Invalid response from server.');
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      newDoc.parsed = true;
    } catch (err) {
      alert(`Error uploading ${file.name}: ${err.message}`);
      uploadedDocs = uploadedDocs.filter(d => d.id !== docId);
      if (activeDocId === docId) activeDocId = uploadedDocs.length ? uploadedDocs[0].id : null;
    }
    renderDocList();
  }
});

// --- Document Search Filter ---
if (DOM.docSearch) {
  DOM.docSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    const filterList = (targetList) => {
      if (!targetList) return;
      Array.from(targetList.querySelectorAll('.doc-item')).forEach(item => {
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

// --- Transcript Management ---

function saveTranscript() {
  const messages = [];
  DOM.transcript.querySelectorAll('.msg').forEach(msgNode => {
    const isUser = msgNode.classList.contains('user');
    const text = msgNode.querySelector('.msg-text').textContent;
    const time = msgNode.querySelector('.msg-time').textContent;
    messages.push({ role: isUser ? 'user' : 'agent', text, time });
  });
  localStorage.setItem('piston_transcript', JSON.stringify(messages));
}

function loadTranscript() {
  const saved = localStorage.getItem('piston_transcript');
  if (saved) {
    try {
      const messages = JSON.parse(saved);
      if (messages.length > 0) {
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
      console.error('Failed to parse transcript', e);
    }
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
    // When tool search finishes, do NOT prematurely switch to 'listening'.
    // The agent will transition to 'speaking' as soon as Gemini begins delivering the answer.
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

// --- Audio & Connection ---

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
    setState('speaking', 'Piston is speaking', `Answering from ${activeDocId ? uploadedDocs.find(d=>d.id===activeDocId).name : 'knowledge base'}`);
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
  
  // update AI audio amplitude
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

          // CRITICAL: Only send mic audio when Piston is in 'listening' mode!
          // Streaming mic audio during 'speaking' or 'searching' sends speaker output
          // right back into Gemini Live, causing Gemini's server-side VAD to falsely detect
          // an interruption and abruptly cut off speech mid-sentence.
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
        if(msg.status === 'ready' && appState === 'idle') {
          setState('listening', 'Listening...', 'Capturing your voice');
          resetInactivityTimer();
        }
        break;
      case 'transcript': 
        // We consider it final if turn_complete happens, but interim otherwise. 
        // For simplicity, we just append to the bubble.
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
  const waves = document.querySelectorAll('.orb-wave');
  const miniBars = document.querySelectorAll('.mini-waveform .bar');
  
  function render() {
    if (appState === 'listening' && micAnalyzer) {
      const scale = 1 + (micAnalyzer.rms * 5);
      waves.forEach((w, i) => {
        w.style.transform = `translate(-50%, -50%) scale(${scale + (i*0.2)})`;
        w.style.opacity = Math.max(0, 0.5 - (micAnalyzer.rms * 2));
      });
      miniBars.forEach(b => b.style.height = `${Math.max(4, micAnalyzer.rms * 40)}px`);
      if (DOM.orbCore) DOM.orbCore.style.transform = `scale(${1 + micAnalyzer.rms * 0.5})`;
    } else if (appState === 'speaking' && aiAnalyzer) {
      const scale = 1 + (aiAnalyzer.rms * 3);
      waves.forEach((w, i) => {
        w.style.transform = `translate(-50%, -50%) scale(${scale + (i*0.3)})`;
        w.style.opacity = Math.max(0, 0.6 - (aiAnalyzer.rms * 1.5));
      });
      miniBars.forEach(b => b.style.height = `${Math.max(4, aiAnalyzer.rms * 30)}px`);
      if (DOM.orbCore) DOM.orbCore.style.transform = `scale(${1 + aiAnalyzer.rms * 0.4})`;
      aiAnalyzer.rms *= 0.9; // decay
    } else {
      waves.forEach((w) => {
        w.style.transform = `translate(-50%, -50%) scale(1)`;
        w.style.opacity = 0;
      });
      miniBars.forEach(b => b.style.height = '4px');
      if (DOM.orbCore) DOM.orbCore.style.transform = `scale(1)`;
    }
    
    if (micAnalyzer) micAnalyzer.rms *= 0.8; // decay
    
    animationFrameId = requestAnimationFrame(render);
  }
  render();
}

// Controls
DOM.orb.addEventListener('click', () => {
  if (appState === 'idle' || appState === 'error') {
    startSession();
  } else if (appState === 'speaking') {
    isInterrupting = true;
    flushPlayback();
    setState('listening', 'Listening...', 'Capturing your voice');
    resetInactivityTimer();
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
  transcriptHeader.addEventListener('dblclick', () => {
    localStorage.removeItem('piston_transcript');
    DOM.transcript.innerHTML = '<div class="empty-transcript">Start speaking to see transcript</div>';
  });
}

if (DOM.btnMenuMobile && DOM.leftPanel) {
  DOM.btnMenuMobile.addEventListener('click', () => {
    DOM.leftPanel.classList.toggle('open');
    if (DOM.rightPanel) DOM.rightPanel.classList.remove('open');
  });
}

if (DOM.btnMenuDesktop && DOM.leftPanel) {
  DOM.btnMenuDesktop.addEventListener('click', () => {
    DOM.leftPanel.classList.add('collapsed');
    if (DOM.btnUncollapse) {
      DOM.btnUncollapse.style.opacity = '1';
      DOM.btnUncollapse.style.pointerEvents = 'auto';
    }
  });
}

if (DOM.btnUncollapse && DOM.leftPanel) {
  DOM.btnUncollapse.addEventListener('click', () => {
    DOM.leftPanel.classList.remove('collapsed');
    DOM.btnUncollapse.style.opacity = '0';
    DOM.btnUncollapse.style.pointerEvents = 'none';
  });
}

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
    
    // Dynamic Positioning based on available space
    if (!DOM.contextDropdown.classList.contains('open')) {
      const btnRect = (DOM.btnContext || DOM.btnContextCount).getBoundingClientRect();
      const spaceBelow = window.innerHeight - btnRect.bottom;
      
      // If there's less than 320px below (max dropdown height + padding), pop UP
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

// Init
loadTranscript();
renderDocList();
