(function () {
  'use strict';

  const script = document.currentScript;
  const token = script.getAttribute('data-token');
  if (!token) return console.warn('[Agentix] Missing data-token attribute.');

  const baseUrl = script.src.replace('/static/widget.js', '').replace('/widget.js', '');
  const chatUrl = `${baseUrl}/widget-chat?token=${token}`;

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    #agentix-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #6366f1; border: none; cursor: pointer;
      box-shadow: 0 4px 24px rgba(99,102,241,0.5);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #agentix-btn:hover { transform: scale(1.08); box-shadow: 0 6px 32px rgba(99,102,241,0.7); }
    #agentix-btn svg { width: 24px; height: 24px; fill: white; }
    #agentix-iframe {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      width: 380px; height: 600px; border: none;
      border-radius: 16px; box-shadow: 0 8px 48px rgba(0,0,0,0.5);
      transform-origin: bottom right;
      transition: opacity 0.2s, transform 0.2s;
    }
    #agentix-iframe.hidden { opacity: 0; pointer-events: none; transform: scale(0.95); }
    @media (max-width: 480px) {
      #agentix-iframe { width: calc(100vw - 16px); height: 70vh; right: 8px; bottom: 88px; }
    }
  `;
  document.head.appendChild(style);

  // Button
  const btn = document.createElement('button');
  btn.id = 'agentix-btn';
  btn.setAttribute('aria-label', 'Open AI chat');
  btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  document.body.appendChild(btn);

  // iFrame
  const iframe = document.createElement('iframe');
  iframe.id = 'agentix-iframe';
  iframe.src = chatUrl;
  iframe.className = 'hidden';
  iframe.setAttribute('allow', 'clipboard-write');
  document.body.appendChild(iframe);

  let open = false;
  btn.addEventListener('click', () => {
    open = !open;
    iframe.classList.toggle('hidden', !open);
  });
})();
