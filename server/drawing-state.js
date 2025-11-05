/**
 * server/drawing-state.js
 *
 * Manages the canonical drawing history and undone-stack per room.
 *
 * API:
 *  - createDrawingState(roomId)
 *  - getDrawingState(roomId) => { history: [...], undoneStack: [...] }
 *  - addOperationToRoom(roomId, op)
 *  - getRoomHistory(roomId)
 *  - getRoomUndoneStack(roomId)
 *  - requestUndoInRoom(roomId) => opId | null
 *  - requestRedoInRoom(roomId) => opId | null
 *  - clearRoomHistory(roomId)
 *
 * Implementation note:
 *  - history is append-only array of op objects {id,type,...}
 *  - undoneStack is LIFO array of opIds representing undone operations (most recently undone at the end)
 *  - When a new op is added, undoneStack is cleared (standard linear history semantics)
 */

const drawingStates = {}; // roomId -> { history: [], undoneStack: [] }

function createDrawingState(roomId) {
  if (!drawingStates[roomId]) {
    drawingStates[roomId] = { history: [], undoneStack: [] };
  }
  return drawingStates[roomId];
}

function getDrawingState(roomId) {
  return drawingStates[roomId] || { history: [], undoneStack: [] };
}

function addOperationToRoom(roomId, op) {
  const ds = createDrawingState(roomId);
  ds.history.push(op);
  // new op invalidates redo stack
  ds.undoneStack = [];
  return op;
}

function getRoomHistory(roomId) {
  return (drawingStates[roomId] && drawingStates[roomId].history) ? [...drawingStates[roomId].history] : [];
}

function getRoomUndoneStack(roomId) {
  return (drawingStates[roomId] && drawingStates[roomId].undoneStack) ? [...drawingStates[roomId].undoneStack] : [];
}

/**
 * Undo: find last op in history that is not currently undone, push its id to undoneStack
 * Return opId if undone, or null if nothing to undo
 */
function requestUndoInRoom(roomId) {
  const ds = createDrawingState(roomId);
  for (let i = ds.history.length - 1; i >= 0; i--) {
    const op = ds.history[i];
    if (!ds.undoneStack.includes(op.id)) {
      ds.undoneStack.push(op.id);
      return op.id;
    }
  }
  return null;
}

/**
 * Redo: pop last id from undoneStack and return it, or null if none
 */
function requestRedoInRoom(roomId) {
  const ds = createDrawingState(roomId);
  if (ds.undoneStack.length === 0) return null;
  const opId = ds.undoneStack.pop();
  return opId;
}

function clearRoomHistory(roomId) {
  const ds = createDrawingState(roomId);
  ds.history = [];
  ds.undoneStack = [];
}

module.exports = {
  createDrawingState,
  getDrawingState,
  addOperationToRoom,
  getRoomHistory,
  getRoomUndoneStack,
  requestUndoInRoom,
  requestRedoInRoom,
  clearRoomHistory
};