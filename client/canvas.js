// client/canvas.js
// Canvas drawing and replay logic (uses a socket passed into constructor)

(function (window) {

  function CanvasApp(canvasEl, cursorsContainer, socket, opts = {}) {
    this.canvas = canvasEl;
    this.cursors = cursorsContainer;
    this.socket = socket; // <-- socket instance passed by main.js
    this.ctx = canvasEl.getContext('2d');
    this.offscreen = document.createElement('canvas');
    this.offctx = this.offscreen.getContext('2d');

    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Initialize before resize to avoid "not iterable" crashes
    this.history = []; // operations: {id,type,userId,path,color,width}
    this.undone = new Set(); // op ids that are undone

    // drawing state
    this.currentTool = 'brush';
    this.color = '#1abc9c';
    this.size = 4;

    // local stroke building
    this.isDrawing = false;
    this.currentStroke = null; // {id, path:[], color, width}

    // incremental draw bookkeeping
    this.lastRenderedIndex = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // set up event handlers (pointer + socket)
    this.initEvents();
    this.initSocketHandlers();
  }

  CanvasApp.prototype.resize = function () {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(w * this.devicePixelRatio);
    this.canvas.height = Math.floor(h * this.devicePixelRatio);
    this.offscreen.width = this.canvas.width;
    this.offscreen.height = this.canvas.height;
    this.ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    this.offctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    this.redrawAll(true);
  };

  CanvasApp.prototype.initEvents = function () {
    const toPoint = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left);
      const y = (e.clientY - rect.top);
      return { x, y, t: Date.now() };
    };

    const start = (e) => {
      e.preventDefault();
      const p = toPoint(e);
      this.beginLocalStroke(p);
    };

    const move = (e) => {
      e.preventDefault();
      const p = toPoint(e);
      this.extendLocalStroke(p);
      if (this.socket && this.socket.connected) {
        this.socket.emit('cursor', { x: p.x / this.canvas.clientWidth, y: p.y / this.canvas.clientHeight });
      }
    };

    const end = (e) => {
      e.preventDefault();
      this.endLocalStroke();
    };

    this.canvas.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  CanvasApp.prototype.initSocketHandlers = function () {
    const socket = this.socket;
    if (!socket) return;

    socket.on('init', (data) => {
      // Replace local history with server's canonical history
      this.history = Array.isArray(data.history) ? data.history.slice() : [];
      this.undone = new Set(data.undoneStack || []);
      this.redrawAll(true);
    });

    socket.on('beginStroke', (d) => {
      // optional preview support
    });

    socket.on('stroke', (data) => {
      // live chunk from remote user
      this.drawLiveChunk(data);
    });

    socket.on('endStroke', (op) => {
      // canonical op from server; append if not present
      if (!this.history.find(o => o.id === op.id)) {
        this.history.push(op);
      }
      // draw op if not undone
      if (!this.undone.has(op.id)) {
        this.drawPathSegment(op.path, op.color, op.width);
      } else {
        this.redrawAll(true);
      }
    });

    socket.on('cursor', ({ socketId, x, y }) => {
      this.updateCursor(socketId, x, y);
    });

    socket.on('undo', ({ opId }) => {
      this.undone.add(opId);
      this.redrawAll(true);
    });

    socket.on('redo', ({ opId }) => {
      this.undone.delete(opId);
      this.redrawAll(true);
    });

    socket.on('clear', () => {
      this.history = [];
      this.undone = new Set();
      this.clearCanvas();
    });

    socket.on('users', (users) => {
      // ensure cursor elements exist for all users
      for (const id of Object.keys(users)) {
        const u = users[id];
        this.createCursorElement(id, u.name, u.color);
      }
      // remove any stale cursors
      [...this.cursors.children].forEach((c) => {
        if (!users[c.dataset.socket]) c.remove();
      });
    });

    socket.on('user-join', ({ id, name, color }) => {
      this.createCursorElement(id, name, color);
    });

    socket.on('user-leave', ({ id }) => {
      const el = this.cursors.querySelector(`[data-socket="${id}"]`);
      if (el) el.remove();
    });
  };

  // Local stroke lifecycle
  CanvasApp.prototype.beginLocalStroke = function (p) {
    this.isDrawing = true;
    const id = this.generateId();
    this.currentStroke = {
      id,
      type: 'stroke',
      userId: 'local',
      path: [p],
      color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
      width: this.currentTool === 'eraser' ? this.size * 2 : this.size
    };
    this.drawPathSegment(this.currentStroke.path, this.currentStroke.color, this.currentStroke.width);
    if (this.socket && this.socket.connected) {
      this.socket.emit('beginStroke', { strokeId: id, color: this.currentStroke.color, width: this.currentStroke.width });
    }
    this._lastBatchTime = Date.now();
  };

  CanvasApp.prototype.extendLocalStroke = function (p) {
    if (!this.isDrawing || !this.currentStroke) return;
    this.currentStroke.path.push(p);
    const idx = this.currentStroke.path.length;
    if (idx >= 2) {
      this.drawSegment(this.currentStroke.path[idx - 2], this.currentStroke.path[idx - 1], this.currentStroke.color, this.currentStroke.width);
    }
    const now = Date.now();
    if (this.socket && now - (this._lastBatchTime || 0) > 30) {
      const pts = this.currentStroke.path.slice(-10);
      this.socket.emit('stroke', {
        strokeId: this.currentStroke.id,
        points: pts,
        color: this.currentStroke.color,
        width: this.currentStroke.width
      });
      this._lastBatchTime = now;
    }
  };

  CanvasApp.prototype.endLocalStroke = function () {
    if (!this.isDrawing || !this.currentStroke) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('endStroke', {
        strokeId: this.currentStroke.id,
        path: this.currentStroke.path,
        color: this.currentStroke.color,
        width: this.currentStroke.width
      });
    }
    // Append locally to keep instant UX; server will also send endStroke (idempotent)
    if (!this.history.find(o => o.id === this.currentStroke.id)) {
      this.history.push({
        id: this.currentStroke.id,
        type: 'stroke',
        userId: 'me',
        path: this.currentStroke.path,
        color: this.currentStroke.color,
        width: this.currentStroke.width
      });
    }
    this.currentStroke = null;
    this.isDrawing = false;
  };

  // Drawing helpers
  CanvasApp.prototype.drawSegment = function (p1, p2, color, width) {
    const ctx = this.ctx;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  CanvasApp.prototype.drawPathSegment = function (path, color, width) {
    if (!path || path.length < 2) return;
    const ctx = this.ctx;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
  };

  CanvasApp.prototype.drawOp = function (op) {
    if (!op || op.type !== 'stroke') return;
    if (this.undone.has(op.id)) return;
    this.drawPathSegment(op.path, op.color, op.width);
  };

  CanvasApp.prototype.drawLiveChunk = function (data) {
    const points = data.points || [];
    if (points.length < 2) return;
    const color = data.color || '#333';
    const width = data.width || 3;
    for (let i = 1; i < points.length; i++) {
      this.drawSegment(points[i - 1], points[i], color, width);
    }
  };

  CanvasApp.prototype.clearCanvas = function () {
    this.ctx.clearRect(0, 0, this.canvas.width / this.devicePixelRatio, this.canvas.height / this.devicePixelRatio);
  };

  // Redraw full history
  CanvasApp.prototype.redrawAll = function (force) {
    if (!Array.isArray(this.history)) this.history = [];
    if (!(this.undone instanceof Set)) this.undone = new Set();
    this.clearCanvas();
    for (let op of this.history) {
      if (this.undone.has(op.id)) continue;
      this.drawPathSegment(op.path, op.color, op.width);
    }
  };

  // Cursor helpers
  CanvasApp.prototype.createCursorElement = function (id, name, color) {
  // Try to find user info from the current users map if available
  const knownUsers = (this.socket && this.socket._usersCache) || {};
  const known = knownUsers[id];
  const finalName = name || (known ? known.name : 'User');
  const finalColor = color || (known ? known.color : '#000');

  let el = this.cursors.querySelector(`[data-socket="${id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'cursor';
    el.dataset.socket = id;
    this.cursors.appendChild(el);
  }
  el.innerHTML = `<span class="user-dot" style="background:${finalColor}"></span><span class="label">${finalName}</span>`;
  return el;
  };

  CanvasApp.prototype.updateCursor = function (socketId, normX, normY) {
    let el = this.cursors.querySelector(`[data-socket="${socketId}"]`);
    if (!el) {
      el = this.createCursorElement(socketId, 'Guest', '#999');
    }
    const x = (normX || 0) * this.canvas.clientWidth;
    const y = (normY || 0) * this.canvas.clientHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  // Controls / commands
  CanvasApp.prototype.setTool = function (tool) { this.currentTool = tool; };
  CanvasApp.prototype.setSize = function (s) { this.size = parseInt(s, 10); };
  CanvasApp.prototype.setColor = function (c) { this.color = c; };

  CanvasApp.prototype.requestUndo = function () {
    if (this.socket && this.socket.connected) this.socket.emit('undo');
  };
  CanvasApp.prototype.requestRedo = function () {
    if (this.socket && this.socket.connected) this.socket.emit('redo');
  };
  CanvasApp.prototype.requestClear = function () {
    if (this.socket && this.socket.connected) this.socket.emit('clear');
  };

  CanvasApp.prototype.generateId = function () {
    return 's_' + Math.random().toString(36).slice(2, 9);
  };

  window.CanvasApp = CanvasApp;

})(window);