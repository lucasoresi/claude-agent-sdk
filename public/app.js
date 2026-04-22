const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');

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
  bubble.textContent = text;
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

async function loadHistory() {
  const res = await fetch('/api/history');
  const history = await res.json();
  for (const msg of history) {
    if (msg.role === 'user') addUserBubble(msg.content);
    else addAssistantBubble(msg.content);
  }
}

async function send() {
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  setEnabled(false);
  addUserBubble(text);
  showTyping();

  let bubble = null;
  let buf = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
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
          hideTyping();
          if (!bubble) bubble = addAssistantBubble('');
          bubble.textContent += chunk;
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

newChatBtn.addEventListener('click', async () => {
  await fetch('/api/history', { method: 'DELETE' });
  messagesEl.innerHTML = '';
  inputEl.focus();
});

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

loadHistory();
inputEl.focus();
