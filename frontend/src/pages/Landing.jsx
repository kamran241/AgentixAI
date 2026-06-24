import { Link } from 'react-router-dom';
import { Zap, Upload, Brain, Globe, ArrowRight, Check, Calendar, Package, Truck, Github } from 'lucide-react';

const FEATURES = [
  {
    icon: Upload,
    title: 'Upload Any Business PDF',
    desc: 'Menu, service guide, price list — our AI reads your document and understands your business instantly.',
  },
  {
    icon: Brain,
    title: 'AI Designs Your Database',
    desc: 'No manual setup. The LLM designs the perfect database schema for your specific business type.',
  },
  {
    icon: Globe,
    title: 'Embed on Any Website',
    desc: 'Paste one line of code and your AI assistant is live on your site, handling bookings 24/7.',
  },
];

const STEPS = [
  { n: '01', title: 'Upload your PDF', desc: 'Drop your business document. Agentix handles the rest.' },
  { n: '02', title: 'AI sets everything up', desc: 'Your assistant is trained, your database is built automatically.' },
  { n: '03', title: 'Embed on your site', desc: 'Copy one script tag. Customers can chat instantly.' },
];

const USE_CASES = [
  { icon: Calendar, label: 'Dental Clinics', desc: 'Appointment scheduling & patient FAQ' },
  { icon: Calendar, label: 'Salons & Spas', desc: 'Service bookings & price inquiries' },
  { icon: Package, label: 'Restaurants', desc: 'Table reservations & menu questions' },
  { icon: Truck, label: 'Hotels', desc: 'Room booking & guest services' },
];

export default function Landing() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="logo-icon small">
              <Zap size={16} color="white" fill="white" />
            </div>
            <span>Agentix</span>
          </div>
          <div className="landing-nav-links">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="nav-link">
              <Github size={16} />
              GitHub
            </a>
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/register" className="btn-primary-sm">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge-dot" />
          Open Source • Free Forever
        </div>
        <h1 className="hero-title">
          AI Booking Assistant<br />
          <span className="gradient-text">for Any Business</span>
        </h1>
        <p className="hero-sub">
          Upload your business guide and get an intelligent assistant that handles bookings,
          answers questions, and manages reservations — automatically configured for your business.
        </p>
        <div className="hero-cta">
          <Link to="/register" className="btn-hero-primary">
            Start for free <ArrowRight size={16} />
          </Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="btn-hero-secondary">
            <Github size={16} /> View on GitHub
          </a>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-num">2 min</span>
            <span className="hero-stat-label">Setup time</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-num">Zero</span>
            <span className="hero-stat-label">Coding required</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-num">Any</span>
            <span className="hero-stat-label">Business type</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label">Features</div>
          <h2 className="section-title">Everything you need, nothing you don't</h2>
          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div className="feature-icon">
                  <Icon size={22} color="var(--accent)" />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section alt-bg">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Live in three steps</h2>
          <div className="steps-grid">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="step-card">
                <div className="step-number">{n}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label">Use cases</div>
          <h2 className="section-title">Built for real businesses</h2>
          <div className="usecases-grid">
            {USE_CASES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="usecase-card">
                <Icon size={20} color="var(--accent)" />
                <div>
                  <div className="usecase-label">{label}</div>
                  <div className="usecase-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source CTA */}
      <section className="section cta-section">
        <div className="section-inner cta-inner">
          <h2 className="section-title">Open source & self-hostable</h2>
          <p className="hero-sub" style={{ maxWidth: '520px', margin: '0 auto 2rem' }}>
            Deploy on your own infrastructure. No vendor lock-in. Full control of your data.
          </p>
          <div className="cta-checks">
            {['MIT Licensed', 'Self-hostable with Docker', 'PostgreSQL or SQLite', 'Groq LLM API'].map((item) => (
              <div key={item} className="cta-check">
                <Check size={14} color="var(--success)" />
                {item}
              </div>
            ))}
          </div>
          <div className="hero-cta" style={{ marginTop: '2rem' }}>
            <Link to="/register" className="btn-hero-primary">
              Get started free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-logo">
          <div className="logo-icon small">
            <Zap size={14} color="white" fill="white" />
          </div>
          <span>Agentix</span>
        </div>
        <p className="footer-copy">Open source AI booking platform. MIT License.</p>
      </footer>
    </div>
  );
}
