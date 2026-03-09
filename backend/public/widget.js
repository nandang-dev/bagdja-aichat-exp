(function () {
  if (window.__AI_CHAT_WIDGET_LOADED__) return;
  window.__AI_CHAT_WIDGET_LOADED__ = true;

  const config = Object.assign(
    {
      apiBaseUrl: window.location.origin,
      appId: 'inovatrack',
      title: 'AI Assistant',
      welcome: 'Halo! Ada yang bisa saya bantu?',
      placeholder: 'Tulis pertanyaan...',
      primaryColor: '#111827',
      position: 'bottom-right',
      stream: true,
    },
    window.AiChatWidgetConfig || {}
  );

  const style = document.createElement('style');
  style.textContent = `
    .aiw-bubble {
      position: fixed;
      z-index: 999999;
      width: 58px;
      height: 58px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      color: #fff;
      background: ${config.primaryColor};
      box-shadow: 0 10px 25px rgba(0,0,0,.18);
      font-size: 24px;
    }
    .aiw-panel {
      position: fixed;
      z-index: 999999;
      width: 360px;
      max-width: calc(100vw - 24px);
      height: 560px;
      max-height: calc(100vh - 90px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0,0,0,.18);
      display: none;
      overflow: hidden;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .aiw-header {
      background: ${config.primaryColor};
      color: #fff;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
    }
    .aiw-close {
      background: transparent;
      color: #fff;
      border: none;
      font-size: 20px;
      cursor: pointer;
    }
    .aiw-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: #f8fafc;
    }
    .aiw-messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .aiw-msg {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .aiw-msg-user {
      align-self: flex-end;
      background: ${config.primaryColor};
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .aiw-msg-bot {
      align-self: flex-start;
      background: #fff;
      color: #111827;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }
    .aiw-input-wrap {
      border-top: 1px solid #e5e7eb;
      padding: 12px;
      background: #fff;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    }
    .aiw-input {
      flex: 1;
      resize: none;
      min-height: 42px;
      max-height: 110px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      outline: none;
    }
    .aiw-send {
      border: none;
      background: ${config.primaryColor};
      color: #fff;
      border-radius: 12px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: bold;
    }
    .aiw-muted {
      color: #6b7280;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('button');
  bubble.className = 'aiw-bubble';
  bubble.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.className = 'aiw-panel';
  panel.innerHTML = `
    <div class="aiw-header">
      <span>${escapeHtml(config.title)}</span>
      <button class="aiw-close" type="button">×</button>
    </div>
    <div class="aiw-body">
      <div class="aiw-messages"></div>
      <div class="aiw-input-wrap">
        <textarea class="aiw-input" placeholder="${escapeHtml(config.placeholder)}"></textarea>
        <button class="aiw-send" type="button">Kirim</button>
      </div>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  positionElements();

  const closeBtn = panel.querySelector('.aiw-close');
  const messagesEl = panel.querySelector('.aiw-messages');
  const inputEl = panel.querySelector('.aiw-input');
  const sendBtn = panel.querySelector('.aiw-send');

  addBotMessage(config.welcome);

  bubble.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  window.addEventListener('resize', positionElements);

  async function sendMessage() {
    const question = inputEl.value.trim();
    if (!question) return;

    addUserMessage(question);
    inputEl.value = '';

    if (config.stream) {
      await sendStream(question);
    } else {
      await sendNormal(question);
    }
  }

  async function sendNormal(question) {
    const botMsg = addBotMessage('Sedang memproses...');
    try {
      const res = await fetch(`${config.apiBaseUrl}/rag/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: config.appId, question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Request gagal');

      botMsg.textContent = data.answer || '';
    } catch (e) {
      botMsg.textContent = `Error: ${e.message}`;
    }
    scrollToBottom();
  }

  async function sendStream(question) {
    const botMsg = addBotMessage('');

    try {
      const url = `${config.apiBaseUrl}/rag/chat/stream?appId=${encodeURIComponent(config.appId)}&question=${encodeURIComponent(question)}`;
      const res = await fetch(url);

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Stream gagal');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;

          const payload = JSON.parse(line.slice(6));

          if (payload.type === 'token') {
            botMsg.textContent += payload.data || '';
            scrollToBottom();
          } else if (payload.type === 'done') {
            // done
          }
        }
      }
    } catch (e) {
      botMsg.textContent = `Error: ${e.message}`;
    }
    scrollToBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'aiw-msg aiw-msg-user';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'aiw-msg aiw-msg-bot';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function positionElements() {
    const bottom = 20;
    const right = 20;
    bubble.style.bottom = `${bottom}px`;
    bubble.style.right = `${right}px`;

    panel.style.bottom = `${bottom + 72}px`;
    panel.style.right = `${right}px`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
