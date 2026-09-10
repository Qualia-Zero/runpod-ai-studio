import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import {
  MessageSquare,
  Plus,
  Search,
  X,
  Edit3,
  Trash2,
  Check,
  Square,
  Loader2
} from 'lucide-react';

export const Sidebar = ({
  isOpen,
  chats: propChats,
  activeChatId: propActiveChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings
}) => {
  const chatContext = useChat();

  const chats = propChats || chatContext?.chats || [];
  const activeChatId = propActiveChatId || chatContext?.activeChatId || '';
  const selectChat = onSelectChat || chatContext?.selectChat || (() => {});
  const newChat = onNewChat || chatContext?.createNewChat || (() => {});
  const renameChat = onRenameChat || chatContext?.renameChat || (() => {});
  const deleteChat = onDeleteChat || chatContext?.deleteChat || (() => {});

  const serverStatus = chatContext?.serverStatus || 'KEY_REQUIRED';
  const stopAllPods = chatContext?.stopAllPods || chatContext?.toggleServerStatus || (() => {});
  const pods = chatContext?.pods || [];
  const hasActivePods = pods.some(p => {
    const s = (p.status || '').toUpperCase();
    return s === 'RUNNING' || s === 'STARTING' || s === 'AKTIV' || s === 'PAUSED' || s === 'BUSY';
  }) || serverStatus === 'RUNNING' || serverStatus === 'STARTING';

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isToggling, setIsToggling] = useState(false);

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditing = (e, chat) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const saveEditing = (e, chatId) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      renameChat(chatId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e, chatId) => {
    e.stopPropagation();
    deleteChat(chatId);
  };

  const handleStopAllClick = async () => {
    if (serverStatus === 'KEY_REQUIRED' || !chatContext?.settings?.apiKey) {
      if (onOpenSettings) onOpenSettings();
      return;
    }
    setIsToggling(true);
    await stopAllPods();
    setTimeout(() => setIsToggling(false), 500);
  };

  return (
    <aside
      className="glass-panel"
      style={{
        width: isOpen ? 'var(--sidebar-width, 280px)' : '0px',
        minWidth: isOpen ? 'var(--sidebar-width, 280px)' : '0px',
        height: 'calc(100vh - var(--header-height, 64px))',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRight: isOpen ? '1px solid var(--border-color, #262936)' : 'none',
        zIndex: 30,
        backgroundColor: 'var(--bg-surface, #111319)'
      }}
    >
      <div style={{
        width: 'var(--sidebar-width, 280px)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px'
      }}>
        {/* Header: Title & New Chat */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px'
        }}>
          <h2 style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary, #f3f4f6)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <MessageSquare size={17} color="#a78bfa" />
            Chat-Verlauf
          </h2>

          <button
            type="button"
            onClick={newChat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <Plus size={15} />
            Neuer Chat
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted, #6b7280)'
            }}
          />
          <input
            type="text"
            placeholder="Suche in Chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 28px 7px 32px',
              fontSize: '13px',
              backgroundColor: 'var(--bg-card, #161822)',
              border: '1px solid var(--border-subtle, #1b1e2a)',
              borderRadius: 'var(--radius-sm, 6px)',
              color: 'var(--text-primary, #f3f4f6)'
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #6b7280)'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Chat Sessions List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '2px',
          marginBottom: '14px'
        }}>
          {filteredChats.length === 0 ? (
            <div style={{
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--text-muted, #6b7280)'
            }}>
              {searchTerm ? 'Keine Chats gefunden' : 'Keine gespeicherten Chats'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const isEditing = editingId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => !isEditing && selectChat(chat.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    backgroundColor: isActive ? 'var(--bg-card-hover, #1e2130)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(139, 92, 246, 0.35)' : 'transparent'}`,
                    cursor: isEditing ? 'default' : 'pointer',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing(e, chat.id);
                          if (e.key === 'Escape') cancelEditing(e);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          fontSize: '13px',
                          padding: '4px 6px',
                          backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
                          border: '1px solid #8b5cf6'
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => saveEditing(e, chat.id)}
                        style={{ color: '#10b981', padding: '2px' }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        style={{ color: 'var(--text-muted, #6b7280)', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: 0,
                        flex: 1
                      }}>
                        <MessageSquare
                          size={14}
                          color={isActive ? '#a78bfa' : 'var(--text-muted, #6b7280)'}
                        />
                        <span style={{
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--text-primary, #f3f4f6)' : 'var(--text-secondary, #9ca3af)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {chat.title}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: isActive ? 1 : 0.6
                      }}>
                        <button
                          type="button"
                          onClick={(e) => startEditing(e, chat)}
                          title="Chat umbenennen"
                          style={{
                            padding: '3px',
                            borderRadius: '4px',
                            color: 'var(--text-muted, #6b7280)'
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, chat.id)}
                          title="Chat löschen"
                          style={{
                            padding: '3px',
                            borderRadius: '4px',
                            color: 'var(--text-muted, #6b7280)'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Simple "Alle Pods stoppen" Button */}
        <button
          type="button"
          onClick={handleStopAllClick}
          disabled={isToggling}
          title="Stoppt alle derzeit aktiven Runpod-Instanzen auf deinem Account"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '11px 14px',
            borderRadius: 'var(--radius-md, 10px)',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: hasActivePods || isToggling ? 'rgba(239, 68, 68, 0.22)' : 'var(--bg-card, #161822)',
            color: hasActivePods || isToggling ? '#f87171' : 'var(--text-muted, #9ca3af)',
            border: `1px solid ${hasActivePods || isToggling ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-color, #262936)'}`,
            cursor: isToggling ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: hasActivePods || isToggling ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none'
          }}
        >
          {isToggling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Square size={14} fill={hasActivePods ? "#f87171" : "none"} color={hasActivePods ? "#f87171" : "#9ca3af"} />
          )}
          <span>
            {isToggling ? 'Stoppe alle Pods...' : 'Alle Pods stoppen'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
