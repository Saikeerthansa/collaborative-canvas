/**
 * server/rooms.js
 *
 * Simple in-memory room/user management.
 *
 * rooms = {
 *   <roomId>: {
 *     users: {
 *       <socketId>: { name, color }
 *     }
 *   }
 * }
 *
 * Note: This is intentionally simple and in-memory for demo/interview use.
 * For real deployments you'd replace this with a shared store (Redis) so multiple
 * Node instances can share room membership.
 */

const rooms = {};

/**
 * Ensure room exists
 * @param {string} roomId
 */
function ensureRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = { users: {} };
  }
  return rooms[roomId];
}

function addUserToRoom(roomId, socketId, user) {
  const room = ensureRoom(roomId);
  room.users[socketId] = { name: user.name || 'Guest', color: user.color || '#999' };
}

function removeUserFromRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return;
  delete room.users[socketId];
  // optionally: cleanup empty rooms
  if (Object.keys(room.users).length === 0) {
    delete rooms[roomId];
  }
}

function getRoomUsers(roomId) {
  const room = rooms[roomId];
  return room ? { ...room.users } : {};
}

function roomExists(roomId) {
  return !!rooms[roomId];
}

module.exports = {
  ensureRoom,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  roomExists
};