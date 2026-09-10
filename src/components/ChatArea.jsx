import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../context/ChatContext';
import {
  Send,
  Square,
  RotateCw,
  Edit3,
  Copy,
  Check,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Brain,
  Code2
} from 'lucide-react';

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'relative',
      margin: '12px 0',
      borderRadius: 'var(--radius-md, 10px)',
      overflow: 'hidden',
      border: '1px solid var(--border-color, #262936)',
      backgroundColor: '#0d0e14'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid var(--border-subtle, #1b1e2a)',
        fontSize: '12px',
        color: 'var(--text-muted, #6b7280)',
        fontFamily: 'var(--font-mono, monospace)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Code2 size={13} color="#a78bfa" />
          <span>{language}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11.5px',
            color: copied ? '#10b981' : 'var(--text-secondary, #9ca3af)',
            backgroundColor: 'transparent',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle, #1b1e2a)'
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
        </button>
      </div>

      <pre style={{
        margin: 0,
        padding: '12px 14px',
        overflowX: 'auto',
        fontSize: '13.5px',
        fontFamily: 'var(--font-mono, monospace)',
        lineHeight: 1.5,
        color: '#e2e8f0'
      }}>
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

export const ChatArea = ({
  messages: propMessages,
  isGenerating: propIsGenerating,
  selectedModel: propSelectedModel,
  onSendMessage,
  onStopGeneration,
  onRegenerateMessage,
  onEditPrompt
}) => {
  const chatContext = useChat();

  const activeChat = chatContext?.activeChat;
  const messages = propMessages || activeChat?.messages || [];
  const isGenerating = propIsGenerating ?? chatContext?.isGenerating ?? false;
  const selectedModel = propSelectedModel || chatContext?.settings?.activeModel || '';

  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  const handleCopyMessage = (msgId, content) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  const handleTextareaInput = (e) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 400)}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  const sendPrompt = () => {
    if (inputText.trim() && !isGenerating) {
      if (onSendMessage) {
        onSendMessage(inputText.trim());
      } else if (chatContext?.sendMessage) {
        chatContext.sendMessage(inputText.trim());
      }
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const startEditing = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
  };

  const saveEditAndResend = (msgId) => {
    if (editText.trim()) {
      if (onEditPrompt) {
        onEditPrompt(msgId, editText.trim());
      } else if (chatContext?.editPrompt) {
        chatContext.editPrompt(msgId, editText.trim());
      }
      setEditingMessageId(null);
      setEditText('');
    }
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const toggleReasoning = (msgId) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - var(--header-height, 64px))',
      backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Messages Scroll Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '800px' }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '65vh',
              textAlign: 'center'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                <Sparkles size={22} color="#a78bfa" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-secondary, #9ca3af)', margin: 0 }}>
                Wie kann ich dir helfen?
              </h2>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isEditingThis = editingMessageId === msg.id;

              return (
                <div
                  key={msg.id || index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    marginBottom: '20px',
                    width: '100%'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                    fontSize: '12px',
                    color: 'var(--text-muted, #6b7280)'
                  }}>
                    {isUser ? (
                      <>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary, #9ca3af)' }}>Du</span>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-card-hover, #1e2130)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-color, #262936)'
                        }}>
                          <User size={12} color="var(--text-secondary, #9ca3af)" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '5px',
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Bot size={12} color="#ffffff" />
                        </div>
                        <span style={{ fontWeight: 600, color: '#a78bfa' }}>
                          {msg.model || selectedModel}
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ maxWidth: '88%', position: 'relative', minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-word', overflow: 'hidden' }}>
                    {isEditingThis ? (
                      <div className="glass-card" style={{
                        padding: '12px',
                        width: '100%',
                        minWidth: '300px',
                        borderColor: '#8b5cf6'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', marginBottom: '6px' }}>
                          Prompt bearbeiten:
                        </div>
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            backgroundColor: 'var(--bg-obsidian, #0a0b0e)',
                            border: '1px solid var(--border-color, #262936)',
                            borderRadius: 'var(--radius-sm, 6px)',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              borderRadius: 'var(--radius-sm, 6px)',
                              color: 'var(--text-secondary, #9ca3af)',
                              backgroundColor: 'var(--bg-card, #161822)'
                            }}
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditAndResend(msg.id)}
                            style={{
                              padding: '4px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm, 6px)',
                              color: '#ffffff',
                              backgroundColor: '#8b5cf6'
                            }}
                          >
                            Speichern & neu senden
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: isUser ? '10px 16px' : '14px 18px',
                          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          backgroundColor: isUser ? 'var(--bg-card-hover, #1e2130)' : 'var(--bg-card, #161822)',
                          border: `1px solid ${isUser ? 'rgba(139, 92, 246, 0.25)' : 'var(--border-color, #262936)'}`,
                          color: 'var(--text-primary, #f3f4f6)',
                          fontSize: '14px',
                          lineHeight: 1.6
                        }}
                      >
                        {!isUser && msg.reasoning && (
                          <div style={{
                            marginBottom: '10px',
                            borderRadius: 'var(--radius-sm, 6px)',
                            backgroundColor: 'rgba(139, 92, 246, 0.08)',
                            border: '1px solid rgba(139, 92, 246, 0.25)',
                            overflow: 'hidden'
                          }}>
                            <button
                              type="button"
                              onClick={() => toggleReasoning(msg.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: '#a78bfa'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brain size={13} />
                                <span>Denkprozess</span>
                              </div>
                              {expandedReasoning[msg.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            {expandedReasoning[msg.id] && (
                              <div style={{
                                padding: '8px 10px',
                                borderTop: '1px solid rgba(139, 92, 246, 0.15)',
                                fontSize: '12px',
                                color: 'var(--text-secondary, #9ca3af)',
                                fontFamily: 'var(--font-mono, monospace)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.5,
                                backgroundColor: 'rgba(10, 11, 14, 0.4)'
                              }}>
                                {msg.reasoning}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="markdown-content">
                          {!isUser && isGenerating && !msg.content ? (
                            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
                          ) : (
                            <>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ _node, inline, className, children, ...props }) {
                                    if (inline) {
                                      return (
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      );
                                    }
                                    return <CodeBlock className={className}>{children}</CodeBlock>;
                                  }
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                              {!isUser && isGenerating && index === messages.length - 1 && (
                                <span style={{ display: 'inline-block', width: '2px', height: '1em', backgroundColor: '#a78bfa', marginLeft: '2px', verticalAlign: 'text-bottom', animation: 'blink 0.8s step-end infinite' }} />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {!isEditingThis && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '3px',
                        justifyContent: isUser ? 'flex-end' : 'flex-start'
                      }}>
                        {isUser ? (
                          <button
                            type="button"
                            onClick={() => startEditing(msg)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: 'var(--text-muted, #6b7280)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            <Edit3 size={11} />
                            <span>Prompt bearbeiten</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              title="Antwort kopieren"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: copiedMsgId === msg.id ? '#10b981' : 'var(--text-muted, #6b7280)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                transition: 'color 0.2s'
                              }}
                            >
                              {copiedMsgId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedMsgId === msg.id ? 'Kopiert!' : 'Kopieren'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (onRegenerateMessage) {
                                  onRegenerateMessage(msg.id);
                                } else if (chatContext?.regenerateResponse) {
                                  chatContext.regenerateResponse(index);
                                } else if (chatContext?.regenerateLastResponse) {
                                  chatContext.regenerateLastResponse();
                                }
                              }}
                              disabled={isGenerating}
                              title="Neu generieren"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: 'var(--text-muted, #6b7280)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              <RotateCw size={11} />
                              <span>Neu generieren</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}



          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '10px 20px 16px 20px',
        display: 'flex',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(10, 11, 14, 0) 0%, rgba(10, 11, 14, 0.9) 30%, rgba(10, 11, 14, 1) 100%)'
      }}>
        <div className="glass-card" style={{
          width: '100%',
          maxWidth: '800px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
          borderColor: 'var(--border-color, #262936)',
          borderRadius: 'var(--radius-lg, 14px)',
          backgroundColor: 'var(--bg-card, #161822)'
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben..."
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '14px',
              lineHeight: 1.5,
              backgroundColor: 'transparent',
              border: 'none',
              resize: 'none',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          />

          {isGenerating ? (
            <button
              type="button"
              onClick={() => {
                if (onStopGeneration) onStopGeneration();
                else chatContext?.stopGeneration?.();
              }}
              title="Stoppen"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md, 8px)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)'
              }}
            >
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={sendPrompt}
              disabled={!inputText.trim()}
              title="Senden"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-md, 8px)',
                backgroundColor: inputText.trim() ? '#8b5cf6' : 'var(--bg-card-hover, #1e2130)',
                color: inputText.trim() ? '#ffffff' : 'var(--text-muted, #6b7280)',
                boxShadow: inputText.trim() ? '0 0 12px rgba(139, 92, 246, 0.4)' : 'none'
              }}
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
