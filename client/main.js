// client/main.js
document.addEventListener('DOMContentLoaded', () => {
  // Connect socket first
  const socket = SocketClient.connect();

  // Grab DOM elements
  const canvasEl = document.getElementById('canvas');
  const cursorsDiv = document.getElementById('cursors');

  // Create CanvasApp with the live socket instance
  const app = new CanvasApp(canvasEl, cursorsDiv, socket);

  // UI elements
  const nameInput = document.getElementById('name');
  const joinBtn = document.getElementById('joinBtn');
  const usersList = document.getElementById('usersList');
  const info = document.getElementById('info');
  const colorInput = document.getElementById('color');
  const sizeInput = document.getElementById('size');
  const toolSelect = document.getElementById('tool');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const clearBtn = document.getElementById('clear');

  let joined = false;

  // Join room
  joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || ('User' + Math.floor(Math.random() * 1000));
    const color = colorInput.value;
    socket.emit('join', { roomId: 'default', name, color });
    info.textContent = `Joining...`;
  });

  // Socket events (UI-level)
  socket.on('connect', () => {
    console.log('✅ Socket connected', socket.id);
  });

  socket.on('init', (data) => {
    console.log('init', data);
    joined = true;
    info.textContent = `Connected as ${data.users[socket.id]?.name || 'you'}`;
    renderUsers(data.users);
    // ensure canvas has cursor element for yourself
    const me = data.users[socket.id];
    if (me) app.createCursorElement(socket.id, me.name, me.color);
  });

  socket.on('users', (users) => {
    socket._usersCache = users;
    renderUsers(users);
  });

  socket.on('user-join', ({ id, name, color }) => {
    console.log(`${name} joined`);
  });

  socket.on('user-leave', ({ id }) => {
    console.log(`user ${id} left`);
  });

  function renderUsers(users) {
    usersList.innerHTML = '';
    for (const [id, u] of Object.entries(users || {})) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="user-dot" style="background:${u.color}"></span>${u.name} ${id === socket.id ? '(you)' : ''}`;
      usersList.appendChild(li);
      app.createCursorElement(id, u.name, u.color);
    }
  }

  // Controls
  colorInput.addEventListener('input', (e) => app.setColor(e.target.value));
  sizeInput.addEventListener('input', (e) => app.setSize(e.target.value));
  toolSelect.addEventListener('change', (e) => app.setTool(e.target.value));

  undoBtn.addEventListener('click', () => {
    if (!joined) return alert('Join the room first');
    app.requestUndo();
  });

  redoBtn.addEventListener('click', () => {
    if (!joined) return alert('Join the room first');
    app.requestRedo();
  });

  clearBtn.addEventListener('click', () => {
    if (!joined) return alert('Join the room first');
    if (confirm('Clear canvas for everyone?')) app.requestClear();
  });
});