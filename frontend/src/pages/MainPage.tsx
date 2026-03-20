import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import ActiveCall from '../components/chat/ActiveCall';
import { callService } from '../services/callService';

import './MainPage.css';

const MainPage = () => {
  const setServers = useChatStore((state) => state.setServers);
  const setCurrentServer = useChatStore((state) => state.setCurrentServer);

  useEffect(() => {
    const initData = async () => {
      try {
        const resp = await api.get('/servers/');
        setServers(resp.data);
        if (resp.data.length > 0) {
          setCurrentServer(resp.data[0]);
        }
      } catch (err) {
        console.error('Failed to load servers:', err);
      }
    };

    initData();
    socketService.connect();
    callService.initializeSignaling();

    return () => socketService.disconnect();
  }, [setServers, setCurrentServer]);

  return (
    <div className="main-app-container">
      <Sidebar />
      <div className="content-area">
        <ChatWindow />
      </div>
      <ActiveCall />
    </div>
  );
};

export default MainPage;
