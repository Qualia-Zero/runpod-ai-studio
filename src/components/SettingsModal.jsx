import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import {
  X,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Sliders,
  Key,
  FileText,
  Save
} from 'lucide-react';

export const SettingsModal = ({
  isOpen,
  onClose,
  settings: propSettings,
  onSaveSettings
}) => {
  const chatContext = useChat();

  const activeSettings = propSettings || chatContext?.settings || {};

  const [temperature, setTemperature] = useState(activeSettings?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(activeSettings?.maxTokens ?? 2048);
  const [apiKey, setApiKey] = useState(activeSettings?.apiKey || '');
  const [podId, setPodId] = useState(activeSettings?.podId || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    activeSettings?.systemPrompt ?? ''
  );
  const [completionMode, setCompletionMode] = useState(
    activeSettings?.completionMode ?? false
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const contextPods = chatContext?.pods || [];

  useEffect(() => {
    if (isOpen) {
      const current = propSettings || chatContext?.settings;
      if (current) {
        setTemperature(current.temperature ?? 0.7);
        setMaxTokens(current.maxTokens ?? 2048);
        setApiKey(current.apiKey || '');
        setPodId(current.podId || '');
        setSystemPrompt(
          current.systemPrompt ?? ''
        );
        setCompletionMode(current.completionMode ?? false);
      }
    }
  }, [isOpen, propSettings, chatContext?.settings]);

  if (!isOpen) return null;

  const trimmedKey = apiKey.trim();
  const isValidApiKey = trimmedKey.length >= 10 && (
    trimmedKey.startsWith('rpd_') ||
    trimmedKey.startsWith('rpa_') ||
    trimmedKey.startsWith('rpd-') ||
    trimmedKey.startsWith('rpa-') ||
    /^[a-zA-Z0-9_-]{10,}$/.test(trimmedKey)
  );


  const handleSave = (e) => {
    e?.preventDefault();
    const updated = {
      temperature,
      maxTokens,
      apiKey,
      podId,
      systemPrompt,
      completionMode
    };

    if (onSaveSettings) {
      onSaveSettings(updated);
    } else if (chatContext?.updateSettings) {
      chatContext.updateSettings(updated);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const getTempLabel = (val) => {
    if (val <= 0.3) return 'Präzise (Code & Fakten)';
    if (val <= 0.9) return 'Ausgewogen (Standard)';
    return 'Kreativ (Storytelling)';
  };

  const presetTokens = [64, 128, 256, 512, 1024, 2048];


  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(5, 6, 8, 0.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-modal-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          border: '1px solid var(--border-color, #262936)',
          borderRadius: 'var(--radius-lg, 16px)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card, #161822)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color, #262936)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa'
            }}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary, #f3f4f6)' }}>
                Studio-Einstellungen
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted, #6b7280)', margin: 0 }}>
                Modellparameter und RunPod-API-Konfiguration
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm, 6px)',
              color: 'var(--text-muted, #6b7280)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Temperature Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f3f4f6)' }}>
                Temperatur (Kreativität)
              </label>
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '13px',
                fontWeight: 600,
                color: '#a78bfa',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)'
              }}>
                {temperature.toFixed(2)}
              </span>
            </div>

            <input
              type="range"
              min="0.00"
              max="2.00"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '6px',
              fontSize: '11.5px',
              color: 'var(--text-muted, #6b7280)'
            }}>
              <span style={{ color: temperature <= 0.3 ? '#a78bfa' : 'inherit' }}>Präzise (0.0)</span>
              <span style={{ color: temperature > 0.3 && temperature <= 0.9 ? '#a78bfa' : 'inherit' }}>Ausgewogen (0.7)</span>
              <span style={{ color: temperature > 0.9 ? '#a78bfa' : 'inherit' }}>Kreativ (1.5 - 2.0)</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
              Aktueller Modus: <strong style={{ color: '#a78bfa' }}>{getTempLabel(temperature)}</strong>
            </div>
          </div>

          {/* Max Tokens Slider & Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f3f4f6)' }}>
                Ausgabe-Tokens (Max. Antwortlänge)
              </label>
              <input
                type="number"
                min="64"
                max="8192"
                step="64"
                value={maxTokens}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setMaxTokens(Math.min(8192, Math.max(64, val)));
                }}
                style={{
                  width: '80px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '3px 6px',
                  backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
                  color: '#a78bfa',
                  border: '1px solid var(--border-color, #262936)'
                }}
              />
            </div>

            <input
              type="range"
              min="64"
              max="8192"
              step="64"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
            />

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {presetTokens.map((tokens) => (
                <button
                  key={tokens}
                  type="button"
                  onClick={() => setMaxTokens(tokens)}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono, monospace)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    backgroundColor: maxTokens === tokens ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-obsidian, #0a0b0e)',
                    color: maxTokens === tokens ? '#a78bfa' : 'var(--text-secondary, #9ca3af)',
                    border: `1px solid ${maxTokens === tokens ? '#8b5cf6' : 'var(--border-color, #262936)'}`
                  }}
                >
                  {tokens}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input & Validation */}
          <div>
            <label style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary, #f3f4f6)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px'
            }}>
              <Key size={15} color="#a78bfa" />
              RunPod-API-Schlüssel
            </label>

            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="rpd_xxxxxxxxxxxxxxxxxxxxxxxx"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono, monospace)',
                  backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
                  border: `1px solid ${apiKey.trim() ? (isValidApiKey ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)') : 'var(--border-color, #262936)'}`,
                  borderRadius: 'var(--radius-sm, 6px)'
                }}
              />

              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #6b7280)',
                  padding: '4px'
                }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              {apiKey.trim().length === 0 ? (
                <span style={{ color: 'var(--text-muted, #6b7280)' }}>
                  Format: <code>rpd_...</code> oder <code>rpa_...</code> (Erforderlich für Pods & Serverless-Endpoints)
                </span>
              ) : isValidApiKey ? (
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Gültiges RunPod-API-Schlüssel-Format
                </span>
              ) : (
                <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} /> Ungültiges Format (muss mit <code>rpd_</code> oder <code>rpa_</code> beginnen)
                </span>
              )}
            </div>
          </div>



          {/* Completion Mode Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm, 6px)',
            backgroundColor: completionMode ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-obsidian, #0a0b0e)',
            border: `1px solid ${completionMode ? 'rgba(139, 92, 246, 0.35)' : 'var(--border-color, #262936)'}`,
            marginBottom: '0'
          }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary, #f3f4f6)', marginBottom: '2px' }}>
                🔧 Completion-Modus (Base-Modelle)
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #6b7280)' }}>
                Sendet rohen Text via <code style={{ backgroundColor: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>/api/generate&nbsp;raw:true</code> — kein Chat-Template. Für GGUF-Base-Modelle.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompletionMode(v => !v)}
              style={{
                width: '42px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: completionMode ? '#8b5cf6' : 'var(--bg-card-hover, #1e2130)',
                border: `1px solid ${completionMode ? '#7c3aed' : 'var(--border-color, #262936)'}`,
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s, border-color 0.2s',
                flexShrink: 0,
                marginLeft: '16px'
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: completionMode ? '20px' : '2px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                transition: 'left 0.2s'
              }} />
            </button>
          </div>

          {/* System Prompt Textarea */}
          <div>
            <label style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary, #f3f4f6)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px'
            }}>
              <FileText size={15} color="#a78bfa" />
              System-Prompt (Anweisungen)
            </label>

            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="System-Anweisung für das Modell eingeben..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                lineHeight: 1.5,
                backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
                border: '1px solid var(--border-color, #262936)',
                borderRadius: 'var(--radius-sm, 6px)',
                resize: 'vertical'
              }}
            />
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #6b7280)', marginTop: '6px', lineHeight: 1.5 }}>
              💡 <strong style={{ color: 'var(--text-secondary, #9ca3af)' }}>Base-Modelle</strong> (z.B. GGUF ohne Instruct) funktionieren am besten <strong style={{ color: 'var(--text-secondary, #9ca3af)' }}>ohne</strong> System-Prompt — leer lassen für reine Text-Vervollständigung. Instruct-Modelle profitieren von einem System-Prompt.
            </p>
          </div>

          {/* Footer Actions */}
          <div style={{
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color, #262936)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary, #9ca3af)',
                border: '1px solid var(--border-color, #262936)',
                backgroundColor: 'transparent'
              }}
            >
              Abbrechen
            </button>

            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '13.5px',
                fontWeight: 600,
                backgroundColor: savedSuccess ? '#10b981' : '#8b5cf6',
                color: '#ffffff',
                boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
              }}
            >
              {savedSuccess ? <Check size={16} /> : <Save size={16} />}
              <span>{savedSuccess ? 'Gespeichert!' : 'Einstellungen speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
