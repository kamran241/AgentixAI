import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';
import HeroCanvas from '../components/HeroCanvas';
import {
  Zap, Upload, Brain, Globe, ArrowRight, Check, Calendar,
  Github, MessageSquare, Database, Cpu, Search,
  BarChart2, MapPin, Phone, Layers, Code2, Server, Lock, Star,
  ChevronRight, Building2, Stethoscope, UtensilsCrossed, Hotel,
  Scissors, ShoppingBag, Scale, Sparkles,
} from 'lucide-react';

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] } },
});
const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/* ── Scroll-reveal wrapper ── */
function Reveal({ children, className, delay = 0, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      variants={fadeUp} initial="hidden" animate={inView ? 'show' : 'hidden'}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/* ── Tilt card ── */
function TiltCard({ children, className }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 });

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top)  / rect.height - 0.5);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div ref={ref} className={className}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', willChange: 'transform' }}
      onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </motion.div>
  );
}

/* ── Animated counter ── */
function Counter({ to, suffix = '' }) {
  const ref   = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, to, {
      duration: 1.8,
      ease: 'easeOut',
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [inView, to]);

  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Data ── */
const FEATURES = [
  { icon: Upload,        title: 'PDF Knowledge Base',     desc: 'Upload any document. The AI reads, understands, and answers questions instantly — no manual tagging.', tag: 'Core',       n: '01' },
  { icon: Brain,         title: 'AI-Designed Schema',     desc: 'The AI proposes exact database tables your business needs. Review and confirm before anything is created.',tag: 'Smart',      n: '02' },
  { icon: Calendar,      title: 'Live Booking Engine',    desc: 'Checks live records for conflicts before confirming any slot. Real availability — not optimistic guesses.',tag: 'Live',       n: '03' },
  { icon: Globe,         title: 'Embeddable Widget',      desc: 'One script tag. Drop on any site. Full brand colour and logo customisation.',                             tag: 'Embed',      n: '04' },
  { icon: Database,      title: 'Bring Your Own DB',      desc: 'Connect your PostgreSQL. Dynamic tables go there. Full data ownership — zero config if skipped.',         tag: 'Enterprise', n: '05' },
  { icon: MessageSquare, title: 'Conversation History',   desc: 'Every session stored. See what was asked, booked, ordered. Phone-number lookup for returning visitors.',  tag: 'Analytics',  n: '06' },
];

const STEPS = [
  { n: '01', title: 'Upload your PDF',           desc: 'Drop any business document. Agentix ingests it and builds a per-business vector knowledge base.' },
  { n: '02', title: 'Review AI-suggested schema',desc: 'The AI reads your PDF and proposes database tables. Edit and confirm before anything is saved.' },
  { n: '03', title: 'Customise your widget',     desc: 'Set bot name, brand colour, logo. Copy the embed snippet. Paste on any website. Live in seconds.' },
  { n: '04', title: 'Manage from dashboard',     desc: 'View conversations, inspect bookings and orders, update prompts, monitor performance.' },
];

const USE_CASES = [
  { icon: Stethoscope,     label: 'Dental & Medical',    desc: 'Appointment booking with doctor availability, procedure FAQs, patient intake via chat.' },
  { icon: Scissors,        label: 'Salons & Spas',       desc: 'Service menu Q&A, stylist availability, slot booking for any treatment.' },
  { icon: UtensilsCrossed, label: 'Restaurants & Cafés', desc: 'Table reservations, full menu Q&A, delivery orders, allergen info.' },
  { icon: Hotel,           label: 'Hotels',              desc: 'Room inquiries, availability, check-in info, facility questions.' },
  { icon: ShoppingBag,     label: 'Retail',              desc: 'Product search, order placement, store hours, return policy.' },
  { icon: Scale,           label: 'Law & Consultancy',   desc: 'Consultation scheduling, FAQ about practice areas, client intake.' },
];

const TECH = [
  { icon: Cpu,      name: 'Groq + Llama 4',     desc: 'Ultra-fast inference' },
  { icon: Layers,   name: 'LangGraph',           desc: 'Agent orchestration' },
  { icon: Search,   name: 'ChromaDB',            desc: 'Vector similarity' },
  { icon: Server,   name: 'FastAPI',             desc: 'Async Python API' },
  { icon: Database, name: 'PostgreSQL / SQLite', desc: 'Flexible storage' },
  { icon: Code2,    name: 'React + Vite',        desc: 'Snappy SPA frontend' },
];

export default function Landing() {
  return (
    <div className="landing">

      {/* ── Nav ── */}
      <motion.nav className="l-nav"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <div className="l-nav-inner">
          <Link to="/" className="l-logo">
            <div className="logo-icon small"><Zap size={15} color="white" fill="white"/></div>
            <span>Agentix</span>
          </Link>
          <div className="l-nav-links">
            <a href="#features"    className="l-nav-link">Features</a>
            <a href="#how-it-works" className="l-nav-link">How it works</a>
            <a href="#use-cases"   className="l-nav-link">Use cases</a>
          </div>
          <div className="l-nav-actions">
            <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="l-nav-gh">
              <Github size={14}/> GitHub
            </a>
            <Link to="/login" className="l-nav-link">Sign in</Link>
            <Link to="/register" className="l-btn-nav">
              Get started free <ChevronRight size={13}/>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="l-hero">
        <HeroCanvas/>
        <div className="l-hero-orb l-hero-orb-1" aria-hidden/>
        <div className="l-hero-orb l-hero-orb-2" aria-hidden/>
        <div className="l-hero-grid" aria-hidden/>

        <div className="l-hero-inner">
          {/* Badge */}
          <motion.div className="l-hero-badge"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}>
            <span className="l-badge-dot"/>
            Open Source · Free Forever · Self-hostable
          </motion.div>

          {/* Title — word-by-word stagger */}
          <div className="l-hero-title" aria-label="The AI Platform That Runs Your Business">
            {['The AI Platform That'].map((line, li) => (
              <motion.div key={li}
                initial="hidden" animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } } }}>
                {line.split(' ').map((word, wi) => (
                  <motion.span key={wi} className="l-title-word"
                    variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22,1,0.36,1] } } }}>
                    {word}{' '}
                  </motion.span>
                ))}
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <span className="l-gradient-text">Runs Your Business</span>
            </motion.div>
          </div>

          {/* Sub */}
          <motion.p className="l-hero-sub"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}>
            Upload any business document and get a fully functional AI assistant in minutes —
            books appointments, answers questions, manages orders, remembers your customers.
            No code. Works on any website.
          </motion.p>

          {/* CTA buttons */}
          <motion.div className="l-hero-cta"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}>
            <Link to="/register" className="l-btn-primary">
              Start for free <ArrowRight size={16}/>
            </Link>
            <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="l-btn-secondary">
              <Github size={16}/> View source
            </a>
          </motion.div>

          {/* Stats bar */}
          <motion.div className="l-hero-stats"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6 }}>
            {[
              { num: 2,  suffix: ' min', label: 'Setup time', pre: '< ' },
              { num: 0,  suffix: '',     label: 'Lines of code', pre: 'Zero ' },
              { num: 100,suffix: '%',    label: 'Open source' },
              { num: 24, suffix: '/7',   label: 'Always on' },
            ].map(({ num, suffix, label, pre }, i) => (
              <div key={label} className="l-hero-stats-item-wrap">
                {i > 0 && <div className="l-hero-stats-divider"/>}
                <div className="l-hero-stat">
                  <span className="l-stat-num">
                    {pre}{num > 0 ? <Counter to={num} suffix={suffix}/> : 'Zero'}
                  </span>
                  <span className="l-stat-label">{label}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Widget mockup */}
          <motion.div className="l-widget-preview"
            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="l-wp-badge">
              <span className="l-badge-dot" style={{ background: '#22c55e'}}/>
              Live preview — how your customers see it
            </div>
            <div className="l-wp-card">
              <div className="l-wp-header">
                <div className="l-wp-avatar"><Sparkles size={14} color="white"/></div>
                <div>
                  <div className="l-wp-name">Bella's Dental Clinic</div>
                  <div className="l-wp-status"><span className="l-wp-dot"/>Online · AI Assistant</div>
                </div>
              </div>
              <div className="l-wp-messages">
                {[
                  { role: 'ai',    text: "Hi! I can help you book an appointment or answer any question. How can I help? 😊" },
                  { role: 'human', text: "I need a checkup for next Tuesday at 10am" },
                  { role: 'ai',    text: "✓ That slot is free! I need your name, phone, and email to confirm." },
                  { role: 'human', text: "John Smith, 07700 900123, john@email.com" },
                  { role: 'ai',    text: "✅ Booked! Dental Checkup — Tuesday 10:00 AM. See you then, John!" },
                ].map(({ role, text }, i) => (
                  <motion.div key={i} className={`l-wp-msg ${role}`}
                    initial={{ opacity: 0, x: role === 'ai' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.0 + i * 0.15, duration: 0.4 }}>
                    {text}
                  </motion.div>
                ))}
              </div>
              <div className="l-wp-input">
                <span className="l-wp-placeholder">Type a message…</span>
                <button className="l-wp-send"><ArrowRight size={13}/></button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Proof strip ── */}
      <Reveal>
        <div className="l-proof-strip">
          <div className="l-proof-inner">
            <span className="l-proof-label">Works for any business type</span>
            {[Stethoscope, Scissors, UtensilsCrossed, Hotel, ShoppingBag, Scale, Building2].map((Icon, i) => (
              <motion.div key={i} className="l-proof-icon"
                initial={{ opacity: 0 }} whileInView={{ opacity: 0.5 }} viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ opacity: 1, scale: 1.15 }}>
                <Icon size={18} color="rgba(148,163,184,1)"/>
              </motion.div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Features ── */}
      <section className="l-section" id="features">
        <div className="l-section-inner">
          <Reveal><div className="l-section-label">Features</div></Reveal>
          <Reveal delay={0.05}>
            <h2 className="l-section-title">Everything included.<br/>Nothing hidden.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="l-section-sub">One platform that handles every interaction — from first question to confirmed booking.</p>
          </Reveal>
          <motion.div className="l-features-grid"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={containerVariants}>
            {FEATURES.map(({ icon: Icon, title, desc, tag, n }) => (
              <TiltCard key={title} className="l-feature-card">
                <motion.div variants={cardVariants} style={{ height: '100%' }}>
                  <div className="l-feature-top">
                    <div className="l-feature-icon"><Icon size={20} color="var(--accent)"/></div>
                    <span className="l-feature-tag">{tag}</span>
                  </div>
                  <div className="l-feature-n">{n}</div>
                  <h3 className="l-feature-title">{title}</h3>
                  <p className="l-feature-desc">{desc}</p>
                </motion.div>
              </TiltCard>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="l-section l-alt" id="how-it-works">
        <div className="l-section-inner">
          <Reveal><div className="l-section-label">How it works</div></Reveal>
          <Reveal delay={0.05}><h2 className="l-section-title">Live in four steps.<br/>No devs needed.</h2></Reveal>
          <motion.div className="l-steps-grid"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={containerVariants}>
            {STEPS.map(({ n, title, desc }, i) => (
              <motion.div key={n} className="l-step-card" variants={cardVariants}>
                <div className="l-step-num">{n}</div>
                <h3 className="l-step-title">{title}</h3>
                <p className="l-step-desc">{desc}</p>
                {i < STEPS.length - 1 && <div className="l-step-arrow"><ChevronRight size={16}/></div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Use cases ── */}
      <section className="l-section" id="use-cases">
        <div className="l-section-inner">
          <Reveal><div className="l-section-label">Use cases</div></Reveal>
          <Reveal delay={0.05}><h2 className="l-section-title">Built for the businesses<br/>that keep cities running.</h2></Reveal>
          <motion.div className="l-usecases-grid"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={containerVariants}>
            {USE_CASES.map(({ icon: Icon, label, desc }) => (
              <motion.div key={label} className="l-usecase-card" variants={cardVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}>
                <div className="l-usecase-icon"><Icon size={22} color="var(--accent)"/></div>
                <div className="l-usecase-label">{label}</div>
                <div className="l-usecase-desc">{desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section className="l-section l-alt">
        <div className="l-section-inner">
          <Reveal><div className="l-section-label">Under the hood</div></Reveal>
          <Reveal delay={0.05}><h2 className="l-section-title">Built on battle-tested<br/>open-source tech.</h2></Reveal>
          <motion.div className="l-tech-grid"
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={containerVariants}>
            {TECH.map(({ icon: Icon, name, desc }) => (
              <motion.div key={name} className="l-tech-card" variants={cardVariants}
                whileHover={{ y: -4, scale: 1.03, transition: { duration: 0.18 } }}>
                <div className="l-tech-icon"><Icon size={20} color="var(--accent)"/></div>
                <div className="l-tech-name">{name}</div>
                <div className="l-tech-desc">{desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="l-cta-section">
        <div className="l-cta-orb l-cta-orb-1" aria-hidden/>
        <div className="l-cta-orb l-cta-orb-2" aria-hidden/>
        <div className="l-cta-inner">
          <Reveal><div className="l-cta-badge"><Star size={12} fill="currentColor"/> Open Source · MIT License</div></Reveal>
          <Reveal delay={0.08}>
            <h2 className="l-cta-title">
              Self-host it. Own your data.<br/>
              <span className="l-gradient-text">Free forever.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="l-cta-sub">No vendor lock-in. Deploy with Docker in minutes. Your data never leaves your infrastructure.</p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="l-cta-pills">
              {['MIT Licensed','Docker ready','PostgreSQL + SQLite','Groq LLM API','ChromaDB vectors','Your own DB'].map(item => (
                <div key={item} className="l-cta-pill"><Check size={12} strokeWidth={3}/> {item}</div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="l-hero-cta" style={{ marginTop: '2.5rem' }}>
              <Link to="/register" className="l-btn-primary">Get started for free <ArrowRight size={16}/></Link>
              <a href="https://github.com/kamran240/AgentixAI" target="_blank" rel="noreferrer" className="l-btn-secondary">
                <Github size={16}/> Star on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-brand">
            <Link to="/" className="l-logo">
              <div className="logo-icon small"><Zap size={14} color="white" fill="white"/></div>
              <span>Agentix</span>
            </Link>
            <p className="l-footer-tagline">Open-source AI booking &amp; customer service platform.<br/>MIT License · Built for real businesses.</p>
          </div>
          <div className="l-footer-col">
            <div className="l-footer-col-title">Product</div>
            <a href="#features"     className="l-footer-link">Features</a>
            <a href="#how-it-works" className="l-footer-link">How it works</a>
            <a href="#use-cases"    className="l-footer-link">Use cases</a>
          </div>
          <div className="l-footer-col">
            <div className="l-footer-col-title">Account</div>
            <Link to="/login"    className="l-footer-link">Sign in</Link>
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
