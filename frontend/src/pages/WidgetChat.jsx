import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, User, Send, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function TypingIndicator() {
  return (
    <div className="message-row ai">
      <div className="message-avatar ai"><Bot size={12} color="#64748b" /></div>
      <div className="typing-bubble">
        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
      </div>
    </div>
  );
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
      .then(({ data }) => setBusiness(data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setMessages((p) => [...p, { type: 'human', content: text }]);
    setInput('');
    setIsTyping(true);
    try {
      const { data } = await axios.post(`${API_BASE}/widget/${token}/chat`, null, {
        params: { session_id: sessionId.current, message: text },
      });
      setMessages((p) => [...p, { type: 'ai', content: data.response }]);
    } catch {
      setMessages((p) => [...p, { type: 'ai', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!token) {
    return (
      <div className="widget-page">
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Missing token parameter.
        </div>
      </div>
    );
  }

  return (
    <div className="widget-page">
      {/* Widget header */}
      <div className="widget-header">
        <div className="widget-header-icon">
          <Zap size={14} color="white" fill="white" />
        </div>
        <div>
          <div className="widget-header-name">{business?.name || 'AI Assistant'}</div>
          <div className="widget-header-status">
            <span className="online-dot" />Online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="widget-messages">
        {messages.length === 0 && (
          <div className="widget-empty">
            <Bot size={28} color="var(--accent)" />
            <p>Hi! I'm your AI assistant. How can I help you today?</p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              className={`message-row ${m.type}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`message-avatar ${m.type}`}>
                {m.type === 'human'
                  ? <User size={11} color="white" />
                  : <Bot size={11} color="#64748b" />}
              </div>
              <div className={`message-bubble ${m.type}`}>
                {m.type === 'ai'
                  ? <div className="markdown-content"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  : m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="widget-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
