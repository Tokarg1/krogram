import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore, Message } from '../store/useChatStore';

class SocketService {
    private channel: any = null;

    connect() {
        const token = useAuthStore.getState().token;
        if (!token) return;

        // Ensure we don't have dangling connections
        this.disconnect();

        console.log('[Supabase Realtime] Connecting...');
        
        // Listen to inserts and deletes on the 'messages' table globally
        this.channel = supabase.channel('public:messages')
            .on(
                'postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'messages' }, 
                async (payload) => {
                    const row = payload.new;
                    // Realtime payload doesn't include joined relations by default, so we fetch the sender profile quickly
                    const { data: sender } = await supabase.from('users').select('*').eq('id', row.sender_id).single();
                    const newMessage = { ...row, sender };
                    useChatStore.getState().addMessage(newMessage as any);
                }
            )
            .on(
                'postgres_changes', 
                { event: 'DELETE', schema: 'public', table: 'messages' }, 
                (payload) => {
                    useChatStore.getState().removeMessage(payload.old.id);
                }
            )
            .subscribe((status) => {
                console.log('[Supabase Realtime] Status:', status);
                if (status === 'SUBSCRIBED') {
                    useChatStore.getState().setIsConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    useChatStore.getState().setIsConnected(false);
                    // Attempt an auto-reconnect on error
                    if (status === 'CHANNEL_ERROR') {
                        setTimeout(() => this.connect(), 3000);
                    }
                }
            });
    }

    async sendMessage(channelId: number, content: string = '', mediaUrl?: string, mediaType: string = 'text') {
        const user = useAuthStore.getState().user;
        if (!user) return;
        
        // With Supabase, we send messages simply by inserting them into the database!
        // The Realtime listener above will catch it and broadcast it to everyone, including ourselves.
        const { error } = await supabase.from('messages').insert([{
            channel_id: channelId,
            content,
            media_url: mediaUrl,
            media_type: mediaType,
            sender_id: user.id
        }]);

        if (error) {
            console.error('[Supabase Realtime] Failed to send message', error);
        }
    }

    joinChannel(channelId: number) {
        // Handled automatically by channel selection in ChatStore
    }

    updateVoiceStatus(channelId: number, status: 'join' | 'leave') {
         // Voice updates left as stub for pure Serverless model
         useChatStore.getState().setVoiceUpdate(channelId, useAuthStore.getState().user?.id || 0, status === 'join' ? 'joined' : 'left');
    }

    disconnect() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
        useChatStore.getState().setIsConnected(false);
    }
}

export const socketService = new SocketService();
