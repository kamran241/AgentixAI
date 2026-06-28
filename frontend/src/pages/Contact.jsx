import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  Mail, Phone, MapPin, Send, CheckCircle,
  MessageSquare, Clock, ChevronRight, Github,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

function Reveal({ children, className, delay = 0, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      variants={fadeUp} initial="hidden" animate={inView ? 'show' : 'hidden'}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

const CONTACT_CHANNELS = [
  {
    icon: Mail,
    label: 'Email us',
    value: 'kamrancareem541@gmail.com',
    href: 'mailto:kamrancareem541@gmail.com',
    desc: 'We reply within 24 hours on business days.',
    color: '#6366f1',
  },
  {
    icon: Phone,
    label: 'Call us',
    value: '+92 300 000 0000',
    href: 'tel:+923000000000',
    desc: 'Mon – Fri, 9 am – 6 pm PKT.',
    color: '#10b981',
  },
  {
    icon: Github,
    label: 'Open an issue',
    value: 'github.com/kamran240/AgentixAI',
    href: 'https://github.com/kamran240/AgentixAI/issues',
    desc: 'Bug reports and feature requests welcome.',
    color: '#f59e0b',
  },
];

const TOPICS = [
  'General inquiry',
  'Technical support',
  'Billing',
  'Partnership / collaboration',
  'Feature request',
  'Bug report',
  'Other',
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSending(true);
    setError('');
    // Opens the user's mail client with the form data pre-filled.
    // Replace with a real email API (e.g. EmailJS, Resend, FormSpree) when ready.
    const subject = encodeURIComponent(`[Agentix] ${form.topic || 'Contact'} — ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nTopic: ${form.topic || '—'}\n\n${form.message}`
    );
    window.location.href = `mailto:kamrancareem541@gmail.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSent(true);
      setSending(false);
    }, 800);
  };

  return (
    <div className="l-page">
      {/* Nav */}
      <nav className="l-nav">
        <div className="l-nav-inner">
          <Link to="/" className="l-logo">
            <img src="/logo.svg" className="logo-icon small" alt="Agentix" />
            <span>Agentix</span>
          </Link>
          <div className="l-nav-links">
            <Link to="/#features"     className="l-nav-link">Features</Link>
            <Link to="/#how-it-works" className="l-nav-link">How it works</Link>
            <Link to="/#use-cases"    className="l-nav-link">Use cases</Link>
            <Link to="/contact"       className="l-nav-link" style={{ color: '#f1f5f9' }}>Contact</Link>
          </div>
          <div className="l-nav-actions">
            <Link to="/login"    className="l-nav-link">Sign in</Link>
            <Link to="/register" className="l-btn-nav">Get started <ChevronRight size={13}/></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="contact-hero">
        <div className="l-hero-orb l-hero-orb-1" style={{ opacity: 0.6 }}/>
        <div className="l-hero-grid"/>
        <div className="contact-hero-inner">
          <Reveal>
            <div className="l-hero-badge">
              <MessageSquare size={13} color="#6366f1"/>
              <span>Get in touch</span>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="contact-hero-title">
              We'd love to <span className="l-gradient-text">hear from you</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="contact-hero-sub">
              Questions about the platform, partnership ideas, or just want to say hi?<br/>
              Pick the channel that suits you best.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Channels */}
      <section className="l-section" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="l-section-inner">
          <div className="contact-channels">
            {CONTACT_CHANNELS.map((ch, i) => (
              <Reveal key={ch.label} delay={i * 0.1}>
                <a href={ch.href} target={ch.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer" className="contact-channel-card">
                  <div className="contact-channel-icon" style={{ background: `${ch.color}18`, border: `1px solid ${ch.color}30` }}>
                    <ch.icon size={22} color={ch.color}/>
                  </div>
                  <div>
                    <div className="contact-channel-label">{ch.label}</div>
                    <div className="contact-channel-value" style={{ color: ch.color }}>{ch.value}</div>
                    <div className="contact-channel-desc">{ch.desc}</div>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Form + info */}
      <section className="l-section l-alt" style={{ paddingTop: '4rem' }}>
        <div className="l-section-inner">
          <div className="contact-grid">
            {/* Left — form */}
            <Reveal>
              <div className="contact-form-card">
                {sent ? (
                  <motion.div className="contact-sent"
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                    <CheckCircle size={44} color="#10b981"/>
                    <h3>Message sent!</h3>
                    <p>Your mail client should have opened. We'll get back to you within 24 hours.</p>
                    <button className="l-btn-nav" style={{ marginTop: '1.5rem' }}
                      onClick={() => { setSent(false); setForm({ name: '', email: '', topic: '', message: '' }); }}>
                      Send another <ChevronRight size={13}/>
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="contact-form">
                    <h2 className="contact-form-title">Send us a message</h2>
                    <p className="contact-form-sub">Fill in the form and we'll open your mail client ready to send.</p>

                    <div className="contact-row">
                      <div className="contact-field">
                        <label className="contact-label">Name <span style={{ color: '#6366f1' }}>*</span></label>
                        <input className="contact-input" placeholder="Your name"
                          value={form.name} onChange={set('name')} required/>
                      </div>
                      <div className="contact-field">
                        <label className="contact-label">Email <span style={{ color: '#6366f1' }}>*</span></label>
                        <input className="contact-input" type="email" placeholder="you@example.com"
                          value={form.email} onChange={set('email')} required/>
                      </div>
                    </div>

                    <div className="contact-field">
                      <label className="contact-label">Topic</label>
                      <select className="contact-input contact-select"
                        value={form.topic} onChange={set('topic')}>
                        <option value="">Select a topic…</option>
                        {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="contact-field">
                      <label className="contact-label">Message <span style={{ color: '#6366f1' }}>*</span></label>
                      <textarea className="contact-input contact-textarea"
                        placeholder="Tell us what's on your mind…"
                        rows={5} value={form.message} onChange={set('message')} required/>
                    </div>

                    {error && <p className="contact-error">{error}</p>}

                    <button type="submit" className="l-btn-primary contact-submit" disabled={sending}>
                      {sending ? 'Opening mail…' : <><Send size={15}/> Send message</>}
                    </button>
                  </form>
                )}
              </div>
            </Reveal>

            {/* Right — info */}
            <Reveal delay={0.12}>
              <div className="contact-info">
                <div className="contact-info-block">
                  <div className="contact-info-icon"><Clock size={18} color="#6366f1"/></div>
                  <div>
                    <div className="contact-info-title">Response time</div>
                    <div className="contact-info-body">We aim to reply within <strong>24 hours</strong> on business days (Mon–Fri).</div>
                  </div>
                </div>
                <div className="contact-info-block">
                  <div className="contact-info-icon"><MapPin size={18} color="#10b981"/></div>
                  <div>
                    <div className="contact-info-title">Location</div>
                    <div className="contact-info-body">Based in Pakistan — serving businesses worldwide.</div>
                  </div>
                </div>
                <div className="contact-info-block">
                  <div className="contact-info-icon"><MessageSquare size={18} color="#f59e0b"/></div>
                  <div>
                    <div className="contact-info-title">Prefer GitHub?</div>
                    <div className="contact-info-body">
                      Open an issue or start a discussion directly on{' '}
                      <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer"
                        style={{ color: '#6366f1', textDecoration: 'none' }}>GitHub</a>.
                      Great for bug reports and feature requests.
                    </div>
                  </div>
                </div>

                <div className="contact-faq">
                  <div className="contact-faq-title">Common questions</div>
                  {[
                    { q: 'Is Agentix free?', a: 'Yes — fully open-source under the MIT licence. Self-host for free.' },
                    { q: 'Do you offer managed hosting?', a: 'Managed cloud hosting is on the roadmap. Email us to join the waitlist.' },
                    { q: 'Can I use it for my agency?', a: 'Absolutely. White-label and multi-tenant setups are supported.' },
                  ].map(({ q, a }) => (
                    <div key={q} className="contact-faq-item">
                      <div className="contact-faq-q">{q}</div>
                      <div className="contact-faq-a">{a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-brand">
            <Link to="/" className="l-logo">
              <img src="/logo.svg" className="logo-icon small" alt="Agentix" />
              <span>Agentix</span>
            </Link>
            <p className="l-footer-tagline">Open-source AI booking &amp; customer service platform.<br/>MIT License · Built for real businesses.</p>
          </div>
          <div className="l-footer-col">
            <div className="l-footer-col-title">Product</div>
            <a href="/#features"     className="l-footer-link">Features</a>
            <a href="/#how-it-works" className="l-footer-link">How it works</a>
            <a href="/#use-cases"    className="l-footer-link">Use cases</a>
          </div>
          <div className="l-footer-col">
            <div className="l-footer-col-title">Company</div>
            <Link to="/contact" className="l-footer-link">Contact</Link>
            <Link to="/privacy"  className="l-footer-link">Privacy</Link>
            <Link to="/register" className="l-footer-link">Get started</Link>
          </div>
          <div className="l-footer-col">
            <div className="l-footer-col-title">Open source</div>
            <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="l-footer-link"><Github size={13}/> GitHub</a>
            <a href="https://github.com/kamran240/AgentixAI/issues" target="_blank" rel="noreferrer" className="l-footer-link">Issues</a>
            <a href="https://github.com/kamran240/AgentixAI/blob/main/README.md" target="_blank" rel="noreferrer" className="l-footer-link">Docs</a>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span>© 2025 Agentix. MIT License.</span>
          <span>Made with ♥ for small businesses worldwide.</span>
        </div>
      </footer>
    </div>
  );
}
