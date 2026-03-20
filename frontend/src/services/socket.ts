import { useAuthStore } from '../store/useAuthStore';
import { useChatStore, Message } from '../store/useChatStore';

class SocketService {
  private socket: WebSocket | null = null;
  private reconnectInterval: number = 2000;
  private maxRetries: number = 50;
  private retryCount: number = 0;
  private pingInterval: any = null;
  private messageQueue: any[] = [];
  private isConnecting: boolean = false;

  connect() {
    const token = useAuthStore.getState().token;
    if (!token) return;
    
    // Safety check: don't double connect
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return; 
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = import.meta.env.VITE_WS_URL 
      ? `${import.meta.env.VITE_WS_URL}/ws?token=${token}`
      : `${wsProtocol}//${wsHost}/ws?token=${token}`;

    console.log('[Socket] Connecting...');
    this.isConnecting = true;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[Socket] Connected');
      this.isConnecting = false;
      this.retryCount = 0;
      useChatStore.getState().setIsConnected(true);
      
      // Send queued messages immediately
      this.processQueue();
      
      // Heartbeat: 5 seconds (aggressive for ngrok stability)
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
           this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
    };

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data } = payload;
        
        if (type === 'pong') return;
        
        switch (type) {
          case 'new_message':
            useChatStore.getState().addMessage(data as Message);
            break;
          case 'message_deleted':
            useChatStore.getState().removeMessage(data.id);
            break;
          case 'voice_update':
            useChatStore.getState().setVoiceUpdate(data.channel_id, data.user_id, data.status);
            break;
          default:
            console.log('[Socket] Event:', type, data);
        }
      } catch (e) {
        console.error('[Socket] Parse error:', e);
      }
    };

    this.socket.onclose = () => {
      console.log('[Socket] Disconnected');
      this.isConnecting = false;
      useChatStore.getState().setIsConnected(false);
      if (this.pingInterval) clearInterval(this.pingInterval);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    };

    this.socket.onerror = (err) => {
      console.error('[Socket] Error:', err);
      this.socket?.close();
    };
  }

  private processQueue() {
    if (this.messageQueue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      console.log(`[Socket] Flushing ${this.messageQueue.length} queued signals`);
      while (this.messageQueue.length > 0) {
        const payload = this.messageQueue.shift();
        this.socket.send(JSON.stringify(payload));
      }
    }
  }

  sendMessage(channelId: number, content: string = '', mediaUrl?: string, mediaType: string = 'text') {
    const payload = {
      type: 'send_message',
      channel_id: channelId,
      content,
      media_url: mediaUrl,
      media_type: mediaType
    };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('[Socket] Queuing message for reconnect...');
      this.messageQueue.push(payload);
      this.connect();
    }
  }

  joinChannel(channelId: number) {
    const payload = { type: 'join_channel', channel_id: channelId };
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
      this.connect();
    }
  }

  updateVoiceStatus(channelId: number, status: 'join' | 'leave') {
    const payload = {
      type: status === 'join' ? 'voice_join' : 'voice_leave',
      channel_id: channelId
    };
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      this.connect();
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.socket?.close();
    this.socket = null;
  }
}

export const socketService = new SocketService();
