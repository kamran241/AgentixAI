import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Plus, LogOut, Building2, Calendar, Package, Truck,
  FileUp, X, ChevronRight, ChevronLeft, MessageSquare, Database, Bot,
  Search, Activity, Layers, Sparkles, ArrowUpRight, BarChart2, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE } from '../api';

/* ── Upload steps ─────────────────────────────────────────────────────────── */

const UPLOAD_STEPS = [
  'Uploading file...',
  'Reading document...',
  'Extracting rules...',
  'Designing schema...',
  'Building knowledge base...',
];

/* ── Capability badges ────────────────────────────────────────────────────── */

function CapBadges({ caps }) {
  if (!caps) return null;
  return (
    <div className="cap-badges">
      {caps.has_orders    && <span className="capability-badge badge-orders"><Package size={9}/> Orders</span>}
      {caps.has_bookings  && <span className="capability-badge badge-bookings"><Calendar size={9}/> Bookings</span>}
      {caps.has_delivery  && <span className="capability-badge badge-delivery"><Truck size={9}/> Delivery</span>}
    </div>
  );
}

/* ── Schema editor ────────────────────────────────────────────────────────── */

const COL_TYPES = ['TEXT', 'INTEGER', 'REAL', 'DATETIME'];

function SchemaEditor({ analysisResult, onConfirm, onBack, confirming }) {
  const [tables, setTables] = useState(
    analysisResult.suggested_tables.map(t => ({ ...t, columns: [...t.columns] }))
  );

  const setTableField = (ti, field, val) =>
    setTables(prev => prev.map((t, i) => i === ti ? { ...t, [field]: val } : t));

  const setCol = (ti, ci, field, val) =>
    setTables(prev => prev.map((t, i) =>
      i === ti ? { ...t, columns: t.columns.map((c, j) => j === ci ? { ...c, [field]: val } : c) } : t
    ));

  const addColumn = (ti) =>
    setTables(prev => prev.map((t, i) =>
      i === ti ? { ...t, columns: [...t.columns, { name: '', type: 'TEXT' }] } : t
    ));

  const removeColumn = (ti, ci) =>
    setTables(prev => prev.map((t, i) =>
      i === ti ? { ...t, columns: t.columns.filter((_, j) => j !== ci) } : t
    ));

  const addTable = () =>
    setTables(prev => [...prev, { table_name: '', purpose: '', columns: [{ name: 'customer_name', type: 'TEXT' }, { name: 'customer_phone', type: 'TEXT' }] }]);

  const removeTable = (ti) =>
    setTables(prev => prev.filter((_, i) => i !== ti));

  return (
    <div className="schema-editor">
      <div className="schema-editor-header">
        <div>
          <h3>Review Your Database Schema</h3>
          <p className="modal-sub" style={{ margin: 0 }}>
            AI designed this schema from your PDF. Edit before creating.
          </p>
        </div>
        <div className="schema-biz-pill">
          <span style={{ fontWeight: 700 }}>{analysisResult.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{analysisResult.type}</span>
        </div>
      </div>

      <div className="schema-tables">
        {tables.map((t, ti) => (
          <div key={ti} className="schema-table-card">
            <div className="schema-table-top">
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <input className="schema-input schema-table-name" value={t.table_name}
                  onChange={e => setTableField(ti, 'table_name', e.target.value)} placeholder="table_name"/>
                <input className="schema-input schema-purpose" value={t.purpose}
                  onChange={e => setTableField(ti, 'purpose', e.target.value)} placeholder="Describe what this table stores..."/>
              </div>
              <button className="schema-del-btn" onClick={() => removeTable(ti)}><X size={13}/></button>
            </div>
            <div className="schema-cols">
              <div className="schema-cols-head"><span>Column name</span><span>Type</span><span/></div>
              {t.columns.map((c, ci) => (
                <div key={ci} className="schema-col-row">
                  <input className="schema-input" value={c.name}
                    onChange={e => setCol(ti, ci, 'name', e.target.value)} placeholder="column_name"/>
                  <select className="schema-select" value={c.type}
                    onChange={e => setCol(ti, ci, 'type', e.target.value)}>
                    {COL_TYPES.map(tp => <option key={tp}>{tp}</option>)}
                  </select>
                  <button className="schema-del-btn sm" onClick={() => removeColumn(ti, ci)}><X size={11}/></button>
                </div>
              ))}
              <button className="schema-add-col" onClick={() => addColumn(ti)}>
                <Plus size={12}/> Add column
              </button>
            </div>
          </div>
        ))}
        <button className="schema-add-table" onClick={addTable}>
          <Plus size={14}/> Add table
        </button>
      </div>

      <div className="schema-actions">
        <button className="btn-card-secondary" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={() => onConfirm(tables)} disabled={confirming}>
          {confirming ? 'Creating...' : <><Database size={14}/> Create Database</>}
        </button>
      </div>
    </div>
  );
}

/* ── Upload modal ─────────────────────────────────────────────────────────── */

function UploadModal({ onClose, onSuccess }) {
  const [phase, setPhase]           = useState('upload');
  const [step, setStep]             = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState('');
  const [analysis, setAnalysis]     = useState(null);
  const [confirming, setConfirming] = useState(false);
  const timers = useRef([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setUploading(true); setStep(0);
    timers.current = UPLOAD_STEPS.slice(1).map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 2200)
    );
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/businesses/analyze', fd);
      timers.current.forEach(clearTimeout);
      setAnalysis(data);
      setPhase('schema');
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleConfirm = async (tables) => {
    setConfirming(true);
    try {
      const { data } = await api.post(`/businesses/${analysis.business_id}/confirm-schema`, { tables });
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create tables.');
      setConfirming(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={phase === 'upload' ? onClose : undefined}>
      <motion.div
        className={`modal-card ${phase === 'schema' ? 'modal-card-wide' : ''}`}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
      >
        {phase === 'upload' ? (
          <>
            <div className="modal-header">
              <div>
                <h3>Add New Business</h3>
                <p className="modal-sub" style={{ margin: '0.25rem 0 0' }}>
                  Upload your business PDF — menu, service guide, price list.
                </p>
              </div>
              <button className="close-btn" onClick={onClose}><X size={18}/></button>
            </div>

            {!uploading ? (
              <div className="upload-card" onClick={() => document.getElementById('modal-upload').click()}>
                <div className="upload-icon-wrap">
                  <FileUp size={28} color="var(--accent)"/>
                </div>
                <h4>Drop a PDF or click to browse</h4>
                <p>We'll extract your business rules and suggest a database schema for you to review</p>
                <span className="upload-formats">PDF · TXT</span>
                <input id="modal-upload" type="file" accept=".pdf,.txt" hidden onChange={handleFile}/>
              </div>
            ) : (
              <div className="upload-progress">
                {UPLOAD_STEPS.map((s, i) => (
                  <div key={i} className={`upload-progress-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                    <div className="upload-step-dot">{i < step ? '✓' : i === step ? '' : ''}</div>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="form-error" style={{ marginTop: '1rem' }}>{error}</div>}
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3>Review Schema</h3>
              <button className="close-btn" onClick={onClose}><X size={18}/></button>
            </div>
            <SchemaEditor analysisResult={analysis} onConfirm={handleConfirm}
              onBack={() => setPhase('upload')} confirming={confirming}/>
            {error && <div className="form-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color, sub, delay }) {
  return (
    <motion.div className="dash-stat-card"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}>
      <div className="dash-stat-icon" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <Icon size={18} color={color}/>
      </div>
      <div className="dash-stat-body">
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
      <div className="dash-stat-glow" style={{ background: color }}/>
    </motion.div>
  );
}

/* ── Business card ────────────────────────────────────────────────────────── */

function BusinessCard({ b, index }) {
  const logoUrl    = b.widget_config?.logo_url ? `${API_BASE}${b.widget_config.logo_url}` : null;
  const accentColor = b.widget_config?.primary_color || '#6366f1';
  const isActive   = (b.conversation_count || 0) > 0;
  const totalRows  = b.tables?.reduce((s, t) => s + (t.row_count || 0), 0) || 0;

  return (
    <motion.div className="biz-card"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }} whileHover={{ y: -4, transition: { duration: 0.2 } }}>

      {/* Gradient header */}
      <div className="biz-card-header" style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}08 100%)` }}>
        <div className="biz-card-accent" style={{ background: accentColor }}/>
        <div className="biz-card-logo">
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }}/>
            : <div className="biz-card-logo-placeholder" style={{ background: `${accentColor}22`, border: `1.5px solid ${accentColor}44` }}>
                <Building2 size={18} color={accentColor}/>
              </div>
          }
        </div>
        <div className={`biz-status-pill ${isActive ? 'active' : 'idle'}`}>
          <span className="biz-status-dot"/>
          {isActive ? 'Active' : 'Idle'}
        </div>
      </div>

      {/* Body */}
      <div className="biz-card-body">
        <div className="biz-card-type">{b.type}</div>
        <h3 className="biz-card-name">{b.name}</h3>
        <p className="biz-card-desc">{b.description?.slice(0, 80)}{b.description?.length > 80 ? '…' : ''}</p>
        <CapBadges caps={b.capabilities}/>
      </div>

      {/* Stats row */}
      <div className="biz-card-stats">
        <div className="biz-mini-stat">
          <Database size={11}/>
          <span>{b.tables?.length || 0} table{b.tables?.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="biz-mini-stat">
          <MessageSquare size={11}/>
          <span>{b.conversation_count || 0} chat{b.conversation_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="biz-mini-stat">
          <BarChart2 size={11}/>
          <span>{totalRows} record{totalRows !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="biz-card-actions">
        <Link to={`/business/${b.id}`} className="biz-card-btn primary" style={{ '--ac': accentColor }}>
          Manage <ArrowUpRight size={13}/>
        </Link>
        <Link to={`/chat?business_id=${b.id}`} className="biz-card-btn secondary">
          <Bot size={13}/> Test
        </Link>
      </div>
    </motion.div>
  );
}

/* ── Recent bookings mini-widget ──────────────────────────────────────────── */

const TIME_KEYS  = ['appointment_time','booking_time','time','slot','appointment_date','booking_date','date'];
const NAME_KEYS  = ['customer_name','name','full_name','patient_name','client_name'];

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]);
  }
  return null;
}

function RecentBookings({ businesses }) {
  const [bookings, setBookings] = useState([]);
  const hasBookingBiz = businesses.some(b => b.capabilities?.has_bookings);

  useEffect(() => {
    if (!hasBookingBiz) return;
    api.get('/businesses/all-bookings?limit=6')
      .then(({ data }) => setBookings(data))
      .catch(() => {});
  }, [hasBookingBiz]);

  if (!hasBookingBiz || bookings.length === 0) return null;

  return (
    <motion.div className="recent-bookings-widget"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
      <div className="rbw-header">
        <Calendar size={14} color="var(--accent)"/>
        <span>Recent Bookings</span>
        <Link to="/bookings" className="rbw-view-all">View all <ChevronRight size={11}/></Link>
      </div>
      <div className="rbw-list">
        {bookings.map((b, i) => {
          const name = pick(b, NAME_KEYS);
          const time = pick(b, TIME_KEYS);
          let timeDisplay = time;
          if (time) {
            try {
              const d = new Date(time);
              if (!isNaN(d)) timeDisplay = d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch {}
          }
          return (
            <div key={i} className="rbw-row">
              <div className="rbw-avatar">{(name || '?')[0].toUpperCase()}</div>
              <div className="rbw-info">
                <div className="rbw-name">{name || 'Customer'}</div>
                <div className="rbw-meta">{b.business_name} · {timeDisplay || '—'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [search, setSearch]         = useState('');
  const [sbCollapsed, setSbCollapsed] = useState(() => localStorage.getItem('sb-collapsed') === 'true');

  const toggleSidebar = () => setSbCollapsed(v => {
    const next = !v;
    localStorage.setItem('sb-collapsed', String(next));
    return next;
  });

  const load = async () => {
    try {
      const { data } = await api.get('/businesses/');
      setBusinesses(data);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return businesses;
    const q = search.toLowerCase();
    return businesses.filter(b =>
      b.name?.toLowerCase().includes(q) ||
      b.type?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q)
    );
  }, [businesses, search]);

  const stats = useMemo(() => {
    const totalChats  = businesses.reduce((s, b) => s + (b.conversation_count || 0), 0);
    const totalTables = businesses.reduce((s, b) => s + (b.tables?.length || 0), 0);
    const totalRecs   = businesses.reduce((s, b) => s + (b.tables?.reduce((ss, t) => ss + (t.row_count || 0), 0) || 0), 0);
    const active      = businesses.filter(b => (b.conversation_count || 0) > 0).length;
    return [
      { label: 'AI Assistants',  value: businesses.length, icon: Layers,        color: '#6366f1', sub: `${active} active` },
      { label: 'Conversations',  value: totalChats,        icon: MessageSquare, color: '#10b981', sub: 'all time' },
      { label: 'Data Tables',    value: totalTables,       icon: Database,      color: '#8b5cf6', sub: 'across businesses' },
      { label: 'Records Saved',  value: totalRecs,         icon: BarChart2,     color: '#f59e0b', sub: 'bookings & orders' },
    ];
  }, [businesses]);

  const handleUploadSuccess = (data) => { setShowModal(false); navigate(`/business/${data.business_id}`); };
  const handleLogout = () => { logout(); navigate('/'); };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`shell-sidebar${sbCollapsed ? ' collapsed' : ''}`}>
        <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={sbCollapsed ? 'Expand' : 'Collapse'}>
          {sbCollapsed ? <ChevronRight size={11}/> : <ChevronLeft size={11}/>}
        </button>

        <Link to="/" className="shell-logo">
          <div className="logo-icon small"><Zap size={14} color="white" fill="white"/></div>
          <span className="logo-text">AGENTIX</span>
        </Link>

        <nav className="shell-nav">
          <Link to="/dashboard" className="shell-nav-item active" title="Dashboard">
            <Building2 size={16}/><span className="nav-label">Dashboard</span>
          </Link>
          <Link to="/bookings" className="shell-nav-item" title="Bookings">
            <Calendar size={16}/><span className="nav-label">Bookings</span>
          </Link>
          <Link to="/settings" className="shell-nav-item" title="Settings">
            <Settings size={16}/><span className="nav-label">Settings</span>
          </Link>
        </nav>

        <div className="shell-sidebar-bottom">
          <div className="sidebar-promo">
            <Sparkles size={13} color="var(--accent)"/>
            <div>
              <div className="sidebar-promo-title">Open Source</div>
              <div className="sidebar-promo-sub">Star us on GitHub</div>
            </div>
          </div>
          <div className="shell-user">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="shell-logout" onClick={handleLogout} title="Sign out">
            <LogOut size={14}/><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        {/* Header */}
        <div className="dash-header">
          <div className="dash-header-left">
            <div className="dash-greeting">
              {greet()}, <span className="dash-name">{user?.name?.split(' ')[0]}</span>
            </div>
            <div className="dash-date">{today}</div>
          </div>
          <div className="dash-header-right">
            <button className="btn-primary dash-add-btn" onClick={() => setShowModal(true)}>
              <Plus size={15}/> New Business
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <>
            {/* Stats */}
            {businesses.length > 0 && (
              <div className="dash-stats-grid">
                {stats.map((s, i) => (
                  <StatCard key={s.label} {...s} delay={i * 0.06}/>
                ))}
              </div>
            )}

            {/* Content area: grid + sidebar */}
            <div className="dash-content-layout">
              <div className="dash-main-col">
                {/* Search */}
                {businesses.length > 0 && (
                  <div className="search-row" style={{ marginBottom: '1.25rem' }}>
                    <div className="search-wrap" style={{ flex: 1 }}>
                      <Search size={14} className="search-icon"/>
                      <input type="text" className="search-input"
                        placeholder="Search by name, type or description..."
                        value={search} onChange={e => setSearch(e.target.value)}/>
                      {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13}/></button>}
                    </div>
                    <span className="search-count">{filtered.length} of {businesses.length}</span>
                  </div>
                )}

                {/* Grid */}
                {businesses.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-graphic">
                      <div className="dash-empty-ring"/>
                      <div className="dash-empty-icon"><Bot size={36} color="var(--accent)"/></div>
                    </div>
                    <h2>No AI assistants yet</h2>
                    <p>Upload a business PDF to deploy your first AI assistant in minutes.</p>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                      <Plus size={15}/> Create your first assistant
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="dash-empty">
                    <Search size={32} color="var(--text-muted)"/>
                    <h2>No results for "{search}"</h2>
                    <button className="btn-card-secondary" onClick={() => setSearch('')} style={{ marginTop: '1rem' }}>Clear search</button>
                  </div>
                ) : (
                  <div className="biz-grid">
                    {filtered.map((b, i) => <BusinessCard key={b.id} b={b} index={i}/>)}
                    {!search && (
                      <motion.button className="biz-card biz-add-card"
                        onClick={() => setShowModal(true)}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: filtered.length * 0.06 }}>
                        <div className="biz-add-inner">
                          <div className="biz-add-icon"><Plus size={22} color="var(--accent)"/></div>
                          <span>Add Business</span>
                          <span className="biz-add-hint">Upload a PDF to get started</span>
                        </div>
                      </motion.button>
                    )}
                  </div>
                )}
              </div>

              {/* Right sidebar panel */}
              {businesses.length > 0 && (
                <div className="dash-side-col">
                  <RecentBookings businesses={businesses}/>

                  {/* Quick actions */}
                  <motion.div className="dash-quick-actions"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                    <div className="dqa-header"><Activity size={13} color="var(--accent)"/> Quick Actions</div>
                    <button className="dqa-item" onClick={() => setShowModal(true)}>
                      <div className="dqa-item-icon" style={{ background: '#6366f118' }}><Plus size={14} color="#6366f1"/></div>
                      <div><div className="dqa-item-label">Add Business</div><div className="dqa-item-sub">Upload a PDF</div></div>
                    </button>
                    <Link to="/bookings" className="dqa-item">
                      <div className="dqa-item-icon" style={{ background: '#10b98118' }}><Calendar size={14} color="#10b981"/></div>
                      <div><div className="dqa-item-label">View Bookings</div><div className="dqa-item-sub">All appointments</div></div>
                    </Link>
                    {businesses[0] && (
                      <Link to={`/chat?business_id=${businesses[0].id}`} className="dqa-item">
                        <div className="dqa-item-icon" style={{ background: '#8b5cf618' }}><Bot size={14} color="#8b5cf6"/></div>
                        <div><div className="dqa-item-label">Test Chat</div><div className="dqa-item-sub">{businesses[0].name}</div></div>
                      </Link>
                    )}
                  </motion.div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {showModal && (
          <UploadModal onClose={() => setShowModal(false)} onSuccess={handleUploadSuccess}/>
        )}
      </AnimatePresence>
    </div>
  );
}
