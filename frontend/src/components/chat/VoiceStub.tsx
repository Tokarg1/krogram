import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Mic, MicOff, Settings, PhoneOff, Users } from 'lucide-react';
import { Channel } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import './VoiceStub.css';

interface VoiceParticipant {
  user_id: number;
  username: string;
}

const VoiceStub = ({ channel }: { channel: Channel }) => {
  const { user } = useAuthStore();
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const voiceChannelRef = useRef<any>(null);

  const syncParticipants = () => {
    const state = voiceChannelRef.current?.presenceState?.() || {};
    const nextParticipants: VoiceParticipant[] = Object.values(state)
      .flatMap((entries: any) => entries as VoiceParticipant[])
      .map((entry) => ({
        user_id: entry.user_id,
        username: entry.username,
      }))
      .filter((participant, index, list) => list.findIndex((item) => item.user_id === participant.user_id) === index);

    setParticipants(nextParticipants);
  };

  const leaveVoiceChannel = async () => {
    if (voiceChannelRef.current) {
      try {
        await voiceChannelRef.current.untrack();
      } catch (error) {
        console.error('Voice untrack failed:', error);
      }

      await supabase.removeChannel(voiceChannelRef.current);
      voiceChannelRef.current = null;
    }

    setInChannel(false);
    setParticipants((value) => value.filter((participant) => participant.user_id !== user?.id));
  };

  const joinVoiceChannel = async () => {
    if (!user || voiceChannelRef.current) {
      return;
    }

    const voiceChannel = supabase.channel(`voice-room:${channel.id}`, {
      config: {
        presence: {
          key: user.id.toString(),
        },
      },
    });

    voiceChannelRef.current = voiceChannel;
    voiceChannel.on('presence', { event: 'sync' }, syncParticipants);

    voiceChannel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await voiceChannel.track({
          user_id: user.id,
          username: user.username,
        });
        setInChannel(true);
      }
    });
  };

  useEffect(() => {
    return () => {
      void leaveVoiceChannel();
    };
  }, []);

  return (
    <div className="voice-container">
      <div className="voice-header glass-panel">
        <Volume2 size={48} className="voice-icon" />
        <h2>{channel.name}</h2>
        <p>{participants.length} users active</p>
      </div>

      <div className="voice-room-note glass-panel">
        <Users size={18} />
        <span>Realtime room presence is live. Multi-user voice media is the next layer to wire on top.</span>
      </div>

      <div className="voice-participants scroller">
        <AnimatePresence>
          {participants.map((participant) => (
            <motion.div
              key={participant.user_id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="participant-card"
            >
              <div className="avatar-large">{participant.username[0]?.toUpperCase() || 'U'}</div>
              <span>{participant.username}</span>
              {participant.user_id === user?.id && <small>You</small>}
            </motion.div>
          ))}
          {participants.length === 0 && !inChannel && <p className="empty-msg">No one is here yet. Join the room and make some noise.</p>}
        </AnimatePresence>
      </div>

      <div className="voice-footer glass-panel">
        <div className="device-status">
          <button className={`status-btn ${isMuted ? 'active' : ''}`} onClick={() => setIsMuted((value) => !value)}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button className="status-btn">
            <Settings size={20} />
          </button>
        </div>

        <button onClick={() => void (inChannel ? leaveVoiceChannel() : joinVoiceChannel())} className={`join-btn ${inChannel ? 'btn-red' : 'btn-green'}`}>
          {inChannel ? <PhoneOff size={24} /> : <PhoneOff size={24} style={{ transform: 'rotate(135deg)' }} />}
          {inChannel ? 'Leave Room' : 'Join Voice'}
        </button>
      </div>
    </div>
  );
};

export default VoiceStub;
