import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Plus, LogOut, Building2, Calendar, Package, Truck,
  FileUp, X, ChevronRight, MessageSquare, Database, Bot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const UPLOAD_STEPS = [
  'Uploading file...',
  'Reading document...',
  'Extracting rules...',
  'Designing schema...',
  'Building knowledge base...',
];

function CapBadges({ caps }) {
  if (!caps) return null;
  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
      {caps.has_orders && <span className="capability-badge badge-orders"><Package size={10} /> Orders</span>}
      {caps.has_bookings && <span className="capability-badge badge-bookings"><Calendar size={10} /> Bookings</span>}
      {caps.has_delivery && <span className="capability-badge badge-delivery"><Truck size={10} /> Delivery</span>}
    </div>
  );
}

function UploadModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const timers = useRef([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    setStep(0);

    timers.current = UPLOAD_STEPS.slice(1).map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 2200)
    );

    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/businesses/ingest', fd);
      timers.current.forEach(clearTimeout);
      onSuccess(data);
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
      >
        <div className="modal-header">
          <h3>Add New Business</h3>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="modal-sub">Upload your business PDF — menu, service guide, price list. The AI does the rest.</p>

        {!uploading ? (
          <div className="upload-card" onClick={() => document.getElementById('modal-upload').click()}>
            <FileUp size={32} color="var(--accent)" />
            <h4>Choose a PDF or text file</h4>
            <p>We'll extract your business rules and design the database automatically</p>
            <input id="modal-upload" type="file" accept=".pdf,.txt" hidden onChange={handleFile} />
          </div>
        ) : (
          <div className="upload-progress">
            {UPLOAD_STEPS.map((s, i) => (
              <div key={i} className={`upload-progress-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                <span>{i < step ? '✓' : i === step ? '›' : '○'}</span>
                {s}
              </div>
            ))}
          </div>
        )}

        {error && <div className="form-error" style={{ marginTop: '1rem' }}>{error}</div>}
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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

  const handleUploadSuccess = (data) => {
    setShowModal(false);
    navigate(`/business/${data.business_id}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
          <Link to="/dashboard" className="shell-nav-item active">
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
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Businesses</h1>
            <p className="page-sub">Manage your AI-powered assistants</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Business
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : businesses.length === 0 ? (
          <div className="empty-dashboard">
            <div className="empty-dashboard-icon">
              <Bot size={40} color="var(--accent)" />
            </div>
            <h2>No businesses yet</h2>
            <p>Upload a business PDF to create your first AI assistant.</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Add your first business
            </button>
          </div>
        ) : (
          <div className="business-grid">
            {businesses.map((b) => (
              <motion.div
                key={b.id}
                className="business-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ translateY: -2 }}
              >
                <div className="business-card-header">
                  <div className="business-card-icon">
                    <Building2 size={18} color="var(--accent)" />
                  </div>
                  <span className="business-card-type">{b.type}</span>
                </div>
                <h3 className="business-card-name">{b.name}</h3>
                <p className="business-card-desc">{b.description?.slice(0, 100)}{b.description?.length > 100 ? '...' : ''}</p>
                <CapBadges caps={b.capabilities} />

                <div className="business-card-stats">
                  <div className="biz-stat">
                    <Database size={13} />
                    {b.tables?.length || 0} table{b.tables?.length !== 1 ? 's' : ''}
                  </div>
                  <div className="biz-stat">
                    <MessageSquare size={13} />
                    {b.conversation_count || 0} conversation{b.conversation_count !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="business-card-actions">
                  <Link to={`/business/${b.id}`} className="btn-card">
                    Manage <ChevronRight size={14} />
                  </Link>
                  <Link to={`/chat?business_id=${b.id}`} className="btn-card-secondary">
                    <Bot size={14} /> Test chat
                  </Link>
                </div>
              </motion.div>
            ))}

            {/* Add new card */}
            <motion.button
              className="business-card add-card"
              onClick={() => setShowModal(true)}
              whileHover={{ translateY: -2 }}
            >
              <Plus size={28} color="var(--accent)" />
              <span>Add Business</span>
            </motion.button>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showModal && (
          <UploadModal onClose={() => setShowModal(false)} onSuccess={handleUploadSuccess} />
        )}
      </AnimatePresence>
    </div>
  );
}
