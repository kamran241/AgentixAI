import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left — form */}
      <div className="auth-split-left">
        <Link to="/" className="auth-split-logo">
          <img src="/logo.svg" className="logo-icon small" alt="Agentix" />
          <span>Agentix</span>
        </Link>

        <div className="auth-split-form-wrap">
          <h1 className="auth-split-title">Welcome back</h1>
          <p className="auth-split-sub">Sign in to access your AI workspace.</p>

          <form className="auth-split-form" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label className="auth-field-label">WORK EMAIL</label>
              <input className="auth-field-input" type="email"
                placeholder="jane@company.com"
                value={form.email} onChange={set('email')} required autoFocus/>
            </div>

            <div className="auth-field-group">
              <div className="auth-field-label-row">
                <label className="auth-field-label">PASSWORD</label>
                <span className="auth-forgot">Forgot password?</span>
              </div>
              <div className="auth-field-password">
                <input className="auth-field-input" type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password} onChange={set('password')} required/>
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="auth-switch-text">
            Don't have an account?{' '}
            <Link to="/register" className="auth-switch-link">Sign up for free</Link>
          </p>
        </div>
      </div>

      {/* Right — testimonial panel */}
      <div className="auth-split-right">
        <div className="auth-right-inner">
          <div className="auth-testimonial">
            <div className="auth-quote-mark">"</div>
            <blockquote className="auth-quote-text">
              "Agentix transformed our static documentation into a dynamic intelligence layer.
              It's not just search; it's active comprehension."
            </blockquote>
            <div className="auth-quote-author">
              <div className="auth-author-avatar">S</div>
              <div>
                <div className="auth-author-name">Sarah Jenkins</div>
                <div className="auth-author-role">CTO, DataTech Solutions</div>
              </div>
            </div>
          </div>

          <div className="auth-right-stats">
            <div className="auth-stat-item">
              <div className="auth-stat-label">BUSINESSES POWERED</div>
              <div className="auth-stat-value">2.4K+</div>
            </div>
            <div className="auth-stat-divider"/>
            <div className="auth-stat-item">
              <div className="auth-stat-label">CONVERSATIONS HANDLED</div>
              <div className="auth-stat-value">1.2M+</div>
            </div>
            <div className="auth-stat-divider"/>
            <div className="auth-stat-item">
              <div className="auth-stat-label">UPTIME</div>
              <div className="auth-stat-value">99.9%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
