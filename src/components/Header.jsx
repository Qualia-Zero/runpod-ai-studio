import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import {
  Cpu,
  Settings,
  Menu,
  Sparkles,
  ChevronDown,
  Gem,
  Brain,
  WifiOff
} from 'lucide-react';

function getModelIcon(name = '', size = 15, isSelected = false) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gemma')) {
    return <Gem size={size} color={isSelected ? '#38bdf8' : '#06b6d4'} />;
  }
  if (lower.includes('dolphin') || lower.includes('mistral') || lower.includes('24b')) {
    return <Brain size={size} color={isSelected ? '#f472b6' : '#ec4899'} />;
  }
  return <Sparkles size={size} color={isSelected ? '#a78bfa' : '#8b5cf6'} />;
}

function cleanModelName(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^(https?:\/\/)?(huggingface\.co|hf\.co)\//i, '');
  if (str.includes('/')) {
    const parts = str.split('/');
    str = parts[parts.length - 1];
  }
  return str;
}

export const Header = ({
  sidebarOpen,
  onToggleSidebar,
  onOpenSettings
}) => {
  const chatContext = useChat();
  const pods = chatContext?.pods || [];
  const isServerConnected = chatContext?.isServerConnected ?? true;
  const currentPod = pods.find(p => p.id === chatContext?.settings?.podId || (p.modelTag || p.name) === chatContext?.settings?.activeModel) || (pods.length > 0 ? pods[0] : null);
  // Prefer the stored activeModel name (preserves full name like "-migrate") over re-computing from pod
  const rawModelName = chatContext?.settings?.activeModel || (currentPod ? (currentPod.modelTag || currentPod.name) : null);
  const activeModelName = cleanModelName(rawModelName);


  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <header className="glass-panel" style={{
      height: 'var(--header-height, 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 40,
      position: 'relative',
      borderBottom: '1px solid var(--border-color, #262936)',
      backgroundColor: 'var(--bg-glass, rgba(17, 19, 25, 0.75))',
      backdropFilter: 'blur(16px)'
    }}>
      {/* Left Section: Sidebar toggle & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
          aria-label="Toggle Sidebar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm, 6px)',
            backgroundColor: sidebarOpen ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card, #161822)',
            color: sidebarOpen ? 'var(--accent-purple-light, #a78bfa)' : 'var(--text-secondary, #9ca3af)',
            border: `1px solid ${sidebarOpen ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-color, #262936)'}`
          }}
        >
          <Menu size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
          }}>
            <Cpu size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontWeight: 700,
                fontSize: '16px',
                letterSpacing: '-0.02em',
                color: '#ffffff'
              }}>
                Runpod AI Studio
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                PRO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Dynamic Pod / Model Selector */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-label="Select AI Model"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md, 10px)',
            backgroundColor: 'var(--bg-card, #161822)',
            border: `1px solid ${!activeModelName ? 'rgba(239, 68, 68, 0.4)' : dropdownOpen ? '#8b5cf6' : 'var(--border-color, #262936)'}`,
            boxShadow: dropdownOpen ? '0 0 15px rgba(139, 92, 246, 0.2)' : 'none'
          }}
        >
          {!isServerConnected ? (
            <>
              <WifiOff size={16} color="#f87171" />
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#f87171' }}>
                Keine Server-Verbindung
              </span>
            </>
          ) : activeModelName ? (
            <>
              {getModelIcon(activeModelName, 16, true)}
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary, #f3f4f6)' }}>
                {activeModelName}
              </span>
            </>
          ) : (
            <>
              <Sparkles size={16} color="#f87171" />
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#f87171' }}>
                Keine Modelle gefunden
              </span>
            </>
          )}
          <ChevronDown size={14} style={{
            color: 'var(--text-secondary, #9ca3af)',
            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }} />
        </button>

        {dropdownOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
              onClick={() => setDropdownOpen(false)}
            />
            <div
              className="animate-modal-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '320px',
                padding: '8px',
                zIndex: 100,
                backgroundColor: '#161822',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid var(--border-color, #2d3142)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(139, 92, 246, 0.2)'
              }}
            >
              <div style={{
                padding: '4px 8px 8px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted, #6b7280)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Verfügbare Runpod-Modelle
              </div>

              {!isServerConnected ? (
                <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#f87171', margin: 0, lineHeight: 1.45 }}>
                    Der lokale Webserver läuft derzeit nicht im Hintergrund. Bitte starte den Webserver neu, um Modelle abzurufen.
                  </p>
                </div>
              ) : pods.length === 0 ? (
                <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', lineHeight: 1.45 }}>
                    Bitte trage deinen Runpod-API-Schlüssel in den Einstellungen ein, um deine Modelle zu verbinden.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenSettings) onOpenSettings();
                    }}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      backgroundColor: '#8b5cf6',
                      color: '#ffffff'
                    }}
                  >
                    Einstellungen öffnen
                  </button>
                </div>
              ) : (
                pods.map((p) => {
                  const isSelected = currentPod?.id === p.id;
                  // For the active pod, prefer the stored activeModel name (which has full suffix like "-migrate")
                  const modelDisplayName = (isSelected && chatContext?.settings?.activeModel)
                    ? chatContext.settings.activeModel
                    : (p.modelTag || p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        chatContext?.updateSettings?.({ activeModel: modelDisplayName, podId: p.id });
                        setDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm, 6px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.3)' : 'transparent'}`,
                        marginBottom: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        {getModelIcon(modelDisplayName, 16, isSelected)}
                        <div style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? '#a78bfa' : 'var(--text-primary, #f3f4f6)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }} title={modelDisplayName}>
                          {modelDisplayName}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: p.status === 'RUNNING' ? '#10b981' : '#6b7280',
                        marginLeft: '8px'
                      }}>
                        {p.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Section: Settings Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Open Settings"
          aria-label="Open Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm, 6px)',
            backgroundColor: 'var(--bg-card, #161822)',
            color: 'var(--text-secondary, #9ca3af)',
            border: '1px solid var(--border-color, #262936)'
          }}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
