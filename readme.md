# 🎨 Collaborative Canvas

A **real-time multi-user drawing application** built with **Vanilla JavaScript**, **HTML5 Canvas**, and **Node.js + Socket.io**, allowing multiple users to draw simultaneously on a shared canvas with **live synchronization, global undo/redo, and real-time cursor tracking**.

---

## 🚀 Features Overview

### 🖌️ Drawing Tools
- Brush and eraser tools  
- Adjustable stroke width and color picker  
- Smooth line rendering using optimized Canvas operations

### 🔄 Real-Time Synchronization
- Multiple users can draw **simultaneously**
- Drawings appear **in real time** across all connected clients (not just after finishing)
- Cursor positions are updated live for each participant

### 👥 User Management
- Each user enters a name and joins a shared room  
- The sidebar shows the **list of connected users**  
- Each user is assigned a **unique color** for identification  
- Displays **remote user cursors** with names and colors

### 🧠 Global Operations
- **Undo / Redo:** Works globally for all users — any undo/redo action reflects on every client  
- **Clear:** Clears the canvas globally for all users  
- All operations are synchronized through a server-managed canonical state

### ⚔️ Conflict Resolution
- Server maintains authoritative event order  
- Concurrent drawings from multiple users are merged deterministically  
- Undo/Redo maintains consistent state across all users

### 🧩 Technical Stack
| Layer | Technology | Description |
|--------|-------------|-------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Canvas rendering and UI controls |
| **Backend** | Node.js, Express.js, Socket.io | Real-time bidirectional communication |
| **Architecture** | Event-driven WebSocket model | Efficient state synchronization |

---

## 🗂️ Project Structure
```
collaborative-canvas/
├── client/
│ ├── index.html # UI layout
│ ├── style.css # App styling
│ ├── canvas.js # Canvas drawing & rendering logic
│ ├── websocket.js # WebSocket client connection
│ └── main.js # App initialization & UI controls
├── server/
│ ├── server.js # Express + Socket.io server
│ ├── rooms.js # Room/user management
│ └── drawing-state.js # Global drawing state (history, undo/redo)
├── package.json
├── README.md
└── ARCHITECTURE.md
```
---

## ⚙️ Setup Instructions

### 1️⃣ Install Node.js and npm
Make sure Node.js ≥ 16 and npm ≥ 8 are installed:
```bash
node -v
npm -v
```

### 2️⃣ Clone the Repository

```bash
git clone https://github.com/<your-username>/collaborative-canvas.git
cd collaborative-canvas
```

### 3️⃣ Install Dependencies

```bash
npm install
```

### 4️⃣ Start the Server
```bash
npm start
```

### You should see:
```bash
🚀 Server running on http://localhost:3000
```

### 5️⃣ Open the Application

Open your browser and go to:

http://localhost:3000



---

## 👨‍💻 How to Test with Multiple Users

1. Open **two or more browser windows or tabs** at [http://localhost:3000](http://localhost:3000).  
2. Enter a **different name** for each user and click **Join Room**.  
3. Start drawing — your drawings will appear **live** on all clients.  
4. Try these operations:
   - **Undo:** Removes the last stroke globally.  
   - **Redo:** Restores the last undone stroke.  
   - **Clear:** Wipes the canvas for everyone.  
5. Move your cursor — all participants see each other’s **cursors and names**.

---

## 🧠 How It Works (Summary)

- The **client** captures pointer events and streams stroke data (batched every 30ms) to the **server**.  
- The **server** stores:
  - `history[]`: All stroke operations.  
  - `undoneStack[]`: Undone operations.  
  - `users{}`: Connected users and colors.  
- The **server** broadcasts all events (`draw`, `undo`, `redo`, `clear`, `cursor`) to all clients.  
- Each **client** updates its local canvas state and redraws from the synchronized `history`.

---

## ⚡ Performance Optimizations

| Optimization | Purpose |
|---------------|----------|
| **Event Batching (30ms)** | Reduces WebSocket load while maintaining smooth drawing |
| **Incremental Rendering** | Only new strokes drawn per frame |
| **Server-Authoritative State** | Prevents data race and inconsistencies |
| **Client-Side Prediction** | Instant visual feedback while drawing |
| **Efficient Undo/Redo** | Uses operation IDs for minimal recomputation |

---

## ⚔️ Conflict Resolution

- **Server authority:** The server orders all operations globally (FIFO).  
- **Concurrent draws:** Simultaneous strokes are appended in received order.  
- **Undo scope:** Undo/Redo affects the shared history for all users.  
- **Consistency:** All clients maintain the same `history` and `undoneStack`.

---

## 🧱 Known Limitations / Future Enhancements

| Feature | Current | Improvement |
|----------|----------|-------------|
| **Persistence** | In-memory only | Store history in Redis or MongoDB |
| **Rooms** | Single shared room | Add multi-room support |
| **Mobile Support** | Basic pointer events | Add touch optimization and pressure support |
| **Performance Metrics** | Not displayed | Add FPS / latency overlay |
| **Authentication** | None | Add optional login or identity system |

---

## ☁️ Deployment Guide

### ▶️ Deploy on Render

1. Push this repo to **GitHub**.  
2. Go to [https://render.com](https://render.com) → **New Web Service**.  
3. Choose your GitHub repo.  
4. Set:
   - **Build Command:** `npm install`  
   - **Start Command:** `npm start`  
   - **Environment:** Node  
5. Deploy and get a live URL like:  
[https://your-app.onrender.com](https://collaborative-canvas-npfx.onrender.com)

## 🧩 Evaluation Mapping

| Requirement | Status |
|--------------|---------|
| Brush / Eraser / Color / Width | ✅ Complete |
| Real-time Sync | ✅ Complete |
| Cursor Indicators | ✅ Complete |
| Global Undo/Redo | ✅ Complete |
| Global Clear | ✅ Complete |
| User Management | ✅ Complete |
| Conflict Resolution | ✅ Complete |
| Efficient Canvas Ops | ✅ Complete |
| Documentation | ✅ Complete |

---

## 🧱 Known Bugs (Minor)

- Drawings reset when server restarts (due to in-memory history).  
- Small cursor delay (~100ms) may appear under heavy latency.

---

## ⏱️ Time Spent

| Phase | Duration |
|--------|-----------|
| Canvas drawing + tools | 0.5 day |
| WebSocket backend + sync | 0.5 day |
| Undo/Redo + Clear | 0.5 day |
| Testing, UI polish, docs | 0.5 day |
| **Total** | **≈ 2 days** |

---
