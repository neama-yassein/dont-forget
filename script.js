// ===== STATE =====
let tasks = JSON.parse(localStorage.getItem('dfTasks_v2') || '[]');
let selectedPriority = 'important';
let selectedCat = 'work';
let selectedRepeat = 'once';
let currentTab = 'all';
let activeAlerts = new Set();

// ===== INIT =====
window.onload = () => {
  setDefaults();
  checkNotifPerm();
  renderAll();
  startChecker();
  setInterval(renderAll, 30000); // refresh countdown every 30s
};

function setDefaults() {
  const now = new Date();
  document.getElementById('taskDate').value = now.toISOString().split('T')[0];
  document.getElementById('taskTime').value =
    String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}

// ===== CHIP SELECTORS =====
document.getElementById('priorityRow').addEventListener('click', e => {
  const btn = e.target.closest('[data-priority]');
  if (!btn) return;
  document.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPriority = btn.dataset.priority;
});

document.getElementById('catRow').addEventListener('click', e => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedCat = btn.dataset.cat;
});

document.getElementById('repeatRow').addEventListener('click', e => {
  const btn = e.target.closest('[data-repeat]');
  if (!btn) return;
  document.querySelectorAll('[data-repeat]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRepeat = btn.dataset.repeat;
});

// ===== ADD TASK =====
function addTask() {
  const name = document.getElementById('taskName').value.trim();
  const date = document.getElementById('taskDate').value;
  const time = document.getElementById('taskTime').value;
  const note = document.getElementById('taskNote').value.trim();

  if (!name) { showToast('⚠ اكتب اسم التاسك!'); return; }
  if (!date || !time) { showToast('⚠ حدد التاريخ والوقت!'); return; }

  const task = {
    id: Date.now(),
    name, date, time, note,
    priority: selectedPriority,
    cat: selectedCat,
    repeat: selectedRepeat,
    done: false,
    doneDate: null,
    nextAlert: `${date}T${time}`,
    createdAt: new Date().toISOString()
  };

  tasks.unshift(task);
  save();
  renderAll();
  clearForm();
  showToast('✓ اتضاف التاسك!');
}

function clearForm() {
  document.getElementById('taskName').value = '';
  document.getElementById('taskNote').value = '';
  setDefaults();
}

// ===== RENDER =====
function renderAll() {
  renderTasks();
  renderStats();
}

function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('statTotal').textContent = tasks.length;
  document.getElementById('statPending').textContent = tasks.filter(t => !t.done).length;
  document.getElementById('statUrgent').textContent = tasks.filter(t => !t.done && t.priority === 'urgent').length;
  document.getElementById('statDone').textContent = tasks.filter(t => t.done && t.doneDate === today).length;
  document.getElementById('taskCount').textContent = tasks.filter(t => !t.done).length;
}

function renderTasks() {
  const list = document.getElementById('taskList');
  let filtered = [...tasks];

  if (currentTab === 'urgent') filtered = tasks.filter(t => !t.done && t.priority === 'urgent');
  else if (currentTab === 'pending') filtered = tasks.filter(t => !t.done);
  else if (currentTab === 'done') filtered = tasks.filter(t => t.done);

  if (filtered.length === 0) {
    const msgs = {
      all: ['🤖', 'NO TASKS FOUND'],
      urgent: ['✅', 'مفيش حاجة عاجلة!'],
      pending: ['😴', 'مفيش تاسكات جاية'],
      done: ['🎮', 'مفيش تاسكات خلصت لسه']
    };
    const [icon, msg] = msgs[currentTab] || msgs.all;
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-text">${msg}</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(task => {
    const cd = getCountdown(task);
    const priLabel = { urgent: 'عاجل', important: 'مهم', normal: 'عادي' }[task.priority];
    const catLabel = { work: '💼 شغل', study: '📚 دراسة', personal: '🙋 شخصي', other: '📌 غيره' }[task.cat] || '';
    return `
    <div class="task-item ${task.done ? 'done' : task.priority}" id="t-${task.id}">
      <button class="task-check" onclick="toggleDone(${task.id})">${task.done ? '✓' : ''}</button>
      <div class="task-info">
        <div class="task-top">
          <span class="task-name">${task.name}</span>
          <span class="task-priority-badge badge-${task.priority}">${priLabel}</span>
          <span class="task-cat-badge">${catLabel}</span>
        </div>
        <div class="task-meta">
          <span>📅 ${fmtDate(task.date)}</span>
          <span>🕐 ${task.time}</span>
          ${task.repeat !== 'once' ? `<span>🔁 ${repeatLabel(task.repeat)}</span>` : ''}
        </div>
        ${task.note ? `<div class="task-note">📝 ${task.note}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">
        <span class="task-countdown ${cd.cls}">${cd.label}</span>
        <button class="task-delete" onclick="deleteTask(${task.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ===== COUNTDOWN =====
function getCountdown(task) {
  if (task.done) return { label: 'DONE ✓', cls: 'cd-done' };
  const now = new Date();
  const target = new Date(`${task.date}T${task.time}`);
  const diff = target - now;
  const mins = Math.floor(diff / 60000);

  if (mins < -1) return { label: 'PASSED', cls: 'cd-passed' };
  if (mins <= 0) return { label: 'NOW!', cls: 'cd-urgent' };

  if (mins < 60) return { label: `${mins}m`, cls: mins <= 30 ? 'cd-urgent' : 'cd-warn' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `${hrs}h ${mins % 60}m`, cls: 'cd-ok' };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d ${hrs % 24}h`, cls: 'cd-ok' };
}

function fmtDate(d) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tom = tomorrow.toISOString().split('T')[0];
  if (d === today) return 'TODAY';
  if (d === tom) return 'TOMORROW';
  return new Date(d+'T00:00:00').toLocaleDateString('ar-EG', {day:'numeric', month:'short'});
}

function repeatLabel(r) {
  return { '5min':'5م', '15min':'15م', '1hr':'1س' }[r] || '';
}

// ===== ACTIONS =====
function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneDate = t.done ? new Date().toISOString().split('T')[0] : null;
  save(); renderAll();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save(); renderAll();
  showToast('✕ اتمسح التاسك');
}

function clearDone() {
  tasks = tasks.filter(t => !t.done);
  save(); renderAll();
  showToast('✓ اتمسحت التاسكات المنتهية');
}

function setTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function save() {
  localStorage.setItem('dfTasks_v2', JSON.stringify(tasks));
}

// ===== ALERT SYSTEM =====
function startChecker() {
  setInterval(checkAlerts, 30000);
  checkAlerts();
}

function checkAlerts() {
  const now = new Date();
  tasks.forEach(task => {
    if (task.done) return;
    const target = new Date(task.nextAlert);
    const diff = now - target;
    if (diff >= 0 && diff < 60000 && !activeAlerts.has(task.id)) {
      triggerAlert(task);
      scheduleNext(task);
    }
  });
}

function scheduleNext(task) {
  if (task.repeat === 'once') return;
  const map = { '5min':5, '15min':15, '1hr':60 };
  const m = map[task.repeat] || 0;
  if (!m) return;
  const next = new Date(task.nextAlert);
  next.setMinutes(next.getMinutes() + m);
  task.nextAlert = next.toISOString();
  save();
}

function triggerAlert(task) {
  activeAlerts.add(task.id);
  setTimeout(() => activeAlerts.delete(task.id), 90000);

  document.getElementById('alertTaskName').textContent = task.name;
  document.getElementById('alertTaskNote').textContent = task.note || '';
  document.getElementById('alertOverlay').classList.add('show');

  playSound();

  if (Notification.permission === 'granted') {
    new Notification("🔔 DON'T FORGET!", {
      body: task.name + (task.note ? '\n' + task.note : ''),
    });
  }
}

function dismissAlert() {
  document.getElementById('alertOverlay').classList.remove('show');
}

// ===== SOUND =====
function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const pattern = [
      {f: 880, t: 0, d: 0.12},
      {f: 1108, t: 0.15, d: 0.12},
      {f: 1318, t: 0.30, d: 0.18},
      {f: 1108, t: 0.52, d: 0.10},
      {f: 1318, t: 0.65, d: 0.25},
    ];
    pattern.forEach(({f, t, d}) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = 'triangle';
      const start = ctx.currentTime + t;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + d);
      osc.start(start); osc.stop(start + d);
    });
  } catch(e) {}
}

// ===== NOTIFICATIONS =====
function checkNotifPerm() {
  if (!('Notification' in window) || Notification.permission === 'granted') {
    document.getElementById('permBanner').classList.add('hidden');
  }
}

function requestNotifPerm() {
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      document.getElementById('permBanner').classList.add('hidden');
      showToast('⚡ الإشعارات اتفعلت!');
    }
  });
}

// ===== PWA SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('✅ Service Worker شغال'))
      .catch(err => console.log('❌ Service Worker فشل:', err));
  });
}

// ===== SPACE BACKGROUND =====
(function() {
  const canvas = document.getElementById('spaceCanvas');
  const ctx = canvas.getContext('2d');
  const neonColors = ['#00f5ff','#ff2d78','#f5ff00','#bf00ff','#00ff88','#ffffff'];

  let W, H, stars = [], meteors = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // Stars
  function initStars() {
    stars = [];
    const count = Math.floor((W * H) / 4000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.2,
        color: Math.random() < 0.85 ? 'rgba(255,255,255,' + (Math.random() * 0.6 + 0.2) + ')' : neonColors[Math.floor(Math.random() * neonColors.length)],
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
        glow: Math.random() < 0.15,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  // Meteor class
  class Meteor {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = Math.random() * W * 1.5 - W * 0.25;
      this.y = initial ? Math.random() * H * -1 : -80;
      this.len = Math.random() * 180 + 80;
      this.speed = Math.random() * 6 + 3;
      this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3;
      this.color = neonColors[Math.floor(Math.random() * neonColors.length)];
      this.alpha = Math.random() * 0.7 + 0.3;
      this.width = Math.random() * 2 + 0.5;
      this.tail = [];
      this.maxTail = Math.floor(this.len / 4);
    }
    update() {
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      this.tail.unshift({ x: this.x, y: this.y });
      if (this.tail.length > this.maxTail) this.tail.pop();
      if (this.x > W + 200 || this.y > H + 200) this.reset();
    }
    draw() {
      if (this.tail.length < 2) return;
      // Glow head
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width + 1, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.fill();

      // Tail gradient
      for (let i = 0; i < this.tail.length - 1; i++) {
        const t = this.tail[i], t2 = this.tail[i+1];
        const progress = i / this.tail.length;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.alpha * (1 - progress) * 0.8;
        ctx.lineWidth = this.width * (1 - progress * 0.8);
        ctx.shadowBlur = 8 * (1 - progress);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function initMeteors() {
    meteors = [];
    const count = Math.min(8, Math.floor(W / 200));
    for (let i = 0; i < count; i++) {
      setTimeout(() => meteors.push(new Meteor()), i * 800);
    }
  }

  let frame = 0;
  function animate() {
    requestAnimationFrame(animate);
    frame++;

    // Deep space background
    ctx.fillStyle = 'rgba(2,2,8,0.18)';
    ctx.fillRect(0, 0, W, H);

    // Stars
    stars.forEach(s => {
      // Move
      s.x += s.vx;
      s.y += s.vy;
      // Wrap around edges
      if (s.x < -5) s.x = W + 5;
      if (s.x > W + 5) s.x = -5;
      if (s.y < -5) s.y = H + 5;
      if (s.y > H + 5) s.y = -5;

      const twinkle = 0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed + s.twinkleOffset);
      ctx.save();
      ctx.globalAlpha = twinkle * 0.85 + 0.15;
      if (s.glow) {
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.restore();
    });

    // Spawn new meteors occasionally
    if (frame % 180 === 0 && meteors.length < 10) {
      meteors.push(new Meteor());
    }

    // Meteors
    meteors.forEach(m => { m.update(); m.draw(); });
  }

  resize();
  initStars();
  initMeteors();
  animate();
  window.addEventListener('resize', () => { resize(); initStars(); });
})();

// ===== TOAST =====
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
