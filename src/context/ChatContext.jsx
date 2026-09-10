import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { streamCompletion, stopAllPods as stopAllPodsService, fetchPods } from '../services/runpodService';

const ChatContext = createContext(null);

const STORAGE_KEYS = {
  CHATS: 'runpod_ai_studio_chats',
  ACTIVE_CHAT: 'runpod_ai_studio_active_chat',
  SETTINGS: 'runpod_ai_studio_settings'
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  endpointId: '',
  podId: '',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '',
  completionMode: false,
  activeModel: ''
};

const WELCOME_MESSAGE = {
  id: 'msg_1',
  role: 'assistant',
  content: `Willkommen bei **Runpod AI Studio**! 🚀\n\nTrage deinen Runpod-API-Schlüssel in den Einstellungen ein, um deine aktiven Runpod-Modelle und Server automatisch zu verbinden.`,
  timestamp: Date.now()
};

const DEFAULT_CHAT = {
  id: 'chat_' + Date.now(),
  title: 'Neue Unterhaltung',
  messages: [WELCOME_MESSAGE],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

export const ChatProvider = ({ children }) => {
  // 1. Settings State with localStorage persistence
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
      return DEFAULT_SETTINGS;
    }
  });

  // 2. Chats State with localStorage persistence
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load chats from localStorage:', e);
    }

    const hasApiKey = settings?.apiKey && settings.apiKey.trim();
    return [{
      id: 'chat_' + Date.now(),
      title: 'Neue Unterhaltung',
      messages: hasApiKey ? [] : [WELCOME_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
  });

  // 3. Active Chat ID State
  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT);
      if (saved && chats.some(c => c.id === saved)) {
        return saved;
      }
    } catch (e) {
      console.error('Failed to load activeChatId from localStorage:', e);
    }
    return chats[0]?.id || DEFAULT_CHAT.id;
  });

  // 4. Pods state & Server Status State ('RUNNING' | 'STOPPED' | 'STARTING' | 'STOPPING' | 'PAUSED' | 'KEY_REQUIRED' | 'OFFLINE')
  const [pods, setPods] = useState([]);
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [serverStatus, setServerStatus] = useState(() => {
    return settings.apiKey && settings.apiKey.trim() ? 'STOPPED' : 'KEY_REQUIRED';
  });

  // 5. Stream Generating State
  const [isGenerating, setIsGenerating] = useState(false);

  // Ref to hold active stream abort function
  const activeAbortRef = useRef(null);

  // Sync settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [settings]);

  // Sync chats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    } catch (e) {
      console.error('Failed to save chats to localStorage:', e);
    }
  }, [chats]);

  // Sync activeChatId to localStorage
  useEffect(() => {
    try {
      if (activeChatId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, activeChatId);
      }
    } catch (e) {
      console.error('Failed to save activeChatId to localStorage:', e);
    }
  }, [activeChatId]);

  // Helper to refresh pods list & active pod status
  const refreshPodsAndStatus = useCallback(async () => {
    if (!settings.apiKey || !settings.apiKey.trim()) {
      setServerStatus('KEY_REQUIRED');
      try {
        const result = await fetchPods('');
        if (result.connectionError) {
          setIsServerConnected(false);
          setPods([]);
          return;
        }
        setIsServerConnected(true);
        setPods(result.pods || []);
      } catch (err) {
        setIsServerConnected(false);
        setPods([]);
      }
      return;
    }

    try {
      const result = await fetchPods(settings.apiKey);
      if (result.connectionError) {
        setIsServerConnected(false);
        setPods([]);
        setServerStatus('OFFLINE');
        return;
      }

      setIsServerConnected(true);
      const fetchedPods = result.pods || [];
      setPods(fetchedPods);

      if (fetchedPods.length > 0) {
        const activePodsCount = fetchedPods.filter(p => p.status === 'RUNNING' || p.status === 'STARTING').length;
        if (activePodsCount > 0) {
          setServerStatus('RUNNING');
        } else {
          setServerStatus('STOPPED');
        }

        const targetPod = fetchedPods.find(p => p.id === settings.podId);
        if (!targetPod && fetchedPods.length > 0) {
          const runningPod = fetchedPods.find(p => p.status === 'RUNNING') || fetchedPods[0];
          setSettings(prev => ({ ...prev, podId: runningPod.id, activeModel: runningPod.modelTag || runningPod.name }));
        }
      } else {
        setServerStatus('STOPPED');
      }
    } catch (err) {
      console.warn('Error refreshing pods:', err);
      setIsServerConnected(false);
      setPods([]);
      setServerStatus('OFFLINE');
    }
  }, [settings.apiKey, settings.podId]);

  // Always start with a fresh new conversation when web app initializes
  useEffect(() => {
    const hasApiKey = settings?.apiKey && settings.apiKey.trim();
    const freshChat = {
      id: 'chat_' + Date.now(),
      title: 'Neue Unterhaltung',
      messages: hasApiKey ? [] : [WELCOME_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setChats(prev => [freshChat, ...prev.filter(c => c.messages && c.messages.length > 0)]);
    setActiveChatId(freshChat.id);
  }, []);

  // Periodically refresh pods and live pod status every 5 seconds or on settings change
  useEffect(() => {
    refreshPodsAndStatus();
    const intervalId = setInterval(refreshPodsAndStatus, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshPodsAndStatus]);

  // Send periodic heartbeat to keep the Express app server alive while UI tab is open
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 3000);
    return () => clearInterval(interval);
  }, []);

  // Derived current active chat object
  const activeChat = chats.find(c => c.id === activeChatId) || chats[0] || null;

  // Function to create a new chat session
  const createNewChat = useCallback(() => {
    const hasApiKey = settings?.apiKey && settings.apiKey.trim();
    const newChat = {
      id: 'chat_' + Date.now(),
      title: 'Neue Unterhaltung',
      messages: hasApiKey ? [] : [WELCOME_MESSAGE],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setChats(prevChats => [newChat, ...prevChats]);
    setActiveChatId(newChat.id);
    return newChat.id;
  }, [settings?.apiKey]);

  // Function to delete a chat session
  const deleteChat = useCallback((chatId) => {
    setChats(prevChats => {
      const filtered = prevChats.filter(c => c.id !== chatId);
      if (filtered.length === 0) {
        const freshChat = {
          id: 'chat_' + Date.now(),
          title: 'Neue Unterhaltung',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setActiveChatId(freshChat.id);
        return [freshChat];
      }
      
      if (activeChatId === chatId) {
        setActiveChatId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeChatId]);

  // Function to rename a chat session
  const renameChat = useCallback((chatId, newTitle) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId
          ? { ...chat, title: trimmed, updatedAt: Date.now() }
          : chat
      )
    );
  }, []);

  // Function to update settings state
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Simple Stop All Pods function
  const stopAllPods = useCallback(async () => {
    if (!settings.apiKey || !settings.apiKey.trim()) {
      setServerStatus('KEY_REQUIRED');
      return { success: false, message: 'API-Schlüssel fehlt' };
    }

    setServerStatus('STOPPING');
    const result = await stopAllPodsService(settings.apiKey);
    
    // Immediately set local pods state to STOPPED for instant visual feedback
    setPods(prevPods => prevPods.map(p => ({ ...p, status: 'STOPPED', desiredStatus: 'STOPPED' })));
    setServerStatus('STOPPED');

    setTimeout(() => {
      refreshPodsAndStatus();
    }, 2500);
    return result;
  }, [settings.apiKey, refreshPodsAndStatus]);

  // Helper to run streaming AI response completion
  const triggerStreamCompletion = useCallback(({ chatId, targetMessages, userPrompt }) => {
    if (activeAbortRef.current) {
      activeAbortRef.current();
      activeAbortRef.current = null;
    }

    setIsGenerating(true);

    const abortFn = streamCompletion(
      {
        prompt: userPrompt,
        messages: targetMessages,
        model: settings.activeModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        apiKey: settings.apiKey,
        endpointId: settings.endpointId,
        podId: settings.podId,
        systemPrompt: settings.systemPrompt,
        completionMode: settings.completionMode
      },
      (chunk) => {
        // Real-time chunk append to assistant message
        setChats(prevChats =>
          prevChats.map(chat => {
            if (chat.id !== chatId) return chat;

            const updatedMessages = [...chat.messages];
            const lastMsgIndex = updatedMessages.length - 1;

            if (lastMsgIndex >= 0 && updatedMessages[lastMsgIndex].role === 'assistant') {
              updatedMessages[lastMsgIndex] = {
                ...updatedMessages[lastMsgIndex],
                content: updatedMessages[lastMsgIndex].content + chunk
              };
            }

            return {
              ...chat,
              messages: updatedMessages,
              updatedAt: Date.now()
            };
          })
        );
      },
      (error) => {
        console.error('Streaming completion error:', error);
      },
      () => {
        setIsGenerating(false);
      }
    );

    activeAbortRef.current = abortFn;
  }, [settings]);

  // Function to send a new user message
  const sendMessage = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;

    const currentChat = activeChat;
    if (!currentChat) return;

    const chatId = currentChat.id;
    const userMsg = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    const assistantMsg = {
      id: 'msg_a_' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    // Auto-generate title if title is default
    const shouldAutoTitle = currentChat.messages.length === 0 || currentChat.title === 'Neue Unterhaltung' || currentChat.title === 'New Conversation';
    const autoTitle = shouldAutoTitle
      ? (trimmed.length > 32 ? trimmed.substring(0, 32) + '...' : trimmed)
      : currentChat.title;

    const newMessages = [...currentChat.messages, userMsg, assistantMsg];

    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              title: autoTitle,
              messages: newMessages,
              updatedAt: Date.now()
            }
          : chat
      )
    );

    triggerStreamCompletion({
      chatId,
      targetMessages: newMessages.slice(0, -1),
      userPrompt: trimmed
    });
  }, [activeChat, isGenerating, triggerStreamCompletion]);

  // Function to edit a user message (by index or message ID), truncate subsequent messages, and resubmit
  const editPrompt = useCallback((targetIndexOrId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed || isGenerating || !activeChat) return;

    const chatId = activeChat.id;
    const existingMessages = activeChat.messages;

    let messageIndex = typeof targetIndexOrId === 'number'
      ? targetIndexOrId
      : existingMessages.findIndex(m => m.id === targetIndexOrId);

    if (messageIndex < 0 || messageIndex >= existingMessages.length) return;

    // Truncate history up to messageIndex
    const truncatedHistory = existingMessages.slice(0, messageIndex);

    const updatedUserMsg = {
      ...existingMessages[messageIndex],
      content: trimmed,
      timestamp: Date.now()
    };

    const newAssistantMsg = {
      id: 'msg_a_' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    const newMessages = [...truncatedHistory, updatedUserMsg, newAssistantMsg];

    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: newMessages, updatedAt: Date.now() }
          : chat
      )
    );

    triggerStreamCompletion({
      chatId,
      targetMessages: newMessages.slice(0, -1),
      userPrompt: trimmed
    });
  }, [activeChat, isGenerating, triggerStreamCompletion]);

  // Function to regenerate response from assistantMessageIndex or message ID
  const regenerateResponse = useCallback((targetIndexOrId) => {
    if (isGenerating || !activeChat) return;

    const chatId = activeChat.id;
    const existingMessages = activeChat.messages;

    let assistantMessageIndex = typeof targetIndexOrId === 'number'
      ? targetIndexOrId
      : existingMessages.findIndex(m => m.id === targetIndexOrId);

    if (assistantMessageIndex < 0 || assistantMessageIndex >= existingMessages.length) return;

    // Truncate history up to assistantMessageIndex
    const truncatedHistory = existingMessages.slice(0, assistantMessageIndex);

    // Find previous user message prompt
    let userPrompt = '';
    for (let i = truncatedHistory.length - 1; i >= 0; i--) {
      if (truncatedHistory[i].role === 'user') {
        userPrompt = truncatedHistory[i].content;
        break;
      }
    }

    if (!userPrompt) return;

    const newAssistantMsg = {
      id: 'msg_a_' + Date.now(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    const newMessages = [...truncatedHistory, newAssistantMsg];

    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: newMessages, updatedAt: Date.now() }
          : chat
      )
    );

    triggerStreamCompletion({
      chatId,
      targetMessages: truncatedHistory,
      userPrompt
    });
  }, [activeChat, isGenerating, triggerStreamCompletion]);

  const regenerateLastResponse = useCallback(() => {
    if (!activeChat || !activeChat.messages || activeChat.messages.length === 0) return;
    const lastIndex = activeChat.messages.length - 1;
    regenerateResponse(lastIndex);
  }, [activeChat, regenerateResponse]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        serverStatus,
        isServerConnected,
        pods,
        refreshPods: refreshPodsAndStatus,
        isGenerating,
        settings,
        createNewChat,
        deleteChat,
        renameChat,
        selectChat: setActiveChatId,
        sendMessage,
        editPrompt,
        regenerateResponse,
        regenerateLastResponse,
        stopAllPods,
        toggleServerStatus: stopAllPods,
        updateSettings
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  return context || {};
};
