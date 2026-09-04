import api from './axios';

const WS_BASE_URL = import.meta.env.VITE_API_URL?.replace(/^http/, 'ws') || 'ws://127.0.0.1:8000';

export function getLatestLocations() {
  return api.get('/realtime/latest-locations');
}

export function createLocationSocket(onMessage, onOpen, onClose, onError) {
  let isClosedManually = false;
  let heartbeatTimer = null;
  let socket = null;

  function connect() {
    if (isClosedManually) return;
    const token = localStorage.getItem('fleetflow_token') || '';
    const url = `${WS_BASE_URL.replace(/\/$/, '')}/realtime/ws/gps?token=${token}`;
    
    try {
      socket = new WebSocket(url);
    } catch (err) {
      console.warn('WebSocket init failed:', err);
      onError?.(err);
      return;
    }

    socket.onopen = () => {
      onOpen?.();
      // Start heartbeat every 20 seconds
      heartbeatTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 20000);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onMessage?.(payload);
      } catch (error) {
        console.error('Realtime socket parse failed', error);
      }
    };

    socket.onclose = () => {
      clearInterval(heartbeatTimer);
      onClose?.();
      if (!isClosedManually) {
        // Auto-reconnect after 3 seconds
        setTimeout(connect, 3000);
      }
    };

    socket.onerror = (event) => {
      onError?.(event);
    };
  }

  connect();

  return {
    send: (data) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(typeof data === 'string' ? data : JSON.stringify(data));
      }
    },
    close: () => {
      isClosedManually = true;
      clearInterval(heartbeatTimer);
      if (socket) {
        socket.close();
      }
    },
  };
}
