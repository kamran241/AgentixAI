import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, Send, X, FileUp, Bot, User, ShieldCheck, ArrowLeft, LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import CapabilityBadges from '../components/CapabilityBadges';
import MarkdownContent from '../components/MarkdownContent';

const UPLOAD_STEPS = [
  'Uploading file...',
  'Reading business document...',
  'Extracting rules and services...',
  'Designing database schema...',
  'Building knowledge base...',
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="message-row ai">
      <div className="message-avatar ai"><Bot size={14} color="#64748b" /></div>
      <div className="typing-bubble">
        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const businessIdParam = searchParams.get('business_id');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(
    () => `session-${Math.random().toString(36).substr(2, 9)}`
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const messagesEndRef = useRef(null);
  const uploadTimers = useRef([]);

  // Load business if business_id passed in URL
  useEffect(() => {
    if (businessIdParam) {
      api.get(`/businesses/${businessIdParam}`)
        .then(({ data }) => {
          setBusinessProfile({
            id: Number(businessIdParam),
            name: data.name,
            type: data.type,
            capabilities: data.capabilities,
            tables: data.tables,
            description: data.description,
          });
        })
        .catch(() => {});
    }
  }, [businessIdParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // True when a business_id is in the URL but the profile fetch hasn't resolved yet
  const profileLoading = !!businessIdParam && !businessProfile;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping || profileLoading) return;
    setMessages((p) => [...p, { type: 'human', content: text, timestamp: new Date() }]);
    setInput('');
    setIsTyping(true);
    try {
      const { data } = await api.post('/chat', null, {
        params: {
          session_id: sessionId,
          message: text,
          ...(businessProfile?.id ? { business_id: businessProfile.id } : {}),
        },
      });
      setMessages((p) => [...p, { type: 'ai', content: data.response, timestamp: new Date() }]);
    } catch {
      setMessages((p) => [...p, {
        type: 'system', content: 'Connection error. Please try again.', timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadStep(0);
    uploadTimers.current.forEach(clearTimeout);
    uploadTimers.current = UPLOAD_STEPS.slice(1).map((_, i) =>
      setTimeout(() => setUploadStep(i + 1), (i + 1) * 2200)
    );
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/businesses/ingest', fd);
      uploadTimers.current.forEach(clearTimeout);
      setBusinessProfile({
        id: data.business_id,
        name: data.business_name,
        type: Object.entries(data.capabilities || {}).filter(([, v]) => v).map(([k]) => k.replace('has_', '')).join(', '),
        capabilities: data.capabilities,
        tables: data.tables_created || [],
      });
      setMessages([{
        type: 'system',
        content: `✓ "${data.business_name}" loaded — ${data.tables_created?.length || 0} table(s) created.`,
        timestamp: new Date(),
      }]);
    } catch (err) {
      uploadTimers.current.forEach(clearTimeout);
      setMessages((p) => [...p, {
        type: 'system',
        content: err.response?.data?.detail || 'Upload failed. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsUploading(false);
      setUploadStep(0);
      e.target.value = '';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-section">
          <img src="/logo.svg" className="logo-icon" alt="Agentix" />
          <span className="logo-text">AGENTIX</span>
        </div>

        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/dashboard" className="sidebar-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={15} />
            <span className="btn-label">Dashboard</span>
          </Link>
          <button className="sidebar-btn primary" onClick={() => {
            setMessages([]);
            setBusinessProfile(null);
            setSearchParams({});
          }}>
            <Plus size={16} />
            <span className="btn-label">New Chat</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          {businessProfile && (
            <div className="active-agent-card">
              <div className="active-agent-label">ACTIVE AGENT</div>
              <div className="active-agent-name">{businessProfile.name}</div>
            </div>
          )}
          {user && (
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{user.name}</div>
              <button className="sidebar-btn" style={{ width: '100%' }} onClick={() => { logout(); navigate('/'); }}>
                <LogOut size={14} />
                <span className="btn-label">Sign out</span>
              </button>
            </div>
          )}
          <button
            className={`sidebar-btn ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsOpen((v) => !v)}
          >
            <FileUp size={16} />
            <span className="btn-label">Upload PDF</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-chat">
        <header className="chat-header">
          {businessProfile ? (
            <div className="header-business">
              <div className="header-business-icon"><Bot size={16} color="#6366f1" /></div>
              <div>
                <div className="header-business-name">{businessProfile.name}</div>
                <div className="header-business-type">{businessProfile.type}</div>
              </div>
              <CapabilityBadges caps={businessProfile.capabilities} />
            </div>
          ) : (
            <div className="header-no-business">
              <Bot size={16} /> No business loaded — upload a PDF to get started
            </div>
          )}
        </header>

        <div className="chat-messages">
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              <motion.div key="empty" className="empty-state"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="empty-state-icon"><Bot size={36} color="white" /></div>
                <h2>I am Agentix</h2>
                <p>Your intelligent business assistant. Upload a PDF to get started, or test an existing business.</p>
              </motion.div>
            ) : (
              <div key="messages" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {messages.map((msg, i) =>
                  msg.type === 'system' ? (
                    <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                      <span className="message-bubble system">{msg.content}</span>
                    </div>
                  ) : (
                    <motion.div key={i} className={`message-row ${msg.type}`}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <div className={`message-avatar ${msg.type}`}>
                        {msg.type === 'human' ? <User size={14} color="white" /> : <Bot size={14} color="#64748b" />}
                      </div>
                      <div className={`message-bubble ${msg.type}`}>
                        {msg.type === 'ai'
                          ? <MarkdownContent content={msg.content} />
                          : msg.content}
                      </div>
                      <div className="message-time">{formatTime(msg.timestamp)}</div>
                    </motion.div>
                  )
                )}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper">
            <input
              type="text"
              placeholder={profileLoading ? 'Loading business profile…' : 'Ask me anything...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={profileLoading}
            />
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping || profileLoading}>
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Upload panel */}
        <div className={`settings-panel ${isSettingsOpen ? 'open' : ''}`}>
          <div className="settings-header">
            <h3>Upload Business PDF</h3>
            <button className="close-btn" onClick={() => setIsSettingsOpen(false)}><X size={20} /></button>
          </div>
          <div className="upload-card" onClick={() => !isUploading && document.getElementById('chat-pdf-upload').click()}>
            <FileUp size={28} color="var(--accent)" />
            <h4>{isUploading ? 'Processing...' : 'Upload Business PDF'}</h4>
            <p>Menu, price list, or service guide</p>
            <input id="chat-pdf-upload" type="file" accept=".pdf,.txt" hidden onChange={handleFileUpload} />
          </div>
          {isUploading && (
            <div className="upload-progress">
              {UPLOAD_STEPS.map((step, i) => (
                <div key={i} className={`upload-progress-step ${i === uploadStep ? 'active' : i < uploadStep ? 'done' : ''}`}>
                  <span>{i < uploadStep ? '✓' : i === uploadStep ? '›' : '○'}</span>
                  {step}
                </div>
              ))}
            </div>
          )}
          {businessProfile && !isUploading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '1.5rem' }}>
              <span className="settings-label">Active Profile</span>
              <div className="profile-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ShieldCheck size={16} color="var(--success)" />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--success)' }}>Loaded</span>
                </div>
                <h4>{businessProfile.name}</h4>
                <div className="profile-divider" />
                <CapabilityBadges caps={businessProfile.capabilities} />
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
