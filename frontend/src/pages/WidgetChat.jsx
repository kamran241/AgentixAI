import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, User, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function WidgetChat() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [business, setBusiness] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const sessionId = useRef(`widget-${Math.random().toString(36).slice(2)}`);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/widget/${token}/info`)
      .then(({ data }) => {
        setBusiness(data);
        const welcome = data.widget_config?.welcome_message || 'Hi! How can I help you today?';
        setMessages([{ type: 'ai', content: welcome }]);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setMessages(p => [...p, { type: 'human', content: text }]);
    setInput('');
    setIsTyping(true);
    try {
      const { data } = await axios.post(`${API_BASE}/widget/${token}/chat`, null, {
        params: { session_id: sessionId.current, message: text },
      });
      const reply = data.response?.trim();
      setMessages(p => [...p, {
        type: 'ai',
        content: reply || "I'm sorry, I couldn't generate a response. Please try again.",
      }]);
    } catch {
      setMessages(p => [...p, { type: 'ai', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!token) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Missing token.</div>
  );

  const wCfg = business?.widget_config || {};
  const accent = wCfg.primary_color || '#6366f1';
  const bgColor = wCfg.bg_color || '#0b0f1a';
  const inputColor = wCfg.input_color || '#111827';
  const accentRgb = accent.startsWith('#') ? hexToRgb(accent) : '99, 102, 241';
  const botName = wCfg.bot_name || business?.name || 'AI Assistant';
  const logoUrl = wCfg.logo_url ? `${API_BASE}${wCfg.logo_url}` : null;

  const styles = {
    page: {
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: `linear-gradient(160deg, rgba(${accentRgb},0.22) 0%, ${bgColor} 28%, ${bgColor} 100%)`,
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.875rem 1.125rem', flexShrink: 0,
      background: accent,
      boxShadow: `0 4px 28px rgba(${accentRgb}, 0.5)`,
    },
    logoImg: { width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' },
    logoFallback: {
      width: 34, height: 34, borderRadius: 8,
      background: `rgba(255,255,255,0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    botName: { fontSize: '0.9rem', fontWeight: 700, color: 'white' },
    status: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)' },
    dot: { width: 6, height: 6, borderRadius: '50%', background: '#4ade80' },
    messages: {
      flex: 1, overflowY: 'auto', padding: '1rem',
      display: 'flex', flexDirection: 'column', gap: '0.625rem',
      background: 'transparent',
    },
    humanRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    aiRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
    humanAvatar: {
      width: 26, height: 26, borderRadius: '50%', background: accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '0.3rem', boxShadow: `0 2px 8px rgba(${accentRgb}, 0.5)`,
    },
    aiAvatar: {
      width: 26, height: 26, borderRadius: '50%', background: '#1e2438',
      border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '0.3rem',
    },
    humanBubble: {
      maxWidth: '78%', padding: '0.625rem 0.875rem', borderRadius: '1rem',
      borderBottomRightRadius: '0.2rem', background: accent, color: 'white',
      fontSize: '0.875rem', lineHeight: 1.55,
      boxShadow: `0 3px 12px rgba(${accentRgb}, 0.4)`,
    },
    aiBubble: {
      maxWidth: '78%', padding: '0.625rem 0.875rem', borderRadius: '1rem',
      borderBottomLeftRadius: '0.2rem',
      background: 'rgba(255,255,255,0.06)',
      border: `1px solid rgba(${accentRgb}, 0.15)`,
      color: '#e2e8f0', fontSize: '0.875rem', lineHeight: 1.55,
      backdropFilter: 'blur(8px)',
    },
    typingBubble: {
      padding: '0.75rem 1rem', borderRadius: '1rem', borderBottomLeftRadius: '0.2rem',
      background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(${accentRgb}, 0.15)`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    },
    inputArea: {
      padding: '0.625rem 0.875rem',
      background: inputColor,
      borderTop: `1px solid rgba(${accentRgb}, 0.2)`,
    },
    inputRow: {
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'rgba(255,255,255,0.08)', borderRadius: '0.75rem',
      border: `1px solid rgba(${accentRgb}, 0.35)`, padding: '0.375rem 0.375rem 0.375rem 0.875rem',
    },
    input: {
      flex: 1, background: 'transparent', border: 'none', outline: 'none',
      color: '#ffffff', fontSize: '0.875rem', padding: '0.375rem 0',
    },
    sendBtn: {
      width: 34, height: 34, borderRadius: '0.5rem', border: 'none',
      background: accent, color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'opacity 0.2s',
      boxShadow: `0 2px 8px rgba(${accentRgb}, 0.4)`,
    },
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        {logoUrl
          ? <img src={logoUrl} alt="logo" style={styles.logoImg} />
          : <div style={styles.logoFallback}><Bot size={16} color="white" /></div>
        }
        <div>
          <div style={styles.botName}>{botName}</div>
          <div style={styles.status}><span style={styles.dot}/>Online</div>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {!business && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', padding: '2rem' }}>
            Loading...
          </div>
        )}
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div key={i}
              style={m.type === 'human' ? styles.humanRow : styles.aiRow}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div style={m.type === 'human' ? styles.humanAvatar : styles.aiAvatar}>
                {m.type === 'human'
                  ? <User size={12} color="white" />
                  : <Bot size={12} color="#64748b" />}
              </div>
              <div style={m.type === 'human' ? styles.humanBubble : styles.aiBubble}>
                {m.type === 'ai'
                  ? <div style={{ color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  : m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div style={styles.aiRow}>
            <div style={styles.aiAvatar}><Bot size={12} color="#64748b"/></div>
            <div style={styles.typingBubble}>
              {[0,1,2].map(i => (
                <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            className="widget-chat-input"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button style={{ ...styles.sendBtn, opacity: (!input.trim() || isTyping) ? 0.5 : 1 }}
            onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}
