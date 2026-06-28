import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = 'June 2025';

const sections = [
  {
    title: '1. Information We Collect',
    body: `We collect information you provide directly: your name, email address, and password when you register. When you upload a business document (PDF), we process its contents to build an AI knowledge base. We also store conversation logs between your customers and the AI widget to help you review and improve responses.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `Your information is used solely to operate the Agentix platform. This includes authenticating your account, powering AI responses for your widget, and displaying conversation history in your dashboard. We do not sell, rent, or share your personal data with third parties for marketing purposes.`,
  },
  {
    title: '3. Data Storage',
    body: `Uploaded documents and conversation data are stored on our servers. Each business's data is isolated — one account cannot access another account's data. Documents are used exclusively for generating AI responses for your specific widget.`,
  },
  {
    title: '4. Cookies & Local Storage',
    body: `We use browser localStorage to store your authentication token so you remain logged in across page refreshes. We do not use tracking cookies or third-party analytics cookies. The embedded widget script stores a session ID in memory only (not persisted to disk).`,
  },
  {
    title: '5. Customer Data (Your Visitors)',
    body: `When your customers chat with your AI widget, their messages are stored as conversation logs tied to an anonymous session ID. No names or personal identifiers are collected from widget visitors unless they voluntarily provide them during a conversation.`,
  },
  {
    title: '6. Data Retention',
    body: `Your account data is retained as long as your account is active. When you delete a business from your dashboard, all associated tables, conversation logs, and uploaded documents are permanently deleted. You may request full account deletion by contacting us.`,
  },
  {
    title: '7. Security',
    body: `Passwords are hashed using bcrypt before storage — we never store plain-text passwords. API access requires a signed JWT token with expiry. All data transfers occur over HTTPS in production environments.`,
  },
  {
    title: '8. Third-Party Services',
    body: `Agentix uses the Groq API to power AI responses. Conversation messages are sent to Groq for processing. Please review Groq's privacy policy for how they handle API data. We do not share your business documents or account details with Groq.`,
  },
  {
    title: '9. Open Source',
    body: `Agentix is open-source software. If you self-host this platform, you are responsible for your own data handling, storage security, and compliance with applicable laws in your jurisdiction.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last Updated" date at the top of this page. Continued use of the platform after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact',
    body: `For privacy-related questions, data deletion requests, or concerns, please open an issue on our GitHub repository or contact the project maintainer directly.`,
  },
];

export default function Privacy() {
  return (
    <div className="privacy-page">
      {/* Nav */}
      <nav className="landing-nav">
        <Link to="/" className="nav-logo">
          <img src="/logo.svg" className="logo-icon" alt="Agentix" />
          <span className="logo-text">AGENTIX</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/login" className="nav-cta-btn">Sign in</Link>
        </div>
      </nav>

      <div className="privacy-content">
        <Link to="/" className="breadcrumb-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '2rem', fontSize: '0.875rem' }}>
          <ArrowLeft size={14}/> Back to home
        </Link>

        <div className="privacy-header">
          <h1>Privacy Policy</h1>
          <p className="privacy-meta">Last updated: {LAST_UPDATED}</p>
          <p className="privacy-intro">
            Agentix ("we", "our", "the platform") is committed to protecting your privacy.
            This policy explains what data we collect, how we use it, and your rights around it.
          </p>
        </div>

        <div className="privacy-sections">
          {sections.map(s => (
            <div key={s.title} className="privacy-section">
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="landing-footer">
        <div className="footer-bottom">
          <span>© 2025 Agentix. Open-source under MIT License.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link to="/privacy" className="footer-link">Privacy Policy</Link>
            <Link to="/" className="footer-link">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
