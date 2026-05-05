/* =============================================
   Daniel Eck – Versicherungsmakler – Chatbot
   ============================================= */

(function() {

const SYSTEM_PROMPT = `Du bist der ECK-Assistent von Daniel Eck – Versicherungsmakler, dem Versicherungsmakler Daniel Eck aus Schmalkalden.
Du hilfst Besuchern der Webseite bei Fragen rund um Versicherungen – freundlich, persönlich und kompetent.

Wichtige Infos über Daniel Eck – Versicherungsmakler:
- Inhaber: Daniel Eck, unabhängiger Versicherungsmakler in 3. Generation
- Adresse: Talstraße 73, 98574 Schmalkalden
- Telefon: 0174 / 322 58 85
- E-Mail: daniel@eckversicherung.de
- Gegründet: 2002, seit über 20 Jahren aktiv
- Unabhängig: Zugang zu über 100 Versicherungsgesellschaften
- Angebot: Private & gewerbliche Versicherungen, Schadensfallmanagement, Bestandsoptimierung
- Beratung ist kostenlos für den Kunden

Beantworte Fragen zu:
- Versicherungsarten (KFZ, Haftpflicht, Hausrat, Berufsunfähigkeit, Kranken, Gewerbe etc.)
- Unterschied Makler vs. Vertreter
- Kosten der Beratung
- Schadensfälle
- Terminbuchung

Antworte immer auf Deutsch, maximal 3-4 Sätze pro Antwort. Sei freundlich und persönlich.
Wenn du eine Frage nicht beantworten kannst, empfehle den direkten Kontakt zu Daniel Eck.
Füge am Ende komplexer Fragen oft einen Hinweis auf ein kostenloses Beratungsgespräch ein.`;

const SUGGESTIONS = [
  "Was kostet die Beratung?",
  "Welche Versicherungen brauche ich?",
  "Was macht ein Versicherungsmakler?",
  "Wie melde ich einen Schaden?",
  "Termin buchen"
];

// ---- Build UI ----
const style = document.createElement('style');
style.textContent = `
  #eck-chat-btn {
    position: fixed;
    bottom: 100px;
    right: 28px;
    width: 54px;
    height: 54px;
    background: #172d50;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,.25);
    z-index: 9998;
    transition: transform .2s, box-shadow .2s;
    border: none;
  }
  #eck-chat-btn:hover {
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,.3);
  }
  #eck-chat-btn svg { transition: opacity .2s; }
  #eck-chat-bubble {
    position: fixed;
    bottom: 168px;
    right: 28px;
    background: #172d50;
    color: #fff;
    font-family: Inter, sans-serif;
    font-size: 13px;
    padding: 10px 14px;
    border-radius: 12px 12px 0 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
    z-index: 9997;
    white-space: nowrap;
    animation: bubblePop .4s ease both;
    cursor: pointer;
  }
  @keyframes bubblePop {
    from { opacity:0; transform: scale(.8) translateY(8px); }
    to   { opacity:1; transform: scale(1) translateY(0); }
  }
  #eck-chat-window {
    position: fixed;
    bottom: 100px;
    right: 28px;
    width: 360px;
    max-height: 560px;
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 16px 64px rgba(0,0,0,.2);
    z-index: 9998;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: Inter, sans-serif;
    transform-origin: bottom right;
    animation: chatOpen .3s cubic-bezier(.4,0,.2,1) both;
  }
  @keyframes chatOpen {
    from { opacity:0; transform: scale(.85); }
    to   { opacity:1; transform: scale(1); }
  }
  #eck-chat-window.closing {
    animation: chatClose .25s cubic-bezier(.4,0,.2,1) both;
  }
  @keyframes chatClose {
    from { opacity:1; transform: scale(1); }
    to   { opacity:0; transform: scale(.85); }
  }
  .eck-chat-header {
    background: #172d50;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .eck-chat-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: rgb(33,103,204);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; color: #fff; font-weight: 800;
    flex-shrink: 0;
  }
  .eck-chat-header-info { flex: 1; }
  .eck-chat-header-name { font-size: 14px; font-weight: 700; color: #fff; }
  .eck-chat-header-status { font-size: 11px; color: rgba(255,255,255,.6); display: flex; align-items: center; gap: 5px; }
  .eck-chat-header-status::before { content:''; width:7px; height:7px; background:#4ade80; border-radius:50%; display:inline-block; }
  .eck-chat-close { background:none; border:none; cursor:pointer; color:rgba(255,255,255,.6); font-size:18px; padding:4px; line-height:1; transition: color .2s; }
  .eck-chat-close:hover { color:#fff; }
  .eck-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 340px;
  }
  .eck-chat-messages::-webkit-scrollbar { width: 4px; }
  .eck-chat-messages::-webkit-scrollbar-track { background: transparent; }
  .eck-chat-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
  .eck-msg {
    max-width: 82%;
    padding: 10px 13px;
    border-radius: 14px;
    font-size: 13.5px;
    line-height: 1.55;
    animation: msgIn .25s ease both;
  }
  @keyframes msgIn {
    from { opacity:0; transform: translateY(6px); }
    to   { opacity:1; transform: translateY(0); }
  }
  .eck-msg.bot {
    background: #f1f5f9;
    color: #172d50;
    border-bottom-left-radius: 4px;
    align-self: flex-start;
  }
  .eck-msg.bot a { color: rgb(33,103,204); }
  .eck-msg.user {
    background: rgb(33,103,204);
    color: #fff;
    border-bottom-right-radius: 4px;
    align-self: flex-end;
  }
  .eck-msg-typing {
    display: flex; gap: 4px; align-items: center;
    padding: 12px 14px;
    background: #f1f5f9;
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    align-self: flex-start;
    width: 56px;
  }
  .eck-msg-typing span {
    width: 7px; height: 7px;
    background: #94a3b8;
    border-radius: 50%;
    animation: typing 1.2s infinite;
  }
  .eck-msg-typing span:nth-child(2) { animation-delay: .2s; }
  .eck-msg-typing span:nth-child(3) { animation-delay: .4s; }
  @keyframes typing {
    0%,60%,100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
  }
  .eck-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 16px;
    border-top: 1px solid #f1f5f9;
  }
  .eck-suggestion {
    background: #f1f5f9;
    border: none;
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 12px;
    font-family: Inter, sans-serif;
    color: #172d50;
    cursor: pointer;
    transition: background .2s, color .2s;
    white-space: nowrap;
  }
  .eck-suggestion:hover { background: rgb(33,103,204); color: #fff; }
  .eck-chat-input-row {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #e2e8f0;
    align-items: center;
  }
  .eck-chat-input {
    flex: 1;
    border: 1.5px solid #e2e8f0;
    border-radius: 22px;
    padding: 9px 14px;
    font-family: Inter, sans-serif;
    font-size: 13.5px;
    outline: none;
    transition: border-color .2s;
    color: #172d50;
  }
  .eck-chat-input:focus { border-color: rgb(33,103,204); }
  .eck-chat-send {
    width: 36px; height: 36px;
    background: rgb(33,103,204);
    border: none;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background .2s, transform .15s;
  }
  .eck-chat-send:hover { background: #1a50c8; transform: scale(1.05); }
  .eck-chat-send:disabled { background: #e2e8f0; cursor: not-allowed; transform: none; }
  @media (max-width: 480px) {
    #eck-chat-window { width: calc(100vw - 32px); right: 16px; bottom: 90px; }
    #eck-chat-btn { right: 16px; bottom: 90px; }
    #eck-chat-bubble { right: 16px; }
  }
`;
document.head.appendChild(style);

// Bubble
const bubble = document.createElement('div');
bubble.id = 'eck-chat-bubble';
bubble.textContent = '💬 Wie kann ich helfen?';
document.body.appendChild(bubble);

// Button
const btn = document.createElement('button');
btn.id = 'eck-chat-btn';
btn.setAttribute('aria-label', 'Chat öffnen');
btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`;
document.body.appendChild(btn);

// Window
let win = null;
let messages = [];
let open = false;

function createWindow() {
  win = document.createElement('div');
  win.id = 'eck-chat-window';
  win.innerHTML = `
    <div class="eck-chat-header">
      <div class="eck-chat-avatar">E</div>
      <div class="eck-chat-header-info">
        <div class="eck-chat-header-name">ECK-Assistent</div>
        <div class="eck-chat-header-status">Online</div>
      </div>
      <button class="eck-chat-close" id="eck-close">✕</button>
    </div>
    <div class="eck-chat-messages" id="eck-msgs"></div>
    <div class="eck-suggestions" id="eck-sugg"></div>
    <div class="eck-chat-input-row">
      <input class="eck-chat-input" id="eck-input" type="text" placeholder="Ihre Frage..." maxlength="300" />
      <button class="eck-chat-send" id="eck-send">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(win);

  // Suggestions
  const suggDiv = win.querySelector('#eck-sugg');
  SUGGESTIONS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'eck-suggestion';
    b.textContent = s;
    b.onclick = () => sendMessage(s);
    suggDiv.appendChild(b);
  });

  // Welcome message
  addMessage('bot', 'Hallo! Ich bin der ECK-Assistent von Daniel Eck – Versicherungsmakler. 👋<br>Wie kann ich Ihnen heute helfen?');

  // Events
  win.querySelector('#eck-close').onclick = closeChat;
  win.querySelector('#eck-send').onclick = () => {
    const val = win.querySelector('#eck-input').value.trim();
    if (val) sendMessage(val);
  };
  win.querySelector('#eck-input').onkeydown = e => {
    if (e.key === 'Enter') {
      const val = win.querySelector('#eck-input').value.trim();
      if (val) sendMessage(val);
    }
  };
}

function addMessage(role, text) {
  const msgs = win.querySelector('#eck-msgs');
  const div = document.createElement('div');
  div.className = `eck-msg ${role}`;
  div.innerHTML = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
  const msgs = win.querySelector('#eck-msgs');
  const div = document.createElement('div');
  div.className = 'eck-msg-typing';
  div.id = 'eck-typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendMessage(text) {
  if (!win) return;
  const input = win.querySelector('#eck-input');
  const sendBtn = win.querySelector('#eck-send');
  input.value = '';
  sendBtn.disabled = true;

  addMessage('user', text);
  messages.push({ role: 'user', content: text });

  // Hide suggestions after first message
  win.querySelector('#eck-sugg').style.display = 'none';

  const typing = addTyping();

  try {
    const response = await window.claude.complete({
      messages: [
        { role: 'user', content: SYSTEM_PROMPT + '\n\nKundenfrage: ' + text }
      ]
    });
    typing.remove();
    // Convert kontakt.html links
    let reply = response
      .replace(/kontakt\.html/g, '<a href="kontakt.html">Kontaktseite</a>')
      .replace(/gesellschaften\.html/g, '<a href="gesellschaften.html">Gesellschaften</a>');
    addMessage('bot', reply);
    messages.push({ role: 'assistant', content: response });
  } catch(e) {
    typing.remove();
    addMessage('bot', 'Entschuldigung, ich konnte Ihre Anfrage gerade nicht bearbeiten. Bitte kontaktieren Sie Daniel Eck direkt: <a href="tel:+491743225885">0174 / 322 58 85</a>');
  }
  sendBtn.disabled = false;
  input.focus();
}

function openChat() {
  bubble.style.display = 'none';
  open = true;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  if (!win) createWindow();
  else win.style.display = 'flex';
}

function closeChat() {
  open = false;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`;
  if (win) {
    win.classList.add('closing');
    setTimeout(() => { if(win) win.style.display = 'none'; win && win.classList.remove('closing'); }, 250);
  }
}

btn.onclick = () => open ? closeChat() : openChat();
bubble.onclick = openChat;

// Auto-show bubble after 5 seconds
setTimeout(() => {
  if (!open) bubble.style.display = 'block';
}, 5000);
bubble.style.display = 'none';

})();
