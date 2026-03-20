import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';

// Helper to mimic Axios responses
const response = (data: any) => ({ data });
const getCurrentUserId = () => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Unauthorized");
    return user.id;
};

export const api = {
    get: async (url: string, config?: any) => {
        try {
            if (url === '/users/me') {
                const token = useAuthStore.getState().token;
                if (!token) throw new Error("No token");
                const { data } = await supabase.from('users').select('*').eq('id', parseInt(token)).single();
                return response(data);
            }
            if (url === '/servers/') {
                const uid = getCurrentUserId();
                const { data } = await supabase.from('user_server').select('server_id, servers(*, channels(*))').eq('user_id', uid);
                return response((data || []).map((d: any) => d.servers));
            }
            if (url === '/friends/dms') {
                const uid = getCurrentUserId();
                const { data } = await supabase.from('user_dm_channel').select('channel_id, channels(*)').eq('user_id', uid);
                // We also need the other participant for the DM name/avatar.
                // A complete rewrite should fetch users, but for now we keep it simple to ensure it doesn't break
                return response((data || []).map((d: any) => d.channels).filter((c: any) => c.is_dm));
            }
            if (url === '/friends/incoming') {
                const username = useAuthStore.getState().user?.username;
                const { data } = await supabase.from('friend_requests')
                    .select('id, status, from_user_id, users!friend_requests_from_user_id_fkey(*)')
                    .eq('to_phone', username)
                    .eq('status', 'pending');
                return response((data || []).map((r: any) => ({ id: r.id, from_user: r.users })));
            }
            if (url.startsWith('/messages/')) {
                const channelId = parseInt(url.split('/').pop() || '0');
                const { data } = await supabase.from('messages')
                    .select('*, sender:users(*)')
                    .eq('channel_id', channelId)
                    .order('created_at', { ascending: true });
                return response(data);
            }
            if (url.startsWith('/users/search')) {
                const query = new URLSearchParams(url.split('?')[1]).get('query');
                const { data } = await supabase.from('users').select('*').ilike('username', `%${query}%`).limit(10);
                return response(data);
            }
            console.warn('[API Wrapper] Unhandled GET:', url);
            return response(null);
        } catch (e) {
            console.error('[API Wrapper Error]', e);
            throw e;
        }
    },
    
    post: async (url: string, body?: any, config?: any) => {
        try {
            if (url === '/auth/register') {
                const { username, password } = body;
                if (!username || !password) throw new Error("Username and password are required");
                const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
                if (existing) {
                    throw { response: { data: { detail: "Username already taken" } } };
                }
                const { data: newUser, error } = await supabase.from('users').insert([{ username, password }]).select().single();
                if (error) throw new Error(error.message);
                return response({ access_token: newUser.id.toString(), token_type: 'bearer' });
            }
            if (url === '/auth/login') {
                const { username, password } = body;
                const { data: user } = await supabase.from('users').select('*').eq('username', username).eq('password', password).maybeSingle();
                if (!user) {
                    throw { response: { data: { detail: "Invalid username or password" } } };
                }
                return response({ access_token: user.id.toString(), token_type: 'bearer' });
            }
            if (url === '/servers/') {
                const uid = getCurrentUserId();
                const { name, icon_url } = body;
                const { data: server } = await supabase.from('servers').insert([{ name, icon_url, owner_id: uid }]).select().single();
                if (server) {
                    await supabase.from('user_server').insert([{ user_id: uid, server_id: server.id }]);
                    const { data: channel } = await supabase.from('channels').insert([{ name: 'General', type: 'text', server_id: server.id }]).select().single();
                    (server as any).channels = channel ? [channel] : [];
                }
                return response(server);
            }
            if (url.startsWith('/servers/') && url.endsWith('/join')) {
                 const serverId = parseInt(url.split('/')[2]);
                 const uid = getCurrentUserId();
                 await supabase.from('user_server').insert([{ user_id: uid, server_id: serverId }]);
                 return response({message: "Joined"});
            }
            if (url.startsWith('/friends/request/')) {
                const targetUserId = parseInt(url.split('/').pop() || '0');
                const uid = getCurrentUserId();
                const { data: target } = await supabase.from('users').select('username').eq('id', targetUserId).single();
                if (target) {
                    // Adapt legacy to_phone column to store the target username
                    await supabase.from('friend_requests').insert([{ from_user_id: uid, to_phone: target.username }]);
                }
                return response({message: "Sent"});
            }
            if (url.startsWith('/friends/decline/')) {
                const reqId = parseInt(url.split('/')[3]);
                await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', reqId);
                return response({ message: 'Declined' });
            }
            if (url.startsWith('/friends/accept/')) {
                const reqId = parseInt(url.split('/')[3]);
                const uid = getCurrentUserId();
                const { data: request } = await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', reqId).select().single();
                if (request) {
                    const { data: channel } = await supabase.from('channels').insert([{ is_dm: true, name: 'DM' }]).select().single();
                    if (channel) {
                        await supabase.from('user_dm_channel').insert([
                            { user_id: uid, channel_id: channel.id },
                            { user_id: request.from_user_id, channel_id: channel.id }
                        ]);
                    }
                }
                return response({ message: 'Accepted' });
            }
            if (url === '/media/upload') {
                // Mock upload for now
                return response({ url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=800&q=60" });
            }
            console.warn('[API Wrapper] Unhandled POST:', url);
            return response(null);
        } catch (e) {
            console.error('[API Wrapper Error]', e);
            throw e;
        }
    },
    
    delete: async (url: string) => {
        try {
           if (url.startsWith('/messages/')) {
                const mid = parseInt(url.split('/').pop() || '0');
                await supabase.from('messages').delete().eq('id', mid);
                return response({ message: 'Deleted' });
            }
            console.warn('[API Wrapper] Unhandled DELETE:', url);
            return response(null);
        } catch(e) { throw e; }
    }
};

export default api;
