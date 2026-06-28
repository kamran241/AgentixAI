import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, Settings, LogOut, ChevronLeft, ChevronRight, Sparkles,
  Bell, CalendarCheck, Info, X, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: Building2 },
  { to: '/bookings',  label: 'Bookings',  Icon: Calendar  },
  { to: '/settings',  label: 'Settings',  Icon: Settings  },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const fetchNotifs = () => {
    api.get('/notifications').then(({ data }) => {
      setNotifications(data);
      setUnread(data.filter(n => !n.read).length);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    api.post('/notifications/read-all').then(() => {
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnread(0);
    });
  };

  const markRead = (id) => {
    api.post(`/notifications/${id}/read`).then(() => {
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
      setUnread(c => Math.max(0, c - 1));
    });
  };

  const relTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const TypeIcon = ({ type }) => {
    if (type === 'booking') return <CalendarCheck size={13} color="#10b981"/>;
    return <Info size={13} color="#6366f1"/>;
  };

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}>
        <Bell size={17}/>
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={markAllRead}>
                <CheckCheck size={13}/> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">No notifications yet</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.read ? '' : ' unread'}`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="notif-item-icon"><TypeIcon type={n.type}/></div>
                <div className="notif-item-body">
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-msg">{n.message}</div>
                  <div className="notif-item-time">{relTime(n.created_at)}</div>
                </div>
                {!n.read && <span className="notif-dot"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children, showPromo = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sbCollapsed, setSbCollapsed] = useState(
    () => localStorage.getItem('sb-collapsed') === 'true'
  );

  const toggleSidebar = () =>
    setSbCollapsed(v => {
      const n = !v;
      localStorage.setItem('sb-collapsed', String(n));
      return n;
    });

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="app-shell">
      <aside className={`shell-sidebar${sbCollapsed ? ' collapsed' : ''}`}>
        <button className="sidebar-collapse-btn" onClick={toggleSidebar}
          title={sbCollapsed ? 'Expand' : 'Collapse'}>
          {sbCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>

        <Link to="/" className="shell-logo">
          <img src="/logo.svg" className="logo-icon small" alt="Agentix" />
          <span className="logo-text">AGENTIX</span>
        </Link>

        <nav className="shell-nav">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className={`shell-nav-item${location.pathname === to ? ' active' : ''}`}
              title={label}
            >
              <Icon size={16} /><span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="shell-sidebar-bottom">
          {showPromo && (
            <div className="sidebar-promo">
              <Sparkles size={13} color="var(--accent)" />
              <div>
                <div className="sidebar-promo-title">Open Source</div>
                <div className="sidebar-promo-sub">Star us on GitHub</div>
              </div>
            </div>
          )}
          <div className="shell-user">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <NotificationBell />
          </div>
          <button className="shell-logout" onClick={handleLogout} title="Sign out">
            <LogOut size={14} /><span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="shell-main">
        {children}
      </main>
    </div>
  );
}
