# 🧩 Collaborative Canvas – System Architecture

This document explains the **internal architecture**, **data flow**, **protocol design**, and **synchronization strategy** of the *Collaborative Canvas* project.

---

## 🏗️ High-Level Overview

The system consists of two major layers:

1. **Frontend (Client-Side)**
   - Renders the canvas, captures drawing events, and manages the UI.
   - Communicates with the backend via **Socket.io** WebSocket connections.

2. **Backend (Server-Side)**
   - Handles real-time communication between all connected clients.
   - Maintains the canonical global drawing state for each room.
   - Synchronizes canvas updates, undo/redo operations, and user events.

---

## 🔄 Data Flow Diagram

```
┌──────────────────────────────────────────┐
│                CLIENT A                  │
│ ┌────────────┐     ┌──────────────────┐  │
│ │  Canvas    │ →→→ │  WebSocket.js    │──┐│
│ └────────────┘     └──────────────────┘  ││
└──────────────────────────────────────────┘│
                                            │
                                            ▼
                                 ┌──────────────────────────────┐
                                 │         SERVER (Node)         │
                                 │  • Express                   │
                                 │  • Socket.io (WebSockets)    │
                                 │  • Drawing State Management  │
                                 └──────────────────────────────┘
                                            ▲
┌──────────────────────────────────────────┐│
│                CLIENT B                  ││
│ ┌────────────┐     ┌──────────────────┐  ││
│ │  Canvas    │ ←←← │  WebSocket.js    │◄─┘│
│ └────────────┘     └──────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 💬 WebSocket Protocol Design

| Event | Direction | Payload | Description |
|--------|------------|----------|-------------|
| `join` | Client → Server | `{ roomId, name, color }` | User joins a room; added to users list. |
| `init` | Server → Client | `{ myId, users, history, undoneStack }` | Sends complete room state to the new user. |
| `beginStroke` | Client → Server → Broadcast | `{ strokeId, color, width }` | Starts a stroke for live preview. |
| `stroke` | Client → Server → Broadcast | `{ strokeId, points[], color, width }` | Streams stroke data in small batches (~30ms). |
| `endStroke` | Client → Server → Broadcast | `{ strokeId, path[], color, width }` | Finalizes a stroke; saved to history. |
| `cursor` | Client → Server → Broadcast | `{ x, y }` | Normalized cursor coordinates for live indicators. |
| `undo` | Client → Server → Broadcast | `{ opId }` | Server marks last operation undone and broadcasts. |
| `redo` | Client → Server → Broadcast | `{ opId }` | Restores the last undone operation. |
| `clear` | Client → Server → Broadcast | — | Clears the entire canvas for all users. |
| `user-join` / `user-leave` | Server → Clients | `{ id, name, color }` | Announces join or leave events. |
| `users` | Server → Clients | `{ [socketId]: { name, color } }` | Full updated list of connected users. |

---

## 🧠 Undo / Redo Strategy

### Data Structures

```js
room = {
  history: [ { id, type, path, color, width, userId } ],
  undoneStack: [ opId1, opId2 ],
  users: { socketId: { name, color } }
}
```

### Algorithm

#### Undo:
1. Find the most recent operation in `history` not in `undoneStack`.
2. Push its `id` into `undoneStack`.
3. Broadcast `undo {opId}` to all clients.
4. Clients ignore undone operations during redraw.

#### Redo:
1. Pop the most recent `opId` from `undoneStack`.
2. Broadcast `redo {opId}` to all clients.
3. Clients restore the corresponding stroke.

#### New Stroke:
- Add the new operation to `history`.
- Clear `undoneStack` (linear undo model).

### Result
All connected clients maintain the **same synchronized canvas state**, since each redraws from the same `history` minus undone operations.

---

## ⚙️ Performance Decisions

| Optimization | Purpose |
|---------------|----------|
| **Event Batching (30 ms)** | Reduces WebSocket traffic while maintaining smooth drawing. |
| **Incremental Rendering** | Only new stroke segments are drawn, reducing redraw overhead. |
| **Canonical Server History** | Prevents race conditions and ensures consistent order across clients. |
| **Idempotent Operations** | Duplicate events have no effect; each stroke has a unique ID. |
| **Reconstruction on Join** | New users rebuild the full canvas from `history` and `undoneStack`. |

---

## ⚔️ Conflict Resolution

### Server-Authoritative Model
- The **server** assigns a strict order to all operations (`history` array).
- If multiple users draw simultaneously, their strokes are appended in received order.

### Deterministic Replay
- All clients replay `history` in identical order.
- This guarantees the same visual result across every connected device.

### Undo Scope
- Undo/Redo operations are **global**, affecting the shared history for all users.
- This keeps everyone’s view perfectly synchronized.

### Client-Side Prediction
- Users see their strokes instantly (before server acknowledgment).
- Server confirmation later ensures consistency between all participants.

---

## 🧩 Component Interaction Summary

| Component | Responsibility |
|------------|----------------|
| **index.html** | Defines app layout, buttons, and tool controls |
| **style.css** | Styles the UI and user cursor indicators |
| **websocket.js** | Handles Socket.io client connection and message transport |
| **canvas.js** | Manages drawing, streaming, and undo/redo logic |
| **main.js** | Coordinates UI events, room joining, and integrates socket with canvas |
| **server.js** | Hosts frontend files, manages all Socket.io events |
| **rooms.js** | Tracks users and their attributes within rooms |
| **drawing-state.js** | Maintains the per-room drawing history and undone stack |

---

## ⚡ Scalability Notes

- Each room keeps isolated state → horizontally scalable across nodes.
- Can use **Redis adapter** for Socket.io to sync rooms across servers.
- Using **message compression** and **event batching** keeps network load minimal.
- **Persistence** (e.g., Redis or MongoDB) can be added for permanent history storage.
- The current implementation is lightweight and easily extendable.

---

## 🧾 Summary

The **Collaborative Canvas** system provides deterministic, low-latency, and consistent real-time drawing synchronization.  
Its modular architecture ensures:
- Seamless collaboration for multiple users  
- Efficient canvas rendering and synchronization  
- Reliable global undo/redo  
- Extendable room and persistence support  

This structure ensures every participant sees the exact same canvas at all times — with high performance, stability, and simplicity.
