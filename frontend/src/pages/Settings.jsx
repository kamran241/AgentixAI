import { useState } from 'react';
import {
  User, Lock, Eye, EyeOff, Save, Shield,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import AppShell from '../components/AppShell';

const TABS = [
  { id: 'profile',  label: 'Profile',  Icon: User   },
  { id: 'security', label: 'Security', Icon: Shield  },
];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');

  /* ── Profile form ── */
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const { data } = await api.put('/auth/profile', profile);
      updateUser(data);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed.');
    } finally { setProfileSaving(false); }
  };

  /* ── Password form ── */
  const [pw, setPw]         = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);

  const toggleShow = (k) => setShowPw(p => ({ ...p, [k]: !p[k] }));

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { toast.error('New passwords do not match.'); return; }
    if (pw.next.length < 8)    { toast.error('Password must be at least 8 characters.'); return; }
    setPwSaving(true);
    try {
      await api.put('/auth/password', { current_password: pw.current, new_password: pw.next });
      toast.success('Password changed successfully.');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password.');
    } finally { setPwSaving(false); }
  };

  return (
    <AppShell showPromo>
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

            <div className="settings-avatar-row">
              <div className="settings-avatar">{user?.name?.[0]?.toUpperCase()}</div>
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
                { key: 'current', label: 'Current Password',     placeholder: 'Enter current password' },
                { key: 'next',    label: 'New Password',          placeholder: 'Min. 8 characters' },
                { key: 'confirm', label: 'Confirm New Password',  placeholder: 'Repeat new password' },
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
              <button type="submit" className="btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Updating…' : <><Shield size={14}/> Update Password</>}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
