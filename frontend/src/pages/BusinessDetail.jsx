import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Zap, ArrowLeft, Bot, Building2, Database, Code2, MessageSquare,
  Copy, Check, Trash2, ExternalLink, Package, Calendar, Truck, LogOut,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE } from '../api';

function CapBadge({ caps }) {
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
      {caps.has_orders && <span className="capability-badge badge-orders"><Package size={10} /> Orders</span>}
      {caps.has_bookings && <span className="capability-badge badge-bookings"><Calendar size={10} /> Bookings</span>}
      {caps.has_delivery && <span className="capability-badge badge-delivery"><Truck size={10} /> Delivery</span>}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const TABS = ['Overview', 'Database', 'Embed'];

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/businesses/${id}`)
      .then(({ data }) => setBusiness(data))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${business.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/businesses/${id}`);
      navigate('/dashboard');
    } catch {
      setDeleting(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (loading) return <div className="app-shell"><div className="shell-main loading-state">Loading...</div></div>;
  if (!business) return null;

  const embedCode = `<script src="${API_BASE}/static/widget.js" data-token="${business.public_token}"></script>`;
  const widgetUrl = `${window.location.origin}/widget-chat?token=${business.public_token}`;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="shell-sidebar">
        <Link to="/" className="shell-logo">
          <div className="logo-icon">
            <Zap size={18} color="white" fill="white" />
          </div>
          <span className="logo-text">AGENTIX</span>
        </Link>
        <nav className="shell-nav">
          <Link to="/dashboard" className="shell-nav-item">
            <Building2 size={16} />
            <span>Dashboard</span>
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
            <LogOut size={15} /><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/dashboard" className="breadcrumb-link"><ArrowLeft size={14} /> Dashboard</Link>
          <span className="breadcrumb-sep">/</span>
          <span>{business.name}</span>
        </div>

        {/* Business Header */}
        <div className="detail-header">
          <div className="detail-header-left">
            <div className="detail-icon">
              <Building2 size={24} color="var(--accent)" />
            </div>
            <div>
              <h1 className="detail-title">{business.name}</h1>
              <p className="detail-type">{business.type}</p>
              <CapBadge caps={business.capabilities} />
            </div>
          </div>
          <div className="detail-header-actions">
            <Link to={`/chat?business_id=${id}`} className="btn-primary">
              <Bot size={15} /> Test Chat
            </Link>
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Stats row */}
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
            <div className="stat-num">
              {business.tables?.reduce((s, t) => s + (t.row_count || 0), 0) || 0}
            </div>
            <div className="stat-label">Records</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {TABS.map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'Overview' && <MessageSquare size={14} />}
              {t === 'Database' && <Database size={14} />}
              {t === 'Embed' && <Code2 size={14} />}
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'Overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="detail-section">
              <h3 className="section-heading">Description</h3>
              <p className="detail-desc">{business.description || 'No description available.'}</p>
            </div>
            <div className="detail-section">
              <h3 className="section-heading">Recent Conversations</h3>
              {business.recent_sessions?.length === 0 ? (
                <div className="empty-tab">No conversations yet. <Link to={`/chat?business_id=${id}`}>Start testing</Link></div>
              ) : (
                <div className="sessions-list">
                  {(business.recent_sessions || []).map((s) => (
                    <div key={s.id} className="session-row">
                      <MessageSquare size={14} color="var(--text-muted)" />
                      <span className="session-id">{s.id.slice(0, 20)}...</span>
                      <span className="session-msgs">{s.message_count} message{s.message_count !== 1 ? 's' : ''}</span>
                      <span className="session-date">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Database */}
        {tab === 'Database' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            {business.tables?.map((t) => (
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
            ))}
          </motion.div>
        )}

        {/* Embed */}
        {tab === 'Embed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="embed-section">
              <h3 className="section-heading">Embed on your website</h3>
              <p className="detail-desc">
                Paste this snippet before the closing <code>&lt;/body&gt;</code> tag on any page.
                A chat bubble will appear in the bottom-right corner.
              </p>
              <div className="code-block">
                <div className="code-block-header">
                  <span>HTML</span>
                  <CopyButton text={embedCode} />
                </div>
                <pre className="code-pre">{embedCode}</pre>
              </div>
            </div>

            <div className="embed-section" style={{ marginTop: '2rem' }}>
              <h3 className="section-heading">Preview widget</h3>
              <p className="detail-desc">Open the widget chat in a standalone page to preview how it looks.</p>
              <a href={widgetUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-flex' }}>
                <ExternalLink size={15} /> Preview Widget
              </a>
            </div>

            <div className="embed-section" style={{ marginTop: '2rem' }}>
              <h3 className="section-heading">Public token</h3>
              <div className="code-block">
                <div className="code-block-header">
                  <span>Token</span>
                  <CopyButton text={business.public_token} />
                </div>
                <pre className="code-pre">{business.public_token}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
