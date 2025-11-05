// Wrapper around socket.io with simple helpers
const SocketClient = (function () {
  let socket = null;
  return {
    connect(serverUrl = '/') {
      socket = io(serverUrl, { transports: ['websocket'] });
      return socket;
    },
    on(evt, cb) {
      if (!socket) return;
      socket.on(evt, cb);
    },
    emit(evt, data) {
      if (!socket) return;
      socket.emit(evt, data);
    },
    getSocket() { return socket; }
  };
})();
