import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left — form */}
      <div className="auth-split-left">
        <Link to="/" className="auth-split-logo">
          <div className="logo-icon small"><Zap size={15} color="white" fill="white"/></div>
          <span>Agentix</span>
        </Link>

        <div className="auth-split-form-wrap">
          <h1 className="auth-split-title">Create your account</h1>
          <p className="auth-split-sub">Free forever. No credit card needed.</p>

          <form className="auth-split-form" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label className="auth-field-label">FULL NAME</label>
              <input className="auth-field-input" type="text"
                placeholder="Jane Smith"
                value={form.name} onChange={set('name')} required autoFocus/>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label">WORK EMAIL</label>
              <input className="auth-field-input" type="email"
                placeholder="jane@company.com"
                value={form.email} onChange={set('email')} required/>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label">PASSWORD</label>
              <div className="auth-field-password">
                <input className="auth-field-input" type={showPass ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password} onChange={set('password')} required/>
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-switch-link">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right — panel */}
      <div className="auth-split-right">
        <div className="auth-right-inner">
          <div className="auth-testimonial">
            <div className="auth-quote-mark">"</div>
            <blockquote className="auth-quote-text">
              "Setting up our AI agent took 10 minutes. It now handles 80% of customer
              queries automatically — our team focuses on what actually matters."
            </blockquote>
            <div className="auth-quote-author">
              <div className="auth-author-avatar">M</div>
              <div>
                <div className="auth-author-name">Marcus Reid</div>
                <div className="auth-author-role">Founder, ReserveEasy</div>
              </div>
            </div>
          </div>

          <div className="auth-right-stats">
            <div className="auth-stat-item">
              <div className="auth-stat-label">SETUP TIME</div>
              <div className="auth-stat-value">~10 min</div>
            </div>
            <div className="auth-stat-divider"/>
            <div className="auth-stat-item">
              <div className="auth-stat-label">OPEN SOURCE</div>
              <div className="auth-stat-value">100%</div>
            </div>
            <div className="auth-stat-divider"/>
            <div className="auth-stat-item">
              <div className="auth-stat-label">FREE PLAN</div>
              <div className="auth-stat-value">Forever</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
