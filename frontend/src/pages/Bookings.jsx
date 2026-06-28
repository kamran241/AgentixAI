import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, RefreshCw, Clock, User, Phone, Mail,
  Building2, Calendar, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import AppShell from '../components/AppShell';
import { BookingsSkeleton } from '../components/Skeleton';
import { TIME_KEYS, NAME_KEYS, PHONE_KEYS, EMAIL_KEYS, pick, pickEmail, pickPhone, formatTime } from '../utils/bookingFields';

/* ── Booking detail modal ──────────────────────────────────────────────────── */

function BookingModal({ booking: b, onClose }) {
  const time  = pick(b, TIME_KEYS);
  const name  = pick(b, NAME_KEYS);
  const phone = pickPhone(b);
  const email = pickEmail(b);
  const isOrder = b.record_type === 'order';

  const extraKeys = Object.keys(b).filter(k =>
    !['business_id','business_name','table','id','session_id','created_at','record_type',
      ...TIME_KEYS, ...NAME_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS].includes(k) &&
    !k.toLowerCase().includes('email') && !k.toLowerCase().includes('phone') &&
    !k.toLowerCase().includes('name') && !k.toLowerCase().includes('time') &&
    !k.toLowerCase().includes('date')
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="booking-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18 }}
      >
        {/* Header */}
        <div className="bm-header">
          <div className="bm-header-left">
            <span className={`bm-type-badge ${isOrder ? 'order' : 'booking'}`}>
              {b.record_type || 'booking'}
            </span>
            <div className="bm-biz">{b.business_name}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="bm-body">

          {/* Primary info cards */}
          <div className="bm-primary-grid">
            {name && (
              <div className="bm-info-card">
                <div className="bm-info-icon"><User size={14}/></div>
                <div>
                  <div className="bm-info-label">Customer</div>
                  <div className="bm-info-value">{name}</div>
                </div>
              </div>
            )}
            {time && (
              <div className="bm-info-card">
                <div className="bm-info-icon"><Calendar size={14}/></div>
                <div>
                  <div className="bm-info-label">Date & Time</div>
                  <div className="bm-info-value">{formatTime(time)}</div>
                </div>
              </div>
            )}
            {phone && (
              <div className="bm-info-card">
                <div className="bm-info-icon"><Phone size={14}/></div>
                <div>
                  <div className="bm-info-label">Phone</div>
                  <div className="bm-info-value">
                    <a href={`tel:${phone}`} className="bm-link">{phone}</a>
                  </div>
                </div>
              </div>
            )}
            {email && (
              <div className="bm-info-card">
                <div className="bm-info-icon"><Mail size={14}/></div>
                <div>
                  <div className="bm-info-label">Email</div>
                  <div className="bm-info-value">
                    <a href={`mailto:${email}`} className="bm-link">{email}</a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Extra fields */}
          {extraKeys.length > 0 && (
            <div className="bm-extras-section">
              <div className="bm-extras-label">Additional Details</div>
              <div className="bm-extras-grid">
                {extraKeys.map(k => (
                  <div key={k} className="bm-extra-row">
                    <span className="bm-extra-key">{k.replace(/_/g, ' ')}</span>
                    <span className="bm-extra-val">{b[k] ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business + created */}
          <div className="bm-meta-row">
            <div className="bm-meta-item">
              <Building2 size={12}/>
              <span>{b.business_name}</span>
            </div>
            {b.created_at && (
              <div className="bm-meta-item">
                <Clock size={12}/>
                <span>Saved {(() => {
                  const diff = Date.now() - new Date(b.created_at).getTime();
                  const h = Math.floor(diff / 3600000);
                  if (h < 1) return 'just now';
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                })()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bm-footer">
          <Link to={`/business/${b.business_id}?tab=bookings`} className="btn-card-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ExternalLink size={13}/> View in business
          </Link>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Bookings() {
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState('all');
  const [businesses, setBusinesses]     = useState([]);
  const [selectedBooking, setSelected]  = useState(null);

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

  return (
    <AppShell>
      <AnimatePresence>
        {selectedBooking && (
          <BookingModal booking={selectedBooking} onClose={() => setSelected(null)}/>
        )}
      </AnimatePresence>

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
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <BookingsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="empty-tab" style={{ marginTop: '3rem' }}>
          {bookings.length === 0
            ? "No records yet. Once customers place orders or book via the widget, they'll appear here."
            : 'No records match your search.'}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bookings-page-list">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Showing {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
          </div>

          {filtered.map((b, i) => {
            const time  = pick(b, TIME_KEYS);
            const name  = pick(b, NAME_KEYS);
            const phone = pickPhone(b);
            const email = pickEmail(b);
            const leftoverKeys = Object.keys(b).filter(k =>
              !['business_id','business_name','table','id','session_id','created_at','record_type',
                ...TIME_KEYS,...NAME_KEYS,...PHONE_KEYS,...EMAIL_KEYS].includes(k) &&
              !k.toLowerCase().includes('email') && !k.toLowerCase().includes('phone') &&
              !k.toLowerCase().includes('name') && !k.toLowerCase().includes('time') &&
              !k.toLowerCase().includes('date')
            );

            return (
              <motion.div key={i} className="booking-row"
                style={{ cursor: 'pointer' }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelected(b)}>

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

                {/* Customer info */}
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

                {/* Click hint */}
                <span className="booking-row-hint">View details →</span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AppShell>
  );
}
