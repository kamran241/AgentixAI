import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bot, Building2, Database, Code2, MessageSquare,
  Copy, Check, Trash2, ExternalLink, Calendar,
  Palette, FileText, Upload, Save, X, User, Clock, Ban, Plus,
  Table2, ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE } from '../api';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import CapabilityBadges from '../components/CapabilityBadges';
import MarkdownContent from '../components/MarkdownContent';
import { TableSkeleton } from '../components/Skeleton';

/* ── Small helpers ─────────────────────────────────────────────────────────── */

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

function WidgetPreview({ config }) {
  const [view, setView] = useState('desktop');
  const color      = config.primary_color || '#6366f1';
  const bgColor    = config.bg_color      || '#0b0f1a';
  const inputColor = config.input_color   || '#111827';

  return (
    <div className="widget-preview-wrap">
      {/* toggle */}
      <div className="wp-preview-toolbar">
        <span className="widget-preview-label">Live Preview</span>
        <div className="wp-view-toggle">
          <button className={`wp-view-btn ${view === 'desktop' ? 'active' : ''}`} onClick={() => setView('desktop')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Desktop
          </button>
          <button className={`wp-view-btn ${view === 'mobile' ? 'active' : ''}`} onClick={() => setView('mobile')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
            Mobile
          </button>
        </div>
      </div>

      {/* preview frame */}
      <div className={`wp-frame ${view}`}>
        {view === 'desktop' && (
          <div className="wp-desktop-mockup">
            <div className="wp-screen-bar">
              <span/><span/><span/>
            </div>
          </div>
        )}
        {view === 'mobile' && (
          <div className="wp-phone-mockup">
            <div className="wp-phone-notch"/>
          </div>
        )}

        <div className="widget-preview" style={{ background: bgColor }}>
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
          <div className="wp-body" style={{ background: bgColor }}>
            <div className="wp-msg">
              <div className="wp-avatar" style={{ background: color }}>
                <Bot size={10} color="white"/>
              </div>
              <div className="wp-bubble">{config.welcome_message || 'Hi! How can I help you?'}</div>
            </div>
            {/* typing indicator */}
            <div className="wp-msg">
              <div className="wp-avatar" style={{ background: color }}>
                <Bot size={10} color="white"/>
              </div>
              <div className="wp-bubble wp-typing">
                <span/><span/><span/>
              </div>
            </div>
          </div>
          <div className="wp-input" style={{ background: inputColor }}>
            <div className="wp-input-bar">Type a message...</div>
            <div className="wp-send-btn" style={{ background: color }}>›</div>
          </div>
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
                    ? <MarkdownContent content={m.content} />
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

/* ── Availability editor ───────────────────────────────────────────────────── */

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DEFAULT_AVAIL = {
  schedule: Object.fromEntries(DAYS.map(d => [d, {
    open: !['saturday','sunday'].includes(d), start: '09:00', end: '17:00'
  }])),
  slot_duration: 30,
  buffer_minutes: 0,
  blocked_dates: [],
};

function AvailabilityTab({ businessId, initial }) {
  const [avail, setAvail] = useState(() => ({
    ...DEFAULT_AVAIL,
    ...(initial || {}),
    schedule: { ...DEFAULT_AVAIL.schedule, ...(initial?.schedule || {}) },
    blocked_dates: initial?.blocked_dates || [],
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newDate, setNewDate] = useState('');

  const setDay = (day, field, val) =>
    setAvail(a => ({ ...a, schedule: { ...a.schedule, [day]: { ...a.schedule[day], [field]: val } } }));

  const addBlocked = () => {
    if (!newDate || avail.blocked_dates.includes(newDate)) return;
    setAvail(a => ({ ...a, blocked_dates: [...a.blocked_dates, newDate].sort() }));
    setNewDate('');
  };

  const removeBlocked = (d) =>
    setAvail(a => ({ ...a, blocked_dates: a.blocked_dates.filter(x => x !== d) }));

  const save = async () => {
    setSaving(true); setSaveError('');
    try {
      await api.put(`/businesses/${businessId}/availability`, avail);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Save failed — check console for details.');
    } finally { setSaving(false); }
  };

  return (
    <div className="avail-layout">
      {/* Weekly schedule */}
      <div className="avail-section">
        <h3 className="section-heading" style={{ marginBottom: '1rem' }}>
          <Clock size={15} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/>
          Weekly Schedule
        </h3>
        <div className="avail-schedule">
          {DAYS.map(day => {
            const d = avail.schedule[day] || { open: false, start: '09:00', end: '17:00' };
            return (
              <div key={day} className={`avail-day-row ${d.open ? 'open' : 'closed'}`}>
                <label className="avail-toggle">
                  <input type="checkbox" checked={d.open} onChange={e => setDay(day, 'open', e.target.checked)}/>
                  <span className="avail-toggle-track"/>
                </label>
                <span className="avail-day-name">{day.slice(0,3).toUpperCase()}</span>
                <div className="avail-day-full">{day.charAt(0).toUpperCase() + day.slice(1)}</div>
                {d.open ? (
                  <>
                    <input type="time" value={d.start} className="avail-time-input"
                      onChange={e => setDay(day, 'start', e.target.value)}/>
                    <span className="avail-dash">—</span>
                    <input type="time" value={d.end} className="avail-time-input"
                      onChange={e => setDay(day, 'end', e.target.value)}/>
                  </>
                ) : (
                  <span className="avail-closed-label">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Slot settings */}
      <div className="avail-section">
        <h3 className="section-heading" style={{ marginBottom: '1rem' }}>Slot Settings</h3>
        <div className="avail-slot-grid">
          <div className="form-group">
            <label>Appointment duration</label>
            <select className="avail-select"
              value={avail.slot_duration}
              onChange={e => setAvail(a => ({ ...a, slot_duration: +e.target.value }))}>
              {[15,20,30,45,60,90,120].map(m => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Buffer between slots</label>
            <select className="avail-select"
              value={avail.buffer_minutes}
              onChange={e => setAvail(a => ({ ...a, buffer_minutes: +e.target.value }))}>
              {[0,5,10,15,20,30].map(m => (
                <option key={m} value={m}>{m === 0 ? 'No buffer' : `${m} minutes`}</option>
              ))}
            </select>
            <p className="field-hint">Gap between end of one slot and start of the next (e.g. cleanup time)</p>
          </div>
        </div>
      </div>

      {/* Blocked dates */}
      <div className="avail-section">
        <h3 className="section-heading" style={{ marginBottom: '1rem' }}>
          <Ban size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/>
          Holidays & Blocked Dates
        </h3>
        <div className="avail-blocked-add">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="avail-date-input" min={new Date().toISOString().slice(0,10)}/>
          <button className="btn-primary" onClick={addBlocked} disabled={!newDate}>
            <Plus size={14}/> Block Date
          </button>
        </div>
        {avail.blocked_dates.length === 0
          ? <p className="field-hint" style={{ marginTop: '0.75rem' }}>No blocked dates. AI will treat all open days as available.</p>
          : (
            <div className="avail-blocked-list">
              {avail.blocked_dates.map(d => (
                <div key={d} className="avail-blocked-chip">
                  <Ban size={11}/>
                  {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                  <button onClick={() => removeBlocked(d)} className="avail-chip-del"><X size={11}/></button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {saveError && (
        <div className="ext-db-msg err" style={{ marginBottom: '0.75rem' }}>
          <X size={13}/> {saveError}
        </div>
      )}
      <button className="btn-primary" onClick={save} disabled={saving}>
        {saved ? <><Check size={14}/> Schedule saved!</> : saving ? 'Saving...' : <><Save size={14}/> Save Schedule</>}
      </button>
    </div>
  );
}

/* ── Bookings viewer ───────────────────────────────────────────────────────── */

function BookingsTab({ business }) {
  const bookingTables = (business.tables || []).filter(t =>
    t.columns?.some(c => ['time','date','appointment','booking','slot'].some(k => c.name.toLowerCase().includes(k)))
  );
  const [activeTable, setActiveTable] = useState(bookingTables[0]?.name || null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    if (!activeTable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.get(`/businesses/${business.id}/records/${activeTable}`)
      .then(({ data }) => setRecords(data))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [activeTable, business.id]);

  const filtered = dateFilter
    ? records.filter(r => Object.values(r).some(v => String(v).startsWith(dateFilter)))
    : records;

  if (bookingTables.length === 0)
    return <div className="empty-tab">No booking/appointment tables found. Upload a business document to create tables.</div>;

  return (
    <div>
      {/* Table selector */}
      {bookingTables.length > 1 && (
        <div className="bookings-table-tabs">
          {bookingTables.map(t => (
            <button key={t.name}
              className={`bookings-table-tab ${activeTable === t.name ? 'active' : ''}`}
              onClick={() => setActiveTable(t.name)}>
              <Table2 size={13}/> {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Filters + stats */}
      <div className="bookings-toolbar">
        <div className="bookings-count">
          <ClipboardList size={14}/> {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          {dateFilter && ` on ${dateFilter}`}
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="avail-date-input" placeholder="Filter by date"/>
        {dateFilter && <button className="avail-chip-del" onClick={() => setDateFilter('')} style={{ padding: '0.4rem' }}><X size={13}/></button>}
      </div>

      {/* Records table */}
      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="empty-tab">No records found{dateFilter ? ` for ${dateFilter}` : ''}.</div>
      ) : (
        <div className="bookings-table-wrap">
          {(() => {
            const PRIORITY_COLS = ['customer_name','name','appointment_time','booking_time','date','time','slot',
                                   'service','service_type','customer_phone','phone','customer_email','email'];
            const sortCols = (keys) => [
              ...PRIORITY_COLS.filter(p => keys.includes(p)),
              ...keys.filter(k => !PRIORITY_COLS.includes(k)),
            ];
            const headerKeys = sortCols(Object.keys(filtered[0]).filter(k => k !== 'id'));
            return (
          <table className="bookings-table">
            <thead>
              <tr>{headerKeys.map(k => <th key={k}>{k.replace(/_/g,' ')}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const sorted = sortCols(Object.keys(row).filter(k => k !== 'id'));
                return (
                  <tr key={i}>
                    {sorted.map(k => {
                      const v = row[k];
                      const isEmail = k.includes('email');
                      const isPhone = k.includes('phone');
                      const isTime  = ['time','date','appointment','slot'].some(w => k.includes(w));
                      return (
                        <td key={k}>
                          {v == null ? '—' : isEmail
                            ? <a href={`mailto:${v}`} className="booking-email-link">{String(v)}</a>
                            : isPhone
                            ? <a href={`tel:${v}`} className="booking-phone-link">{String(v)}</a>
                            : isTime
                            ? <span className="booking-time-val">{String(v)}</span>
                            : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */

const PRIMARY_TABS = [
  { id: 'overview',      label: 'Overview',      Icon: MessageSquare },
  { id: 'bookings',      label: 'Bookings',       Icon: ClipboardList },
  { id: 'availability',  label: 'Availability',   Icon: Clock },
  { id: 'database',      label: 'Database',       Icon: Database },
  { id: 'customize',     label: 'Customize',      Icon: Palette },
];
const SECONDARY_TABS = [
  { id: 'embed', label: 'Embed',    Icon: Code2 },
  { id: 'pdf',   label: 'Document', Icon: FileText },
];

/* ══════════════════════════════════════════════════════════════════════════ */

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  useAuth();
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

  // custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);

  // external DB state
  const [extDbUrl, setExtDbUrl] = useState('');
  const [extDbConnected, setExtDbConnected] = useState(false);
  const [extDbTesting, setExtDbTesting] = useState(false);
  const [extDbSaving, setExtDbSaving] = useState(false);
  const [extDbStatus, setExtDbStatus] = useState(null);
  const [migrating, setMigrating] = useState(false);

  // PDF blob — fetch with auth token so iframe can render it
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    api.get(`/businesses/${id}`)
      .then(({ data }) => {
        setBusiness(data);
        const wc = data.widget_config || {};
        setCfg({
          primary_color: '#6366f1',
          bg_color: '#0b0f1a',
          input_color: '#111827',
          position: 'right',
          language: 'auto',
          ...wc,
        });
        setCustomPrompt(data.custom_prompt || '');
        setExtDbConnected(data.external_db_connected || false);
        // availability loaded directly from data in AvailabilityTab
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

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
      setCfg({ primary_color: '#6366f1', bg_color: '#0b0f1a', input_color: '#111827', position: 'right', language: 'auto', ...data });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, business?.id]);

  const handleSavePrompt = async () => {
    setPromptSaving(true);
    try {
      await api.put(`/businesses/${id}/custom-prompt`, { custom_prompt: customPrompt });
      toast.success('Instructions saved.');
    } catch { toast.error('Failed to save instructions.'); }
    finally { setPromptSaving(false); }
  };

  const handleTestExtDb = async () => {
    setExtDbTesting(true); setExtDbStatus(null);
    try {
      const { data } = await api.post(`/businesses/${id}/test-external-db`, { url: extDbUrl });
      setExtDbStatus(data);
      if (data.ok) toast.success(data.message || 'Connection successful.');
      else toast.error(data.message || 'Connection failed.');
    } catch { toast.error('Request failed.'); }
    finally { setExtDbTesting(false); }
  };

  const handleSaveExtDb = async () => {
    setExtDbSaving(true); setExtDbStatus(null);
    try {
      const { data } = await api.put(`/businesses/${id}/external-db`, { url: extDbUrl });
      setExtDbConnected(data.connected);
      if (!data.connected) setExtDbUrl('');
      toast[data.connected ? 'success' : 'error'](data.connected ? 'Connected & saved.' : 'Disconnected.');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save.');
    } finally { setExtDbSaving(false); }
  };

  const handleMigrateTables = async () => {
    setMigrating(true); setExtDbStatus(null);
    try {
      const { data } = await api.post(`/businesses/${id}/migrate-tables`);
      toast.success(data.message + (data.skipped?.length ? ` (${data.skipped.length} skipped)` : ''));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Migration failed.');
    } finally { setMigrating(false); }
  };


  if (loading) return (
    <AppShell>
      <TableSkeleton rows={10} />
    </AppShell>
  );
  if (!business) return null;

  const embedCode = `<script src="${window.location.origin}/widget.js" data-token="${business.public_token}"></script>`;
  const widgetUrl = `${window.location.origin}/widget-chat?token=${business.public_token}`;

  return (
    <AppShell>
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
                ? <img src={`${API_BASE}${cfg.logo_url}`} alt="logo" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }}/>
                : <Building2 size={22} color="var(--accent)"/>
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.15rem' }}>
                <h1 className="detail-title" style={{ margin: 0 }}>{business.name}</h1>
                <span className="live-badge"><span className="live-badge-dot"/>Live</span>
              </div>
              <p className="detail-type" style={{ marginBottom: '0.35rem' }}>
                {business.type}
                {business.description ? ` — ${business.description.slice(0, 80)}${business.description.length > 80 ? '…' : ''}` : ''}
              </p>
              <div className="detail-stat-strip">
                <span><strong>{business.tables?.length || 0}</strong> tables</span>
                <span className="dss-sep">·</span>
                <span><strong>{business.conversation_count || 0}</strong> conversations</span>
                <span className="dss-sep">·</span>
                <span><strong>{business.tables?.reduce((s, t) => s + (t.row_count || 0), 0) || 0}</strong> records</span>
                {business.has_pdf && <><span className="dss-sep">·</span><span className="dss-pdf">PDF uploaded</span></>}
              </div>
              <CapabilityBadges caps={business.capabilities} />
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

        {/* Tabs: primary + secondary */}
        <div className="tab-bar-wrap">
          <div className="tab-bar">
            {PRIMARY_TABS.map(({ id: tid, label, Icon }) => (
              <button key={tid} className={`tab-btn ${tab === tid ? 'active' : ''}`} onClick={() => setTab(tid)}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
          <div className="tab-secondary">
            {SECONDARY_TABS.map(({ id: tid, label, Icon }) => (
              <button key={tid} className={`tab-secondary-btn ${tab === tid ? 'active' : ''}`} onClick={() => setTab(tid)}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="detail-section">
              <h3 className="section-heading">Recent Conversations</h3>
              {!business.recent_sessions?.length
                ? <div className="empty-tab">No conversations yet. <Link to={`/chat?business_id=${id}`}>Start testing</Link></div>
                : <div className="sessions-list">
                    {business.recent_sessions.map((s, idx) => {
                      const dotClass = s.message_count >= 6 ? 'hot' : s.message_count >= 3 ? 'warm' : 'cold';
                      const relDate = s.created_at
                        ? (() => {
                            const diff = Date.now() - new Date(s.created_at).getTime();
                            const h = Math.floor(diff / 3600000);
                            if (h < 1) return 'Just now';
                            if (h < 24) return `${h}h ago`;
                            return `${Math.floor(h / 24)}d ago`;
                          })()
                        : '-';
                      const channel = s.id?.startsWith('widget-') ? 'Widget' : s.id?.startsWith('test-') ? 'Test' : 'Chat';
                      return (
                        <div key={s.id} className="session-row clickable" onClick={() => setViewSession(s.id)}>
                          <span className={`session-dot ${dotClass}`}/>
                          <span className="session-visitor">Visitor {business.recent_sessions.length - idx}</span>
                          <span className="session-channel">{channel}</span>
                          <span className="session-msgs">{s.message_count} msg{s.message_count !== 1 ? 's' : ''}</span>
                          <span className="session-date">{relDate}</span>
                          <span className="session-view">View →</span>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          </motion.div>
        )}

        {/* ── Database ── */}
        {tab === 'database' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            {business.tables?.length === 0
              ? <div className="empty-tab">No tables yet — upload a business document to auto-create them.</div>
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

        {/* ── Bookings ── */}
        {tab === 'bookings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <BookingsTab business={business} />
          </motion.div>
        )}

        {/* ── Availability ── */}
        {tab === 'availability' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <AvailabilityTab businessId={id} initial={business.availability} />
          </motion.div>
        )}

        {/* ── Customize ── */}
        {tab === 'customize' && cfg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
            <div className="customize-layout">
              <div className="customize-form">

                {/* ── Section: Identity ── */}
                <div className="cust-section">
                  <div className="cust-section-label">Identity</div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Logo</label>
                    <div className="logo-upload-row">
                      {cfg.logo_url
                        ? <img src={`${API_BASE}${cfg.logo_url}`} alt="logo" className="logo-preview"/>
                        : <div className="logo-placeholder"><Building2 size={20} color="var(--text-muted)"/></div>
                      }
                      <button className="btn-card-secondary" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        <Upload size={14}/> {logoUploading ? 'Uploading...' : 'Upload Logo'}
                      </button>
                      <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden onChange={handleLogoUpload}/>
                    </div>
                    <p className="field-hint">PNG, JPG, WEBP — shown in widget header</p>
                  </div>
                  <div className="cust-row-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Bot Name</label>
                      <input type="text" value={cfg.bot_name || ''} onChange={e => setCfg(p => ({ ...p, bot_name: e.target.value }))} placeholder="AI Assistant"/>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Bot Language</label>
                      <select value={cfg.language || 'auto'} onChange={e => setCfg(p => ({ ...p, language: e.target.value }))}>
                        <option value="auto">🌐 Auto-detect</option>
                        <option value="en">🇬🇧 English</option>
                        <option value="ur">🇵🇰 Urdu</option>
                        <option value="ar">🇸🇦 Arabic</option>
                        <option value="fr">🇫🇷 French</option>
                        <option value="es">🇪🇸 Spanish</option>
                        <option value="de">🇩🇪 German</option>
                        <option value="hi">🇮🇳 Hindi</option>
                        <option value="zh">🇨🇳 Chinese</option>
                        <option value="pt">🇧🇷 Portuguese</option>
                        <option value="tr">🇹🇷 Turkish</option>
                        <option value="ru">🇷🇺 Russian</option>
                        <option value="bn">🇧🇩 Bengali</option>
                        <option value="id">🇮🇩 Indonesian</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Widget Position</label>
                      <div className="position-toggle">
                        {['right', 'left'].map(pos => (
                          <button key={pos} className={`position-btn ${(cfg.position || 'right') === pos ? 'active' : ''}`}
                            onClick={() => setCfg(p => ({ ...p, position: pos }))}>
                            Bottom {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                    <label>Welcome Message</label>
                    <textarea className="form-textarea" value={cfg.welcome_message || ''} onChange={e => setCfg(p => ({ ...p, welcome_message: e.target.value }))} placeholder="Hi! How can I help you today?" rows={2}/>
                  </div>
                </div>

                {/* ── Section: Colors ── */}
                <div className="cust-section">
                  <div className="cust-section-label">Colors</div>
                  <div className="cust-row-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Accent <span className="field-hint" style={{ display:'inline' }}>(header, buttons)</span></label>
                      <div className="color-row">
                        <input type="color" className="color-picker" value={cfg.primary_color || '#6366f1'} onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))}/>
                        <input type="text" value={cfg.primary_color || '#6366f1'} onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))} className="color-hex-input" placeholder="#6366f1"/>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Background <span className="field-hint" style={{ display:'inline' }}>(chat area)</span></label>
                      <div className="color-row">
                        <input type="color" className="color-picker" value={cfg.bg_color || '#0b0f1a'} onChange={e => setCfg(p => ({ ...p, bg_color: e.target.value }))}/>
                        <input type="text" value={cfg.bg_color || '#0b0f1a'} onChange={e => setCfg(p => ({ ...p, bg_color: e.target.value }))} className="color-hex-input" placeholder="#0b0f1a"/>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Input Bar <span className="field-hint" style={{ display:'inline' }}>(footer)</span></label>
                      <div className="color-row">
                        <input type="color" className="color-picker" value={cfg.input_color || '#111827'} onChange={e => setCfg(p => ({ ...p, input_color: e.target.value }))}/>
                        <input type="text" value={cfg.input_color || '#111827'} onChange={e => setCfg(p => ({ ...p, input_color: e.target.value }))} className="color-hex-input" placeholder="#111827"/>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary" onClick={handleSaveCfg} disabled={saving}>
                    {saveOk ? <><Check size={15}/> Saved!</> : saving ? 'Saving...' : <><Save size={15}/> Save Changes</>}
                  </button>
                </div>

                {/* ── Custom System Prompt ── */}
                <div className="prompt-divider"/>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Bot Instructions
                    <span className="optional-badge">optional</span>
                  </label>
                  <textarea
                    className="form-textarea prompt-textarea"
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder={`Leave blank to use the default AI behaviour.\n\nExamples:\n• You are a friendly receptionist at City Dental. Only book on weekdays 9am–5pm.\n• Always greet customers by name. Never discuss competitor prices.\n• Respond only in formal English.`}
                    rows={7}
                  />
                  <p className="field-hint">
                    This replaces the default intro. The business rules, schema and tool instructions are always kept.
                  </p>
                </div>

                <button className="btn-primary" onClick={handleSavePrompt} disabled={promptSaving} style={{ marginTop: '0.25rem' }}>
                  {promptSaving ? 'Saving...' : <><Save size={15}/> Save Instructions</>}
                </button>

                {/* ── External Database ── */}
                <div className="prompt-divider"/>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    External Database
                    <span className="optional-badge">optional</span>
                    {extDbConnected && <span className="ext-db-badge connected">● Connected</span>}
                  </label>
                  <input
                    type="password"
                    value={extDbUrl}
                    onChange={e => { setExtDbUrl(e.target.value); setExtDbStatus(null); }}
                    placeholder="postgresql://user:pass@host:5432/dbname"
                    autoComplete="off"
                  />
                  <p className="field-hint">
                    Business tables (bookings, orders) will be created and stored in this database.
                    Leave blank to use the platform database.
                    {extDbConnected && ' Clear the field and save to disconnect.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <button className="btn-card-secondary" onClick={handleTestExtDb} disabled={extDbTesting || !extDbUrl}>
                    {extDbTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button className="btn-primary" onClick={handleSaveExtDb} disabled={extDbSaving}>
                    {extDbSaving ? 'Saving...' : <><Save size={14}/> Save</>}
                  </button>
                  {extDbConnected && (
                    <button className="btn-card-secondary" onClick={handleMigrateTables} disabled={migrating}
                      title="Create all business tables in the external DB (run once after connecting)">
                      <Database size={13}/> {migrating ? 'Migrating...' : 'Migrate Tables'}
                    </button>
                  )}
                </div>
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

      <AnimatePresence>
        {viewSession && (
          <ConversationModal sessionId={viewSession} onClose={() => setViewSession(null)}/>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
