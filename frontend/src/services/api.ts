import { supabase } from './supabase';
import { useAuthStore } from '../store/useAuthStore';

const MAX_INLINE_UPLOAD_BYTES = 12 * 1024 * 1024;

const response = <T>(data: T) => ({ data });

const createApiError = (detail: string) => ({
  response: {
    data: {
      detail,
    },
  },
});

const getCurrentUser = () => {
  const user = useAuthStore.getState().user;
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
};

const sortChannels = (channels: any[] = []) =>
  [...channels].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'text' ? -1 : 1;
    }
    return (left.created_at || '').localeCompare(right.created_at || '') || (left.name || '').localeCompare(right.name || '');
  });

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read file'));
    };

    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const getFormFile = (body: unknown) => {
  if (!(body instanceof FormData)) {
    throw new Error('Expected a file upload payload');
  }

  const file = body.get('file');
  if (!(file instanceof File)) {
    throw new Error('Upload payload is missing a file');
  }

  return file;
};

const findExistingDmChannelId = async (userAId: number, userBId: number) => {
  const { data: memberships, error } = await supabase
    .from('user_dm_channel')
    .select('channel_id, user_id')
    .in('user_id', [userAId, userBId]);

  if (error) {
    throw new Error(error.message);
  }

  const channelMembers = new Map<number, Set<number>>();
  for (const membership of memberships || []) {
    const members = channelMembers.get(membership.channel_id) || new Set<number>();
    members.add(membership.user_id);
    channelMembers.set(membership.channel_id, members);
  }

  const candidateIds = [...channelMembers.entries()]
    .filter(([, members]) => members.has(userAId) && members.has(userBId))
    .map(([channelId]) => channelId);

  if (candidateIds.length === 0) {
    return null;
  }

  const { data: channels, error: channelsError } = await supabase
    .from('channels')
    .select('id')
    .in('id', candidateIds)
    .eq('is_dm', true)
    .order('id', { ascending: true })
    .limit(1);

  if (channelsError) {
    throw new Error(channelsError.message);
  }

  return channels?.[0]?.id ?? null;
};

export const api = {
  get: async (url: string) => {
    try {
      if (url === '/users/me') {
        const token = useAuthStore.getState().token;
        if (!token) {
          throw new Error('No token');
        }

        const { data, error } = await supabase.from('users').select('*').eq('id', parseInt(token, 10)).single();
        if (error) {
          throw new Error(error.message);
        }

        return response(data);
      }

      if (url === '/servers/') {
        const currentUser = getCurrentUser();
        const { data, error } = await supabase
          .from('user_server')
          .select('server_id, servers(*, channels(*))')
          .eq('user_id', currentUser.id);

        if (error) {
          throw new Error(error.message);
        }

        const servers = (data || []).map((record: any) => ({
          ...record.servers,
          channels: sortChannels(record.servers?.channels || []),
        }));

        return response(servers);
      }

      if (url === '/friends/dms') {
        const currentUser = getCurrentUser();
        const { data: memberships, error } = await supabase
          .from('user_dm_channel')
          .select('channel_id, channels(*)')
          .eq('user_id', currentUser.id);

        if (error) {
          throw new Error(error.message);
        }

        const dmChannels = (memberships || [])
          .map((membership: any) => membership.channels)
          .filter((channel: any) => channel?.is_dm);

        if (dmChannels.length === 0) {
          return response([]);
        }

        const channelIds = dmChannels.map((channel: any) => channel.id);
        const { data: peersByChannel, error: peersError } = await supabase
          .from('user_dm_channel')
          .select('channel_id, user_id')
          .in('channel_id', channelIds)
          .neq('user_id', currentUser.id);

        if (peersError) {
          throw new Error(peersError.message);
        }

        const peerIds = [...new Set((peersByChannel || []).map((row) => row.user_id))];
        const { data: peerUsers, error: peerUsersError } = peerIds.length
          ? await supabase.from('users').select('id, username, avatar_url').in('id', peerIds)
          : { data: [], error: null as { message?: string } | null };

        if (peerUsersError) {
          throw new Error(peerUsersError.message || 'Failed to load DM users');
        }

        const peerById = new Map((peerUsers || []).map((peer) => [peer.id, peer]));
        const channels = dmChannels.map((channel: any) => {
          const peerLink = (peersByChannel || []).find((row) => row.channel_id === channel.id);
          const peer = peerLink ? peerById.get(peerLink.user_id) || null : null;

          return {
            ...channel,
            name: peer?.username || channel.name || 'Direct Message',
            peer,
          };
        });

        return response(channels);
      }

      if (url === '/friends/incoming') {
        const currentUser = getCurrentUser();
        const { data, error } = await supabase
          .from('friend_requests')
          .select('id, status, from_user_id, from_user:users!friend_requests_from_user_id_fkey(id, username, avatar_url)')
          .eq('to_phone', currentUser.username)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        const requests = (data || []).map((request: any) => ({
          id: request.id,
          status: request.status,
          from_user_id: request.from_user_id,
          from_user: request.from_user,
        }));

        return response(requests);
      }

      if (url.startsWith('/messages/')) {
        const channelId = parseInt(url.split('/').pop() || '0', 10);
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:users(username, avatar_url)')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true });

        if (error) {
          throw new Error(error.message);
        }

        return response(data || []);
      }

      if (url.startsWith('/users/search')) {
        const currentUser = getCurrentUser();
        const query = new URLSearchParams(url.split('?')[1]).get('query')?.trim();

        if (!query) {
          return response([]);
        }

        const { data, error } = await supabase
          .from('users')
          .select('id, username, phone, avatar_url')
          .ilike('username', `%${query}%`)
          .neq('id', currentUser.id)
          .limit(10);

        if (error) {
          throw new Error(error.message);
        }

        return response(data || []);
      }

      console.warn('[API Wrapper] Unhandled GET:', url);
      return response(null);
    } catch (error) {
      console.error('[API Wrapper Error]', error);
      throw error;
    }
  },

  post: async (url: string, body?: any) => {
    try {
      if (url === '/auth/register') {
        const username = body?.username?.trim();
        const password = body?.password;

        if (!username || !password) {
          throw new Error('Username and password are required');
        }

        if (username.length < 3) {
          throw createApiError('Username must be at least 3 characters long');
        }

        if (password.length < 4) {
          throw createApiError('Password must be at least 4 characters long');
        }

        const { data: existingUser, error: existingUserError } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (existingUserError) {
          throw new Error(existingUserError.message);
        }

        if (existingUser) {
          throw createApiError('Username already taken');
        }

        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ username, password, phone: username }])
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        return response({ access_token: newUser.id.toString(), token_type: 'bearer', user: newUser });
      }

      if (url === '/auth/login') {
        const username = body?.username?.trim();
        const password = body?.password;

        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!user) {
          throw createApiError('Invalid username or password');
        }

        return response({ access_token: user.id.toString(), token_type: 'bearer', user });
      }

      if (url === '/servers/') {
        const currentUser = getCurrentUser();
        const name = body?.name?.trim();
        const iconUrl = body?.icon_url?.trim() || null;

        if (!name) {
          throw createApiError('Server name is required');
        }

        const { data: server, error: serverError } = await supabase
          .from('servers')
          .insert([{ name, icon_url: iconUrl, owner_id: currentUser.id }])
          .select()
          .single();

        if (serverError) {
          throw new Error(serverError.message);
        }

        const { error: membershipError } = await supabase
          .from('user_server')
          .insert([{ user_id: currentUser.id, server_id: server.id }]);

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .insert([
            { name: 'general', type: 'text', server_id: server.id },
            { name: 'Lounge', type: 'voice', server_id: server.id },
          ])
          .select();

        if (channelsError) {
          throw new Error(channelsError.message);
        }

        return response({
          ...server,
          channels: sortChannels(channels || []),
        });
      }

      if (url.startsWith('/servers/') && url.endsWith('/join')) {
        const serverId = parseInt(url.split('/')[2], 10);
        const currentUser = getCurrentUser();

        const { data: server, error: serverError } = await supabase
          .from('servers')
          .select('id')
          .eq('id', serverId)
          .maybeSingle();

        if (serverError) {
          throw new Error(serverError.message);
        }

        if (!server) {
          throw createApiError('Server not found');
        }

        const { data: existingMembership, error: membershipLookupError } = await supabase
          .from('user_server')
          .select('user_id')
          .eq('user_id', currentUser.id)
          .eq('server_id', serverId)
          .maybeSingle();

        if (membershipLookupError) {
          throw new Error(membershipLookupError.message);
        }

        if (existingMembership) {
          throw createApiError('You already joined this server');
        }

        const { error } = await supabase.from('user_server').insert([{ user_id: currentUser.id, server_id: serverId }]);
        if (error) {
          throw new Error(error.message);
        }

        return response({ message: 'Joined' });
      }

      if (url.startsWith('/friends/request/')) {
        const targetUserId = parseInt(url.split('/').pop() || '0', 10);
        const currentUser = getCurrentUser();

        if (targetUserId === currentUser.id) {
          throw createApiError('You cannot add yourself');
        }

        const { data: targetUser, error: targetUserError } = await supabase
          .from('users')
          .select('id, username')
          .eq('id', targetUserId)
          .maybeSingle();

        if (targetUserError) {
          throw new Error(targetUserError.message);
        }

        if (!targetUser) {
          throw createApiError('User not found');
        }

        const { data: existingRequest, error: existingRequestError } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('from_user_id', currentUser.id)
          .eq('to_phone', targetUser.username)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingRequestError) {
          throw new Error(existingRequestError.message);
        }

        if (existingRequest) {
          throw createApiError('Friend request already sent');
        }

        const existingDmChannelId = await findExistingDmChannelId(currentUser.id, targetUserId);
        if (existingDmChannelId) {
          throw createApiError('You already have a DM with this user');
        }

        const { error } = await supabase
          .from('friend_requests')
          .insert([{ from_user_id: currentUser.id, to_phone: targetUser.username }]);

        if (error) {
          throw new Error(error.message);
        }

        return response({ message: 'Sent' });
      }

      if (url.startsWith('/friends/decline/')) {
        const requestId = parseInt(url.split('/')[3], 10);
        const currentUser = getCurrentUser();

        const { error } = await supabase
          .from('friend_requests')
          .update({ status: 'declined' })
          .eq('id', requestId)
          .eq('to_phone', currentUser.username);

        if (error) {
          throw new Error(error.message);
        }

        return response({ message: 'Declined' });
      }

      if (url.startsWith('/friends/accept/')) {
        const requestId = parseInt(url.split('/')[3], 10);
        const currentUser = getCurrentUser();

        const { data: request, error: requestError } = await supabase
          .from('friend_requests')
          .select()
          .eq('id', requestId)
          .eq('to_phone', currentUser.username)
          .eq('status', 'pending')
          .single();

        if (requestError) {
          throw new Error(requestError.message);
        }

        let channelId = await findExistingDmChannelId(currentUser.id, request.from_user_id);

        if (!channelId) {
          const { data: channel, error: channelError } = await supabase
            .from('channels')
            .insert([{ is_dm: true, name: 'Direct Message' }])
            .select()
            .single();

          if (channelError) {
            throw new Error(channelError.message);
          }

          channelId = channel.id;

          const { error: membershipsError } = await supabase.from('user_dm_channel').insert([
            { user_id: currentUser.id, channel_id: channelId },
            { user_id: request.from_user_id, channel_id: channelId },
          ]);

          if (membershipsError) {
            throw new Error(membershipsError.message);
          }
        }

        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)
          .eq('status', 'pending');

        if (updateError) {
          throw new Error(updateError.message);
        }

        return response({ message: 'Accepted', channel_id: channelId });
      }

      if (url === '/media/upload') {
        const file = getFormFile(body);

        if (file.size === 0) {
          throw createApiError('The selected file is empty');
        }

        if (file.size > MAX_INLINE_UPLOAD_BYTES) {
          throw createApiError('The selected file is too large. Keep uploads under 12 MB.');
        }

        const dataUrl = await fileToDataUrl(file);
        return response({
          url: dataUrl,
          filename: file.name || 'attachment',
          mime: file.type || 'application/octet-stream',
          size: file.size,
        });
      }

      console.warn('[API Wrapper] Unhandled POST:', url);
      return response(null);
    } catch (error) {
      console.error('[API Wrapper Error]', error);
      throw error;
    }
  },

  delete: async (url: string) => {
    try {
      if (url.startsWith('/messages/')) {
        const messageId = parseInt(url.split('/').pop() || '0', 10);
        const currentUser = getCurrentUser();

        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId)
          .eq('sender_id', currentUser.id);

        if (error) {
          throw new Error(error.message);
        }

        return response({ message: 'Deleted' });
      }

      console.warn('[API Wrapper] Unhandled DELETE:', url);
      return response(null);
    } catch (error) {
      console.error('[API Wrapper Error]', error);
      throw error;
    }
  },
};

export default api;
