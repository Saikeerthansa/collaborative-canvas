/**
 * Collaborative Canvas - Server
 * Express + Socket.io backend
 *
 * Responsibilities:
 * - Serve static frontend (index.html, JS, CSS)
 * - Manage per-room user lists and drawing history
 * - Handle drawing, cursor, undo/redo, clear events
 * - Emit `init` event on join so frontend activates drawing
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname + '/../client')); // serve client files

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// -----------------------------
// In-memory store
// -----------------------------
/**
 * rooms = {
 *   roomId: {
 *     users: { socketId: { name, color } },
 *     history: [ {id,type,path,color,width,userId} ],
 *     undoneStack: [opId]
 *   }
 * }
 */
const rooms = {};

function ensureRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = { users: {}, history: [], undoneStack: [] };
  }
  return rooms[roomId];
}

// -----------------------------
// Socket.io event handlers
// -----------------------------
io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // Join event
  socket.on('join', (payload) => {
    const { roomId = 'default', name = 'Guest', color } = payload || {};
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    const room = ensureRoom(roomId);
    room.users[socket.id] = { name, color: color || randomColor() };

    // ✅ Send initialization data to new client
    socket.emit('init', {
      myId: socket.id,
      users: room.users,
      history: room.history,
      undoneStack: room.undoneStack
    });

    // Notify others in room
    socket.to(roomId).emit('user-join', {
      id: socket.id,
      name,
      color: room.users[socket.id].color
    });

    // Update full user list for everyone
    io.in(roomId).emit('users', room.users);

    console.log(`👤 ${name} joined room: ${roomId}`);
  });

  // Handle stroke preview
  socket.on('beginStroke', (data) => {
    const roomId = socket.data.roomId || 'default';
    socket.to(roomId).emit('beginStroke', { ...data, socketId: socket.id });
  });

  // Handle batched live stroke data
  socket.on('stroke', (data) => {
    const roomId = socket.data.roomId || 'default';
    socket.to(roomId).emit('stroke', { ...data, socketId: socket.id });
  });

  // Handle stroke completion → save operation
  socket.on('endStroke', (data) => {
    const roomId = socket.data.roomId || 'default';
    const room = ensureRoom(roomId);

    const op = {
      id: data.strokeId || uuidv4(),
      type: 'stroke',
      userId: socket.id,
      path: data.path,
      color: data.color,
      width: data.width,
      meta: data.meta || {}
    };

    // Add to history and reset redo stack
    room.history.push(op);
    room.undoneStack = [];

    io.in(roomId).emit('endStroke', op);
  });

  // Handle cursor position updates
  socket.on('cursor', (data) => {
    const roomId = socket.data.roomId || 'default';
    socket.to(roomId).emit('cursor', { socketId: socket.id, ...data });
  });

  // Handle global undo
  socket.on('undo', () => {
    const roomId = socket.data.roomId || 'default';
    const room = ensureRoom(roomId);

    for (let i = room.history.length - 1; i >= 0; i--) {
      const op = room.history[i];
      if (!room.undoneStack.includes(op.id)) {
        room.undoneStack.push(op.id);
        io.in(roomId).emit('undo', { opId: op.id, by: socket.id });
        break;
      }
    }
  });

  // Handle global redo
  socket.on('redo', () => {
    const roomId = socket.data.roomId || 'default';
    const room = ensureRoom(roomId);

    const id = room.undoneStack.pop();
    if (id) io.in(roomId).emit('redo', { opId: id, by: socket.id });
  });

  // Handle canvas clear
  socket.on('clear', () => {
    const roomId = socket.data.roomId || 'default';
    const room = ensureRoom(roomId);
    room.history = [];
    room.undoneStack = [];
    io.in(roomId).emit('clear');
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
    const roomId = socket.data.roomId || 'default';
    const room = rooms[roomId];
    if (room) {
      delete room.users[socket.id];
      socket.to(roomId).emit('user-leave', { id: socket.id });
      io.in(roomId).emit('users', room.users);
    }
  });
});

// -----------------------------
// Helper
// -----------------------------
function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 70% 45%)`;
}

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});