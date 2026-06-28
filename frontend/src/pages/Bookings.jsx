import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, RefreshCw, Clock, User, Phone, Mail, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';
import AppShell from '../components/AppShell';
import { BookingsSkeleton } from '../components/Skeleton';
import { TIME_KEYS, NAME_KEYS, PHONE_KEYS, EMAIL_KEYS, pick, formatTime } from '../utils/bookingFields';

export default function Bookings() {
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

  return (
    <AppShell>
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
          <BookingsSkeleton />
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
    </AppShell>
  );
}
