import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Building2, Calendar, LogOut, ChevronLeft, ChevronRight,
  User, Lock, Check, X, Eye, EyeOff, Sparkles, Settings as SettingsIcon,
  Save, Shield,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const TABS = [
  { id: 'profile',  label: 'Profile',  Icon: User   },
  { id: 'security', label: 'Security', Icon: Shield  },
];

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [sbCollapsed, setSbCollapsed] = useState(() => localStorage.getItem('sb-collapsed') === 'true');
  const toggleSidebar = () => setSbCollapsed(v => { const n = !v; localStorage.setItem('sb-collapsed', String(n)); return n; });
  const [tab, setTab] = useState('profile');

  /* ── Profile form ── */
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg]       = useState(null); // {ok, text}

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg(null);
    try {
      const { data } = await api.put('/auth/profile', profile);
      updateUser(data);
      setProfileMsg({ ok: true, text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ ok: false, text: err.response?.data?.detail || 'Update failed.' });
    } finally { setProfileSaving(false); }
  };

  /* ── Password form ── */
  const [pw, setPw]           = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw]   = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwMsg, setPwMsg]         = useState(null);

  const toggleShow = (k) => setShowPw(p => ({ ...p, [k]: !p[k] }));

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    if (pw.next.length < 8)    { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      await api.put('/auth/password', { current_password: pw.current, new_password: pw.next });
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.detail || 'Failed to change password.' });
    } finally { setPwSaving(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`shell-sidebar${sbCollapsed ? ' collapsed' : ''}`}>
        <button className="sidebar-collapse-btn" onClick={toggleSidebar}>
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
          <Link to="/bookings" className="shell-nav-item" title="Bookings">
            <Calendar size={16}/><span className="nav-label">Bookings</span>
          </Link>
          <Link to="/settings" className="shell-nav-item active" title="Settings">
            <SettingsIcon size={16}/><span className="nav-label">Settings</span>
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
          <button className="shell-logout" onClick={handleLogout}>
            <LogOut size={14}/><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="shell-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">Manage your account and security preferences</p>
          </div>
        </div>

        <div className="tab-bar" style={{ marginBottom: '1.75rem' }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>

        <div className="settings-layout">
          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <User size={16} color="var(--accent)"/>
                </div>
                <div>
                  <h3 className="settings-card-title">Profile Information</h3>
                  <p className="settings-card-sub">Update your name and email address</p>
                </div>
              </div>

              {/* Avatar */}
              <div className="settings-avatar-row">
                <div className="settings-avatar">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="settings-avatar-name">{user?.name}</div>
                  <div className="settings-avatar-email">{user?.email}</div>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="settings-form">
                <div className="settings-field">
                  <label>Full Name</label>
                  <input type="text" value={profile.name}
                    onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    placeholder="Your name" required/>
                </div>
                <div className="settings-field">
                  <label>Email Address</label>
                  <input type="email" value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com" required/>
                </div>

                {profileMsg && (
                  <div className={`settings-msg ${profileMsg.ok ? 'ok' : 'err'}`}>
                    {profileMsg.ok ? <Check size={13}/> : <X size={13}/>}
                    {profileMsg.text}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : <><Save size={14}/> Save Profile</>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Security tab ── */}
          {tab === 'security' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Lock size={16} color="#10b981"/>
                </div>
                <div>
                  <h3 className="settings-card-title">Change Password</h3>
                  <p className="settings-card-sub">Use a strong password you don't use elsewhere</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSave} className="settings-form">
                {[
                  { key: 'current', label: 'Current Password',  placeholder: 'Enter current password' },
                  { key: 'next',    label: 'New Password',       placeholder: 'Min. 8 characters' },
                  { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="settings-field">
                    <label>{label}</label>
                    <div className="settings-pw-wrap">
                      <input
                        type={showPw[key] ? 'text' : 'password'}
                        value={pw[key]}
                        onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        required
                      />
                      <button type="button" className="settings-eye" onClick={() => toggleShow(key)}>
                        {showPw[key] ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>
                  </div>
                ))}

                {pwMsg && (
                  <div className={`settings-msg ${pwMsg.ok ? 'ok' : 'err'}`}>
                    {pwMsg.ok ? <Check size={13}/> : <X size={13}/>}
                    {pwMsg.text}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Updating…' : <><Shield size={14}/> Update Password</>}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
