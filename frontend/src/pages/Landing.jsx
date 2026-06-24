import { Link } from 'react-router-dom';
import {
  Zap, Upload, Brain, Globe, ArrowRight, Check, Calendar, Package,
  Truck, Github, MessageSquare, Database, Shield, Cpu, Search,
  BarChart2, MapPin, Phone, Layers, Code2, Server, Lock, Star,
  ChevronRight, Building2, Stethoscope, UtensilsCrossed, Hotel,
  Scissors, ShoppingBag, Scale, Sparkles,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Use cases', href: '#use-cases' },
];

const FEATURES = [
  {
    icon: Upload,
    title: 'PDF Knowledge Base',
    desc: 'Upload any business document — menu, price list, service guide, brochure. The AI reads, understands, and answers questions from it instantly. No manual tagging.',
    tag: 'Core',
  },
  {
    icon: Brain,
    title: 'AI-Designed Database Schema',
    desc: 'The AI analyses your document and proposes the exact database tables your business needs — appointment slots, order rows, customer records. You review and confirm before anything is created.',
    tag: 'Smart',
  },
  {
    icon: Calendar,
    title: 'Real Booking & Availability',
    desc: 'The agent checks live database records for conflicts before confirming any slot. Every appointment is a separate row. Customers get accurate availability — not optimistic guesses.',
    tag: 'Live',
  },
  {
    icon: Globe,
    title: 'Embeddable Widget',
    desc: 'One script tag. Drop it on any site — WordPress, Shopify, custom HTML. Full colour customisation: brand colour, background, bot name, logo. Fits your site, not the other way around.',
    tag: 'Embed',
  },
  {
    icon: Database,
    title: 'Bring Your Own Database',
    desc: 'Connect your own PostgreSQL for any business. Dynamic tables (bookings, orders) are created there. Platform data stays on platform. Full data ownership — optional, zero config if skipped.',
    tag: 'Enterprise',
  },
  {
    icon: MessageSquare,
    title: 'Full Conversation History',
    desc: 'Every customer session is stored and viewable. See what was asked, what was booked, and what was ordered. Customer history lookup by phone number gives agents context on returning visitors.',
    tag: 'Analytics',
  },
];

const CAPABILITIES = [
  { icon: Search,      text: 'Semantic search over your PDF knowledge base (ChromaDB)' },
  { icon: Calendar,    text: 'Conflict-aware appointment booking with availability checking' },
  { icon: Package,     text: 'Order taking with upsell suggestions based on past orders' },
  { icon: MapPin,      text: 'Worldwide address validation via OpenStreetMap (Nominatim)' },
  { icon: Phone,       text: 'Returning customer lookup by phone number across all sessions' },
  { icon: BarChart2,   text: 'Popular item analytics to drive upsell recommendations' },
  { icon: Lock,        text: 'Custom AI system prompt per business — optional override' },
  { icon: Layers,      text: 'Multi-tenant: one platform, unlimited separate businesses' },
];

const STEPS = [
  {
    n: '01',
    title: 'Upload your business document',
    desc: 'Drop any PDF — menu, service catalogue, staff guide, FAQ sheet. Agentix ingests the text and stores it in a per-business vector database for semantic retrieval.',
  },
  {
    n: '02',
    title: 'Review the AI-suggested schema',
    desc: 'The AI reads your document and proposes database tables tailored to your business type. Edit table names, column names, and types before anything is saved — you stay in control.',
  },
  {
    n: '03',
    title: 'Customise your widget',
    desc: 'Set the bot name, accent colour, background colour, and upload a logo. Copy the embed snippet. Paste it into any website. Your branded AI assistant is live in seconds.',
  },
  {
    n: '04',
    title: 'Manage from the dashboard',
    desc: 'View conversation history, inspect every booking and order in your data tables, update the system prompt, and monitor how your AI assistant is performing — all in one place.',
  },
];

const USE_CASES = [
  {
    icon: Stethoscope,
    label: 'Dental & Medical Clinics',
    desc: 'Appointment booking with doctor availability, FAQ about procedures and pricing, patient intake via chat.',
  },
  {
    icon: Scissors,
    label: 'Salons & Spas',
    desc: 'Service menu Q&A, stylist availability, booking slots for haircuts, massage, or any treatment.',
  },
  {
    icon: UtensilsCrossed,
    label: 'Restaurants & Cafés',
    desc: 'Table reservations, full menu Q&A, delivery order taking, allergen info, popular dish recommendations.',
  },
  {
    icon: Hotel,
    label: 'Hotels & Guesthouses',
    desc: 'Room type inquiries, availability checking, check-in/out info, facility questions, booking confirmations.',
  },
  {
    icon: ShoppingBag,
    label: 'Retail & E-commerce',
    desc: 'Product catalogue search, stock Q&A, order placement, store hours, return policy, delivery tracking.',
  },
  {
    icon: Scale,
    label: 'Law Firms & Consultancies',
    desc: 'Service catalogue explanation, consultation scheduling, FAQ about practice areas, client intake forms.',
  },
];

const TECH = [
  { icon: Cpu,    name: 'Groq + Llama 4',      desc: 'Ultra-fast LLM inference' },
  { icon: Layers, name: 'LangGraph',            desc: 'Agent orchestration loop' },
  { icon: Search, name: 'ChromaDB',             desc: 'Vector similarity search' },
  { icon: Server, name: 'FastAPI',              desc: 'Async Python backend' },
  { icon: Database, name: 'PostgreSQL / SQLite', desc: 'Flexible storage layer' },
  { icon: Code2,  name: 'React + Vite',         desc: 'Snappy SPA frontend' },
];

export default function Landing() {
  return (
    <div className="landing">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          {/* Logo */}
          <Link to="/" className="landing-logo">
            <div className="logo-icon small">
              <Zap size={15} color="white" fill="white" />
            </div>
            <span>Agentix</span>
          </Link>

          {/* Center pill nav */}
          <div className="landing-nav-center">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="nav-link">{label}</a>
            ))}
          </div>

          {/* Right actions */}
          <div className="landing-nav-links">
            <a
              href="https://github.com/kamran240/AgentixAI"
              target="_blank"
              rel="noreferrer"
              className="nav-link-gh"
            >
              <Github size={14} /> GitHub
            </a>
            <div className="nav-divider-v" />
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/register" className="btn-primary-sm">
              Get started free <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero hero-v2">
        <div className="hero-grid-bg" aria-hidden />

        <div className="hero-badge">
          <span className="badge-dot" />
          Open Source • Free Forever • Self-hostable
        </div>

        <h1 className="hero-title">
          The AI Platform That<br />
          <span className="gradient-text">Runs Your Business</span>
        </h1>

        <p className="hero-sub">
          Upload any business document and get a fully functional AI assistant in minutes —
          one that takes bookings, answers product questions, manages orders,
          validates addresses, and remembers your customers. No code. No manual database setup.
          Works on any website.
        </p>

        <div className="hero-cta">
          <Link to="/register" className="btn-hero-primary">
            Start for free <ArrowRight size={16} />
          </Link>
          <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="btn-hero-secondary">
            <Github size={16} /> View source
          </a>
        </div>

        <div className="hero-stats">
          {[
            { num: '< 2 min', label: 'Setup time' },
            { num: 'Zero',    label: 'Lines of code' },
            { num: 'Any',     label: 'Business type' },
            { num: '24 / 7',  label: 'AI availability' },
          ].map(({ num, label }, i) => (
            <>
              {i > 0 && <div key={`div-${i}`} className="hero-stat-divider" />}
              <div key={label} className="hero-stat">
                <span className="hero-stat-num">{num}</span>
                <span className="hero-stat-label">{label}</span>
              </div>
            </>
          ))}
        </div>

        {/* Widget preview mockup */}
        <div className="widget-preview-wrap">
          <div className="widget-preview-badge">
            <span className="badge-dot" style={{ background: '#10b981' }} />
            Live preview — how your customers see it
          </div>
          <div className="widget-preview">
            <div className="wp-header">
              <div className="wp-avatar"><Sparkles size={14} color="white" /></div>
              <div>
                <div className="wp-name">Bella's Dental Clinic</div>
                <div className="wp-status"><span className="wp-dot" />Online • AI Assistant</div>
              </div>
            </div>
            <div className="wp-messages">
              <div className="wp-msg ai">Hi! I'm the AI assistant for Bella's Dental Clinic. I can help you book an appointment, answer questions about our services, or check prices. How can I help? 😊</div>
              <div className="wp-msg human">I need a checkup for next Tuesday at 10am</div>
              <div className="wp-msg ai">Let me check availability for Tuesday 10am… ✓ That slot is free! I'll need your name and phone number to confirm the booking.</div>
              <div className="wp-msg human">John Smith, 07700 900123</div>
              <div className="wp-msg ai">✅ Booked! John Smith — Dental Checkup — Tuesday 10:00 AM. You'll receive a confirmation. See you then!</div>
            </div>
            <div className="wp-input-row">
              <span className="wp-input-placeholder">Type a message…</span>
              <button className="wp-send"><ArrowRight size={13} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ── What is Agentix? ─────────────────────────────────────────────── */}
      <section className="section explainer-section" id="features">
        <div className="section-inner">
          <div className="explainer-grid">
            <div className="explainer-text">
              <div className="section-label">What is Agentix?</div>
              <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>
                A complete AI customer-service platform — built for small businesses
              </h2>
              <p className="explainer-body">
                Agentix is an open-source, multi-tenant SaaS platform. You create a business profile,
                upload your PDF, and within two minutes you have a conversational AI agent embedded on
                your website that can answer questions from your document, take bookings, handle orders,
                look up customer history, and validate delivery addresses — all in real time.
              </p>
              <p className="explainer-body" style={{ marginTop: '0.875rem' }}>
                Every business gets its own isolated vector store, its own database tables, and its own
                widget with custom branding. One platform, unlimited businesses, full data separation.
              </p>
              <div className="explainer-checks">
                {[
                  'Multi-tenant — each business is fully isolated',
                  'LLM agent with real tool use (not just Q&A)',
                  'Dynamic tables designed by AI from your document',
                  'Embeddable in 30 seconds — one script tag',
                ].map(item => (
                  <div key={item} className="explainer-check">
                    <div className="check-icon-circle"><Check size={11} strokeWidth={3} /></div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="explainer-caps">
              <div className="caps-title">
                <Cpu size={14} color="var(--accent)" />
                AI Agent Capabilities
              </div>
              {CAPABILITIES.map(({ icon: Icon, text }) => (
                <div key={text} className="cap-item">
                  <div className="cap-icon"><Icon size={13} color="var(--accent)" /></div>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="section alt-bg">
        <div className="section-inner">
          <div className="section-label">Features</div>
          <h2 className="section-title">Everything included. Nothing hidden.</h2>
          <div className="features-grid-v2">
            {FEATURES.map(({ icon: Icon, title, desc, tag }) => (
              <div key={title} className="feature-card-v2">
                <div className="feature-card-top">
                  <div className="feature-icon-v2">
                    <Icon size={20} color="var(--accent)" />
                  </div>
                  <span className="feature-tag">{tag}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Live in four steps — no devs needed</h2>
          <div className="steps-grid-v2">
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n} className="step-card-v2">
                <div className="step-connector-line" style={{ opacity: i === STEPS.length - 1 ? 0 : 1 }} />
                <div className="step-num-badge">{n}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────────────────────── */}
      <section className="section alt-bg" id="use-cases">
        <div className="section-inner">
          <div className="section-label">Use cases</div>
          <h2 className="section-title">Built for the businesses that keep cities running</h2>
          <div className="usecases-grid-v2">
            {USE_CASES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="usecase-card-v2">
                <div className="usecase-icon">
                  <Icon size={20} color="var(--accent)" />
                </div>
                <div>
                  <div className="usecase-label">{label}</div>
                  <div className="usecase-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label">Under the hood</div>
          <h2 className="section-title">Built on battle-tested open-source tech</h2>
          <div className="tech-grid">
            {TECH.map(({ icon: Icon, name, desc }) => (
              <div key={name} className="tech-card">
                <div className="tech-icon"><Icon size={18} color="var(--accent)" /></div>
                <div className="tech-name">{name}</div>
                <div className="tech-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open source CTA ──────────────────────────────────────────────── */}
      <section className="section cta-section-v2">
        <div className="section-inner cta-inner-v2">
          <div className="cta-glow" aria-hidden />
          <div className="cta-badge">
            <Star size={12} fill="currentColor" /> Open Source
          </div>
          <h2 className="cta-title">
            Self-host it. Own your data.<br />
            <span className="gradient-text">Free forever.</span>
          </h2>
          <p className="cta-sub">
            MIT licensed. No vendor lock-in. Deploy on your own server with Docker in minutes.
            PostgreSQL or SQLite — your choice. Your customer data never leaves your infrastructure.
          </p>
          <div className="cta-checks-v2">
            {[
              'MIT Licensed', 'Docker ready', 'PostgreSQL + SQLite',
              'Groq LLM API', 'ChromaDB vectors', 'Bring your own DB',
            ].map(item => (
              <div key={item} className="cta-check-v2">
                <Check size={13} strokeWidth={3} color="var(--success)" /> {item}
              </div>
            ))}
          </div>
          <div className="hero-cta" style={{ marginTop: '2.5rem' }}>
            <Link to="/register" className="btn-hero-primary">
              Get started for free <ArrowRight size={16} />
            </Link>
            <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="btn-hero-secondary">
              <Github size={16} /> Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="landing-footer-v2">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link to="/" className="landing-logo">
              <div className="logo-icon small">
                <Zap size={14} color="white" fill="white" />
              </div>
              <span>Agentix</span>
            </Link>
            <p className="footer-tagline">
              Open-source AI booking &amp; customer service platform.<br />
              MIT License · Built for real small businesses.
            </p>
          </div>
          <div className="footer-links-col">
            <div className="footer-col-title">Product</div>
            <a href="#features" className="footer-link">Features</a>
            <a href="#how-it-works" className="footer-link">How it works</a>
            <a href="#use-cases" className="footer-link">Use cases</a>
          </div>
          <div className="footer-links-col">
            <div className="footer-col-title">Account</div>
            <Link to="/login" className="footer-link">Sign in</Link>
            <Link to="/register" className="footer-link">Get started</Link>
            <Link to="/privacy" className="footer-link">Privacy policy</Link>
          </div>
          <div className="footer-links-col">
            <div className="footer-col-title">Open source</div>
            <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="footer-link">
              <Github size={13} /> GitHub
            </a>
            <a href="https://github.com/kamran240/AgentixAI/issues" target="_blank" rel="noreferrer" className="footer-link">Issues</a>
            <a href="https://github.com/kamran240/AgentixAI/blob/main/README.md" target="_blank" rel="noreferrer" className="footer-link">Docs</a>
          </div>
        </div>
        <div className="footer-bottom-v2">
          <span>© 2025 Agentix. MIT License.</span>
          <span>Made with ♥ for small businesses worldwide.</span>
        </div>
      </footer>
    </div>
  );
}
