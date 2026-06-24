import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Zap, ArrowLeft, Bot, Building2, Database, Code2, MessageSquare,
  Copy, Check, Trash2, ExternalLink, Package, Calendar, Truck, LogOut,
  Palette, FileText, Upload, Save, X, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE } from '../api';

/* ── Small helpers ─────────────────────────────────────────────────────────── */

function CapBadge({ caps }) {
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
      {caps.has_orders   && <span className="capability-badge badge-orders"><Package size={10}/> Orders</span>}
      {caps.has_bookings && <span className="capability-badge badge-bookings"><Calendar size={10}/> Bookings</span>}
      {caps.has_delivery && <span className="capability-badge badge-delivery"><Truck size={10}/> Delivery</span>}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? <Check size={14} color="var(--success)"/> : <Copy size={14}/>}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ── Widget live preview ───────────────────────────────────────────────────── */

function WidgetPreview({ config, businessName }) {
  const color = config.primary_color || '#6366f1';
  const bgColor = config.bg_color || '#0b0f1a';
  return (
    <div className="widget-preview-wrap">
      <div className="widget-preview-label">Live Preview</div>
      <div className="widget-preview" style={{ background: bgColor }}>
        {/* header */}
        <div className="wp-header" style={{ background: color }}>
          {config.logo_url
            ? <img src={`${API_BASE}${config.logo_url}`} alt="logo" className="wp-logo"/>
            : <div className="wp-logo-placeholder" style={{ background: `${color}cc` }}>
                <Bot size={14} color="white"/>
              </div>
          }
          <div>
            <div className="wp-bot-name">{config.bot_name || 'AI Assistant'}</div>
            <div className="wp-status"><span className="online-dot"/>Online</div>
          </div>
        </div>
        {/* welcome message */}
        <div className="wp-body" style={{ background: bgColor }}>
          <div className="wp-msg">
            <div className="wp-avatar" style={{ background: color }}>
              <Bot size={10} color="white"/>
            </div>
            <div className="wp-bubble">{config.welcome_message || 'Hi! How can I help you?'}</div>
          </div>
        </div>
        {/* input */}
        <div className="wp-input">
          <div className="wp-input-bar">Type a message...</div>
          <div className="wp-send-btn" style={{ background: color }}>›</div>
        </div>
      </div>
    </div>
  );
}

/* ── Conversation modal ────────────────────────────────────────────────────── */

function ConversationModal({ sessionId, onClose }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/history/${sessionId}`)
      .then(({ data }) => setHistory(data.history || []))
      .catch(() => setHistory([]));
  }, [sessionId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="convo-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="convo-modal-header">
          <div>
            <h3>Conversation</h3>
            <p className="detail-desc" style={{ margin: 0 }}>Session: {sessionId}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="convo-modal-body">
          {history === null && <div className="empty-tab">Loading...</div>}
          {history?.length === 0 && <div className="empty-tab">No messages in this conversation.</div>}
          {history?.filter(m => m.role === 'user' || m.role === 'assistant').map((m, i) => {
            const isHuman = m.role === 'user';
            return (
              <div key={i} className={`convo-msg ${isHuman ? 'human' : 'ai'}`}>
                <div className={`convo-avatar ${isHuman ? 'human' : 'ai'}`}>
                  {isHuman ? <User size={11} color="white"/> : <Bot size={11} color="#64748b"/>}
                </div>
                <div className={`convo-bubble ${isHuman ? 'human' : 'ai'}`}>
                  {!isHuman
                    ? <div className="markdown-content"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    : m.content}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'overview',  label: 'Overview',  Icon: MessageSquare },
  { id: 'database',  label: 'Database',  Icon: Database },
  { id: 'customize', label: 'Customize', Icon: Palette },
  { id: 'embed',     label: 'Embed',     Icon: Code2 },
  { id: 'pdf',       label: 'Document',  Icon: FileText },
];

/* ══════════════════════════════════════════════════════════════════════════ */

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [deleting, setDeleting] = useState(false);
  const [viewSession, setViewSession] = useState(null);

  // customize state
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef();

  // PDF blob — fetch with auth token so iframe can render it
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    api.get(`/businesses/${id}`)
      .then(({ data }) => {
        setBusiness(data);
        setCfg(data.widget_config || {});
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${business.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await api.delete(`/businesses/${id}`); navigate('/dashboard'); }
    catch { setDeleting(false); }
  };

  const handleSaveCfg = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/businesses/${id}/widget-config`, cfg);
      setCfg(data);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/businesses/${id}/logo`, fd);
      setCfg(prev => ({ ...prev, logo_url: data.logo_url }));
    } finally { setLogoUploading(false); e.target.value = ''; }
  };

  // Fetch PDF as blob (iframe can't send auth headers)
  useEffect(() => {
    if (tab === 'pdf' && business?.has_pdf && !pdfBlobUrl && !pdfLoading) {
      setPdfLoading(true);
      api.get(`/businesses/${id}/pdf`, { responseType: 'blob' })
        .then(({ data }) => setPdfBlobUrl(URL.createObjectURL(data)))
        .catch(() => setPdfBlobUrl(null))
        .finally(() => setPdfLoading(false));
    }
  }, [tab, business]);

  const handleLogout = () => { logout(); navigate('/'); };

  if (loading) return <div className="app-shell"><div className="shell-main loading-state">Loading...</div></div>;
  if (!business) return null;

  const embedCode = `<script src="${window.location.origin}/widget.js" data-token="${business.public_token}"></script>`;
  const widgetUrl = `${window.location.origin}/widget-chat?token=${business.public_token}`;
  const pdfUrl = `${API_BASE}/businesses/${id}/pdf`;

  return (
    <>
    {viewSession && <ConversationModal sessionId={viewSession} onClose={() => setViewSession(null)}/>}
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="shell-sidebar">
        <Link to="/" className="shell-logo">
          <div className="logo-icon"><Zap size={18} color="white" fill="white"/></div>
          <span className="logo-text">AGENTIX</span>
        </Link>
        <nav className="shell-nav">
          <Link to="/dashboard" className="shell-nav-item">
            <Building2 size={16}/><span>Dashboard</span>
          </Link>
        </nav>
        <div className="shell-sidebar-bottom">
          <div className="shell-user">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="shell-logout" onClick={handleLogout}>
            <LogOut size={15}/><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/dashboard" className="breadcrumb-link"><ArrowLeft size={14}/> Dashboard</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{business.name}</span>
        </div>

        {/* Business Header */}
        <div className="detail-header">
          <div className="detail-header-left">
            <div className="detail-icon">
              {cfg?.logo_url
                ? <img src={`${API_BASE}${cfg.logo_url}`} alt="logo" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }}/>
                : <Building2 size={24} color="var(--accent)"/>
              }
            </div>
            <div>
              <h1 className="detail-title">{business.name}</h1>
              <p className="detail-type">{business.type}</p>
              <CapBadge caps={business.capabilities}/>
            </div>
          </div>
          <div className="detail-header-actions">
            <Link to={`/chat?business_id=${id}`} className="btn-primary">
              <Bot size={15}/> Test Chat
            </Link>
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={15}/> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-num">{business.tables?.length || 0}</div>
            <div className="stat-label">Tables</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{business.conversation_count || 0}</div>
            <div className="stat-label">Conversations</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{business.tables?.reduce((s, t) => s + (t.row_count || 0), 0) || 0}</div>
            <div className="stat-label">Records</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ fontSize: '1.1rem', color: business.has_pdf ? 'var(--success)' : 'var(--text-muted)' }}>
              {business.has_pdf ? 'Yes' : 'No'}
            </div>
            <div className="stat-label">PDF Uploaded</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {TABS.map(({ id: tid, label, Icon }) => (
            <button key={tid} className={`tab-btn ${tab === tid ? 'active' : ''}`} onClick={() => setTab(tid)}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="detail-section">
              <h3 className="section-heading">Description</h3>
              <p className="detail-desc">{business.description || 'No description available.'}</p>
            </div>
            <div className="detail-section">
              <h3 className="section-heading">Recent Conversations</h3>
              {!business.recent_sessions?.length
                ? <div className="empty-tab">No conversations yet. <Link to={`/chat?business_id=${id}`}>Start testing</Link></div>
                : <div className="sessions-list">
                    {business.recent_sessions.map((s) => (
                      <div key={s.id} className="session-row clickable" onClick={() => setViewSession(s.id)}>
                        <MessageSquare size={14} color="var(--text-muted)"/>
                        <span className="session-id">{s.id.slice(0, 24)}...</span>
                        <span className="session-msgs">{s.message_count} msg{s.message_count !== 1 ? 's' : ''}</span>
                        <span className="session-date">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}</span>
                        <span className="session-view">View →</span>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </motion.div>
        )}

        {/* ── Database ── */}
        {tab === 'database' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            {business.tables?.length === 0
              ? <div className="empty-tab">No tables created yet.</div>
              : business.tables.map((t) => (
                  <div key={t.name} className="table-card">
                    <div className="table-card-header">
                      <div>
                        <code className="table-name">{t.name}</code>
                        <p className="table-purpose">{t.purpose}</p>
                      </div>
                      <div className="table-row-count">{t.row_count} row{t.row_count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="column-list">
                      {t.columns?.map((c) => (
                        <div key={c.name} className="column-item">
                          <span className="col-name">{c.name}</span>
                          <span className="col-type">{c.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            }
          </motion.div>
        )}

        {/* ── Customize ── */}
        {tab === 'customize' && cfg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="customize-layout">
              <div className="customize-form">
                <h3 className="section-heading">Widget Appearance</h3>

                {/* Logo */}
                <div className="form-group">
                  <label>Logo</label>
                  <div className="logo-upload-row">
                    {cfg.logo_url
                      ? <img src={`${API_BASE}${cfg.logo_url}`} alt="logo" className="logo-preview"/>
                      : <div className="logo-placeholder"><Building2 size={20} color="var(--text-muted)"/></div>
                    }
                    <button className="btn-card-secondary" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                      <Upload size={14}/> {logoUploading ? 'Uploading...' : 'Upload Logo'}
                    </button>
                    <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" hidden onChange={handleLogoUpload}/>
                  </div>
                  <p className="field-hint">PNG, JPG, SVG — shown in widget header</p>
                </div>

                {/* Bot name */}
                <div className="form-group">
                  <label>Bot Name</label>
                  <input
                    type="text"
                    value={cfg.bot_name || ''}
                    onChange={e => setCfg(p => ({ ...p, bot_name: e.target.value }))}
                    placeholder="AI Assistant"
                  />
                </div>

                {/* Welcome message */}
                <div className="form-group">
                  <label>Welcome Message</label>
                  <textarea
                    className="form-textarea"
                    value={cfg.welcome_message || ''}
                    onChange={e => setCfg(p => ({ ...p, welcome_message: e.target.value }))}
                    placeholder="Hi! How can I help you today?"
                    rows={3}
                  />
                </div>

                {/* Accent Color */}
                <div className="form-group">
                  <label>Accent Color <span className="field-hint" style={{ display: 'inline' }}>(header, buttons, bubbles)</span></label>
                  <div className="color-row">
                    <input
                      type="color"
                      className="color-picker"
                      value={cfg.primary_color || '#6366f1'}
                      onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))}
                    />
                    <input
                      type="text"
                      value={cfg.primary_color || '#6366f1'}
                      onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))}
                      className="color-hex-input"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>

                {/* Background Color */}
                <div className="form-group">
                  <label>Background Color <span className="field-hint" style={{ display: 'inline' }}>(chat screen)</span></label>
                  <div className="color-row">
                    <input
                      type="color"
                      className="color-picker"
                      value={cfg.bg_color || '#0b0f1a'}
                      onChange={e => setCfg(p => ({ ...p, bg_color: e.target.value }))}
                    />
                    <input
                      type="text"
                      value={cfg.bg_color || '#0b0f1a'}
                      onChange={e => setCfg(p => ({ ...p, bg_color: e.target.value }))}
                      className="color-hex-input"
                      placeholder="#0b0f1a"
                    />
                  </div>
                </div>

                {/* Position */}
                <div className="form-group">
                  <label>Widget Position</label>
                  <div className="position-toggle">
                    {['right', 'left'].map(pos => (
                      <button
                        key={pos}
                        className={`position-btn ${(cfg.position || 'right') === pos ? 'active' : ''}`}
                        onClick={() => setCfg(p => ({ ...p, position: pos }))}
                      >
                        Bottom {pos.charAt(0).toUpperCase() + pos.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn-primary" onClick={handleSaveCfg} disabled={saving} style={{ marginTop: '0.5rem' }}>
                  {saveOk ? <><Check size={15}/> Saved!</> : saving ? 'Saving...' : <><Save size={15}/> Save Changes</>}
                </button>
              </div>

              {/* Live preview */}
              <WidgetPreview config={cfg} businessName={business.name}/>
            </div>
          </motion.div>
        )}

        {/* ── Embed ── */}
        {tab === 'embed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="embed-section">
              <h3 className="section-heading">Embed on your website</h3>
              <p className="detail-desc">
                Paste this snippet before the closing <code>&lt;/body&gt;</code> tag. A chat bubble appears in the corner automatically.
              </p>
              <div className="code-block">
                <div className="code-block-header"><span>HTML</span><CopyButton text={embedCode}/></div>
                <pre className="code-pre">{embedCode}</pre>
              </div>
            </div>
            <div className="embed-section" style={{ marginTop: '2rem' }}>
              <h3 className="section-heading">Preview widget</h3>
              <p className="detail-desc">See exactly how your customers will experience the chat.</p>
              <a href={widgetUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-flex' }}>
                <ExternalLink size={15}/> Preview Widget
              </a>
            </div>
            <div className="embed-section" style={{ marginTop: '2rem' }}>
              <h3 className="section-heading">Public Token</h3>
              <div className="code-block">
                <div className="code-block-header"><span>Token</span><CopyButton text={business.public_token}/></div>
                <pre className="code-pre">{business.public_token}</pre>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PDF Viewer ── */}
        {tab === 'pdf' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            {!business.has_pdf
              ? <div className="empty-tab">No PDF uploaded for this business yet.</div>
              : <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 className="section-heading" style={{ marginBottom: '0.25rem' }}>Uploaded Document</h3>
                      <p className="detail-desc" style={{ margin: 0 }}>{business.pdf_filename}</p>
                    </div>
                    {pdfBlobUrl && (
                      <a href={pdfBlobUrl} download={business.pdf_filename} className="btn-card-secondary">
                        <ExternalLink size={14}/> Download
                      </a>
                    )}
                  </div>
                  <div className="pdf-viewer">
                    {pdfLoading && (
                      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading document...
                      </div>
                    )}
                    {!pdfLoading && pdfBlobUrl && (
                      <iframe src={pdfBlobUrl} title="Business PDF" className="pdf-iframe"/>
                    )}
                    {!pdfLoading && !pdfBlobUrl && (
                      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Failed to load document. Please try again.
                      </div>
                    )}
                  </div>
                </>
            }
          </motion.div>
        )}
      </main>
    </div>
    </>
  );
}
