import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Building2, Calendar, LogOut, Search, X,
  RefreshCw, ChevronRight, ChevronLeft, Clock, User, Phone, Mail, Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const TIME_KEYS  = ['appointment_time','booking_time','time','slot','appointment_date','booking_date','date','order_date','created_at'];
const NAME_KEYS  = ['customer_name','name','full_name','patient_name','client_name'];
const PHONE_KEYS = ['customer_phone','phone','phone_number','mobile','contact'];
const EMAIL_KEYS = ['customer_email','email','email_address'];

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]);
  }
  return null;
}

function formatTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {}
  return val;
}

export default function Bookings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sbCollapsed, setSbCollapsed] = useState(() => localStorage.getItem('sb-collapsed') === 'true');
  const toggleSidebar = () => setSbCollapsed(v => { const n = !v; localStorage.setItem('sb-collapsed', String(n)); return n; });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all'); // 'all' | biz_id
  const [businesses, setBusinesses] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/businesses/all-bookings?limit=100');
      setBookings(data);
      const names = {};
      data.forEach(r => { names[r.business_id] = r.business_name; });
      setBusinesses(Object.entries(names).map(([id, name]) => ({ id: Number(id), name })));
    } catch {
      setBookings([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = bookings.filter(b => {
    if (filter !== 'all' && b.business_id !== Number(filter)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return Object.values(b).some(v => String(v || '').toLowerCase().includes(q));
  });

  const handleLogout = () => { logout(); navigate('/'); };

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
          <Link to="/dashboard" className="shell-nav-item" title="Dashboard">
            <Building2 size={16}/><span className="nav-label">Dashboard</span>
          </Link>
          <Link to="/bookings" className="shell-nav-item active" title="Bookings">
            <Calendar size={16}/><span className="nav-label">Bookings</span>
          </Link>
          <Link to="/settings" className="shell-nav-item" title="Settings">
            <Settings size={16}/><span className="nav-label">Settings</span>
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
          <button className="shell-logout" onClick={handleLogout} title="Sign out">
            <LogOut size={14}/><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bookings & Orders</h1>
            <p className="page-sub">All appointments and orders across your businesses</p>
          </div>
          <button className="btn-card-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''}/> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bookings-filters">
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search size={14} className="search-icon"/>
            <input className="search-input" placeholder="Search by name, phone, email, time..."
              value={search} onChange={e => setSearch(e.target.value)}/>
            {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13}/></button>}
          </div>
          <select className="avail-select" value={filter} onChange={e => setFilter(e.target.value)}
            style={{ minWidth: 160 }}>
            <option value="all">All businesses</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-state">Loading bookings...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-tab" style={{ marginTop: '3rem' }}>
            {bookings.length === 0
              ? 'No records yet. Once customers place orders or book via the widget, they\'ll appear here.'
              : 'No records match your search.'}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bookings-page-list">
            {/* Count */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Showing {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
            </div>

            {filtered.map((b, i) => {
              const time  = pick(b, TIME_KEYS);
              const name  = pick(b, NAME_KEYS);
              const phone = pick(b, PHONE_KEYS);
              const email = pick(b, EMAIL_KEYS);
              const leftoverKeys = Object.keys(b).filter(k =>
                !['business_id','business_name','table','id','session_id','created_at',
                  ...TIME_KEYS,...NAME_KEYS,...PHONE_KEYS,...EMAIL_KEYS].includes(k)
              );

              return (
                <motion.div key={i} className="booking-row"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}>
                  {/* Left: time + type badge */}
                  <div className="booking-time-col">
                    <Clock size={13} color={b.record_type === 'order' ? '#f59e0b' : 'var(--accent)'}/>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="booking-time">{formatTime(time)}</div>
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 20,
                          background: b.record_type === 'order' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                          color: b.record_type === 'order' ? '#f59e0b' : 'var(--accent)',
                          border: `1px solid ${b.record_type === 'order' ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)'}`,
                        }}>{b.record_type || 'booking'}</span>
                      </div>
                      <div className="booking-biz">{b.business_name}</div>
                    </div>
                  </div>

                  {/* Middle: customer info */}
                  <div className="booking-customer">
                    {name  && <span className="booking-field"><User size={11}/>{name}</span>}
                    {phone && <span className="booking-field"><Phone size={11}/>{phone}</span>}
                    {email && <span className="booking-field"><Mail size={11}/>{email}</span>}
                  </div>

                  {/* Extra fields */}
                  {leftoverKeys.length > 0 && (
                    <div className="booking-extras">
                      {leftoverKeys.map(k => (
                        <span key={k} className="booking-extra-chip">
                          <span className="chip-key">{k.replace(/_/g,' ')}</span> {b[k]}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Right: link */}
                  <Link to={`/business/${b.business_id}?tab=bookings`} className="booking-link">
                    <ChevronRight size={14}/>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
}
