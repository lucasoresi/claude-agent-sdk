const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const switchUserBtn = document.getElementById('switchUserBtn');
const welcomeEl = document.getElementById('welcome');
const chatAppEl = document.getElementById('chatApp');

let currentTenant = null;

function selectTenant(tenant) {
  currentTenant = tenant;
  document.getElementById('tenantLabel').textContent = tenant;
  welcomeEl.style.display = 'none';
  chatAppEl.style.display = 'flex';
  inputEl.focus();
}

async function switchUser() {
  await fetch(`/api/history?tenant=${currentTenant}`, { method: 'DELETE' });
  messagesEl.innerHTML = '';
  currentTenant = null;
  chatAppEl.style.display = 'none';
  welcomeEl.style.display = 'flex';
}

function addUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-user';
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollBottom();
}

function addAssistantBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-assistant';
  bubble.innerHTML = marked.parse(text);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollBottom();
  return bubble;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-typing';
  row.id = 'typing';
  row.innerHTML = `<div class="typing-bubble">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  messagesEl.appendChild(row);
  scrollBottom();
}

function hideTyping() {
  document.getElementById('typing')?.remove();
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setEnabled(on) {
  inputEl.disabled = !on;
  sendBtn.disabled = !on;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || !currentTenant) return;

  inputEl.value = '';
  setEnabled(false);
  addUserBubble(text);
  showTyping();

  let bubble = null;
  let rawText = '';
  let buf = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, tenant: currentTenant }),
    });

    const reader = res.body.getReader();
    const dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;
        try {
          const chunk = JSON.parse(payload);
          rawText += chunk;
          hideTyping();
          if (!bubble) bubble = addAssistantBubble('');
          bubble.innerHTML = marked.parse(rawText);
          scrollBottom();
        } catch {}
      }
    }
  } catch {
    hideTyping();
    addAssistantBubble('Error al conectar con el agente.');
  }

  setEnabled(true);
  inputEl.focus();
}

document.querySelectorAll('.user-card').forEach(btn => {
  btn.addEventListener('click', () => selectTenant(btn.dataset.tenant));
});

switchUserBtn.addEventListener('click', switchUser);

newChatBtn.addEventListener('click', async () => {
  await fetch(`/api/history?tenant=${currentTenant}`, { method: 'DELETE' });
  messagesEl.innerHTML = '';
  inputEl.focus();
});

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
