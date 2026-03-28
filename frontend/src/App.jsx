import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Send,
  Settings,
  X,
  FileUp,
  Bot,
  User,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API_BASE = "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(localStorage.getItem("activeSessionId") || `session-${Math.random().toString(36).substr(2, 9)}`);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("activeSessionId", sessionId);
    loadSessionMessages(sessionId);
  }, [sessionId]);

  const loadSessionMessages = async (sid) => {
    try {
      const resp = await axios.get(`${API_BASE}/history/${sid}`);
      if (resp.data.history) {
        setMessages(resp.data.history.map(m => ({
          type: m.role === 'user' ? 'human' : 'ai',
          content: m.content
        })));
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages([]);
      }
    } catch (err) {
      setMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { type: 'human', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const response = await axios.post(`${API_BASE}/chat`, null, {
        params: { session_id: sessionId, message: input }
      });

      const aiMsg = { type: 'ai', content: response.data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'system', content: "Error: Connection lost." }]);
    }
  };

  const startNewChat = () => {
    const newId = `session-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newId);
    setMessages([]);
    setIsSettingsOpen(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await axios.post(`${API_BASE}/ingest-pdf`, formData);
      setBusinessProfile(resp.data.identity);
      startNewChat();
      setMessages([{ type: 'system', content: `Identity Switched: ${resp.data.identity.name}` }]);
    } catch (err) {
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? <Plus size={14} style={{ transform: 'rotate(45deg)' }} /> : <X size={14} />}
        </button>

        <div className="logo-section">
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px var(--accent-glow)',
            flexShrink: 0
          }}>
            <Zap size={20} color="white" fill="white" />
          </div>
          <span style={{ letterSpacing: '1px', fontSize: '1.4rem' }}>BIZBOT</span>
        </div>

        <button className="new-chat-btn" onClick={startNewChat}>
          <Plus size={18} />
          <span>New Chat</span>
        </button>

        {/* Sidebar Bottom Actions */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {businessProfile && !isSidebarCollapsed && (
            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>ACTIVE AGENT</div>
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{businessProfile.name}</div>
            </div>
          )}
          <button
            className="new-chat-btn"
            style={{ marginBottom: 0, background: isSettingsOpen ? 'var(--accent)' : 'var(--glass)' }}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-chat">

        <div className="chat-messages">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                style={{
                  textAlign: 'center',
                  marginTop: '15vh',
                  padding: '3rem',
                  background: 'var(--glass)',
                  borderRadius: '2rem',
                  border: '1px solid var(--glass-border)',
                  maxWidth: '500px',
                  margin: '15vh auto 0'
                }}
              >
                <div style={{
                  width: 80,
                  height: 80,
                  background: 'var(--accent)',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 20px 40px var(--accent-glow)'
                }}>
                  <Bot size={40} color="white" />
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>I am BIZBOT</h2>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Your intelligent business companion. Upload a PDF manual or guide in settings to grant me industry-specific knowledge.
                </p>
              </motion.div>
            ) : (
              <div key="message-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.type === 'human' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`message ${msg.type}`}
                  >
                    {msg.type === 'ai' ? (
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="chat-input-container">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder="Ask me about orders, bookings, or policies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="send-btn" onClick={handleSendMessage}>
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Settings Panel Overlay */}
        <div className={`settings-panel ${isSettingsOpen ? 'open' : ''}`}>
          <div className="settings-header">
            <h3>Business Settings</h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>KNOWLEDGE BASE</label>
            <div className="upload-card" onClick={() => document.getElementById('file-upload').click()}>
              <FileUp size={32} color="var(--accent)" style={{ marginBottom: '1rem' }} />
              <h4>{isUploading ? "Uploading..." : "Upload Business PDF"}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>PDF files only (Max 10MB)</p>
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                hidden
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {businessProfile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ background: 'var(--glass)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShieldCheck size={20} color="#10b981" />
                <span style={{ fontWeight: 600 }}>Active Profile</span>
              </div>
              <h4 style={{ marginBottom: '0.25rem' }}>{businessProfile.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{businessProfile.type}</p>
              <hr style={{ margin: '1rem 0', borderColor: 'var(--glass-border)' }} />
              <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{businessProfile.description}</p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
