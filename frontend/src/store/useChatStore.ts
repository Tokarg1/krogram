import { create } from 'zustand'

export interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  server_id?: number;
  is_dm?: boolean;
}

export interface Server {
  id: number;
  name: string;
  icon_url?: string;
  channels: Channel[];
}

export interface Message {
  id: number;
  content?: string;
  media_url?: string;
  media_type: 'text' | 'image' | 'video' | 'circle' | 'file';
  created_at: string;
  sender_id: number;
  channel_id: number;
  sender: {
    username: string;
    avatar_url?: string;
  };
}

interface ChatState {
  servers: Server[];
  dmChannels: Channel[];
  currentServer: Server | null;
  currentChannel: Channel | null;
  messages: Message[];
  voiceParticipants: Record<number, number[]>;
  isConnected: boolean;
  isSidebarOpen: boolean;
  
  setServers: (servers: Server[]) => void;
  setDmChannels: (channels: Channel[]) => void;
  setCurrentServer: (server: Server | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  removeMessage: (id: number) => void;
  addServer: (server: Server) => void;
  setVoiceUpdate: (channel_id: number, user_id: number, status: 'joined' | 'left') => void;
  setIsConnected: (connected: boolean) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  servers: [],
  currentServer: null,
  currentChannel: null,
  messages: [],
  voiceParticipants: {},
  dmChannels: [],
  isConnected: false,
  isSidebarOpen: window.innerWidth > 768,
  
  setServers: (servers) => set({ servers }),
  setDmChannels: (dmChannels) => set({ dmChannels }),
  setCurrentServer: (server) => set({ 
    currentServer: server, 
    currentChannel: server?.channels?.[0] || null 
  }),
  setCurrentChannel: (channel) => set({ currentChannel: channel, messages: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg: Message) => set((state) => {
    // Only add if it belongs to the channel the user is currently looking at
    if (state.currentChannel?.id !== msg.channel_id) {
       // Optional: logic for showing cross-channel notifications/red dots here
       return state;
    }
    
    // Prevent duplicates by filtering by ID
    const otherMessages = state.messages.filter(m => m.id !== msg.id);
    return { messages: [...otherMessages, msg] };
  }),
  removeMessage: (id: number) => set((state) => ({
    messages: state.messages.filter(m => m.id !== id)
  })),
  addServer: (server) => set((state) => ({
    servers: [...state.servers, server]
  })),
  setIsConnected: (isConnected) => set({ isConnected }),
  setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  
  setVoiceUpdate: (channel_id, user_id, status) => set((state) => {
    const channelUsers = state.voiceParticipants[channel_id] || [];
    const newParticipants = { ...state.voiceParticipants };
    
    if (status === 'joined') {
      if (!channelUsers.includes(user_id)) {
        newParticipants[channel_id] = [...channelUsers, user_id];
      }
    } else {
      newParticipants[channel_id] = channelUsers.filter(id => id !== user_id);
    }
    
    return { voiceParticipants: newParticipants };
  })
}))
