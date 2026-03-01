'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `💬 COMMENTO:
Ciao! 👋 Sono SpeakEasy, il tuo insegnante di inglese! Sono qui per chiacchierare con te, correggere i tuoi errori e aiutarti a migliorare — il tutto divertendoci!

❓ ORA PROVA:
What is your name and what do you like to do? (Come ti chiami e cosa ti piace fare?)`,
};

export default function Home() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setSpeechSupported(supported);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, []);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);
    setStreamingText('');

    try {
      const apiMessages = newMessages
        .filter((m) => m !== WELCOME_MESSAGE)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullText += parsed.content;
                setStreamingText(fullText);
              }
            } catch {}
          }
        }
      }

      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '💬 COMMENTO:\nOops, qualcosa è andato storto. Riprova!' },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
      autoResize();

      if (event.results[0].isFinal) {
        setIsListening(false);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const formatMessage = (text) => {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('✏️') || trimmedLine.startsWith('🎯')) {
        currentSection = { type: 'correction', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^[✏️🎯]\s*CORR\w+:?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (trimmedLine.startsWith('📝')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('✅')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('🇮🇹')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('💬')) {
        currentSection = { type: 'response', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^💬\s*(?:COMMENTO|MY RESPONSE):?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (trimmedLine.startsWith('❓')) {
        currentSection = { type: 'question', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^❓\s*(?:ORA PROVA|NEXT QUESTION):?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (currentSection) {
        currentSection.lines.push(trimmedLine);
      } else {
        currentSection = { type: 'response', lines: [trimmedLine] };
        sections.push(currentSection);
      }
    }

    if (sections.length === 0) {
      return <p style={styles.plainText}>{text}</p>;
    }

    return sections.map((section, i) => {
      if (section.type === 'correction') {
        return (
          <div key={i} style={styles.sectionCorrection}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>✏️</span>
              <span style={styles.sectionLabel}>Correzione</span>
            </div>
            {section.lines.map((l, j) => {
              if (l.startsWith('📝'))
                return (
                  <p key={j} style={styles.corrOriginal}>
                    {l.replace(/^📝\s*(?:HAI DETTO|YOU SAID):?\s*/i, '📝 ')}
                  </p>
                );
              if (l.startsWith('✅'))
                return (
                  <p key={j} style={styles.corrFixed}>
                    {l.replace(/^✅\s*CORR\w+:?\s*/i, '✅ ')}
                  </p>
                );
              if (l.startsWith('🇮🇹'))
                return (
                  <p key={j} style={styles.corrItalian}>
                    {l.replace(/^🇮🇹\s*(?:TRADUZIONE|ITALIANO):?\s*/i, '🇮🇹 ')}
                  </p>
                );
              if (l.toLowerCase().includes('perfett') || l.toLowerCase().includes('nessun errore'))
                return (
                  <p key={j} style={styles.corrPerfect}>
                    ✨ {l}
                  </p>
                );
              return (
                <p key={j} style={styles.corrLine}>
                  {l}
                </p>
              );
            })}
          </div>
        );
      }

      if (section.type === 'question') {
        const content = section.lines.join('\n');
        return (
          <div key={i} style={styles.sectionQuestion}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>❓</span>
              <span style={styles.sectionLabel}>Ora prova!</span>
            </div>
            <p style={styles.questionText}>{content}</p>
          </div>
        );
      }

      const content = section.lines.join('\n');
      return (
        <div key={i} style={styles.sectionResponse}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>💬</span>
            <span style={styles.sectionLabel}>Il tuo prof</span>
          </div>
          {content && <p style={styles.responseText}>{content}</p>}
        </div>
      );
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      <style>{globalCSS}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>📚</div>
            <div>
              <h1 style={styles.logoTitle}>SpeakEasy</h1>
              <p style={styles.logoSub}>Il tuo prof di inglese AI</p>
            </div>
          </div>
          <div style={styles.statusPill}>
            <span style={styles.statusDot} />
            Online
          </div>
        </div>
      </header>

      <main style={styles.chatArea}>
        <div style={styles.chatInner}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.msgRow,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={
                  msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                }
              >
                {msg.role === 'user' ? (
                  <p style={styles.userText}>{msg.content}</p>
                ) : (
                  formatMessage(msg.content)
                )}
              </div>
            </div>
          ))}

          {isLoading && streamingText && (
            <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
              <div style={styles.assistantBubble}>
                {formatMessage(streamingText)}
              </div>
            </div>
          )}

          {isLoading && !streamingText && (
            <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
              <div style={styles.assistantBubble}>
                <div style={styles.typingDots}>
                  <span style={{ ...styles.dot, animationDelay: '0s' }} />
                  <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
                  <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      <footer style={styles.inputBar}>
        <div style={styles.inputInner}>
          <div style={styles.inputRow}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi in inglese..."
              rows={1}
              style={styles.textarea}
            />

            {speechSupported && (
              <button
                onClick={toggleListening}
                style={{
                  ...styles.micBtn,
                  ...(isListening ? styles.micBtnActive : {}),
                }}
                aria-label={isListening ? 'Stop' : 'Parla'}
              >
                {isListening ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            )}

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={{
                ...styles.sendBtn,
                opacity: !input.trim() || isLoading ? 0.4 : 1,
              }}
              aria-label="Invia"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {isListening && (
            <div style={styles.listeningBar}>
              <div style={styles.pulseRing} />
              <span style={styles.listeningText}>🎙️ Sto ascoltando... parla in inglese</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0f1729;
    color: #e8ecf4;
    -webkit-font-smoothing: antialiased;
  }
  textarea:focus { outline: none; }
  button { cursor: pointer; border: none; background: none; }

  @keyframes dotPulse {
    0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
    30% { opacity: 1; transform: scale(1); }
  }

  @keyframes pulseAnim {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2.5); opacity: 0; }
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxWidth: 540,
    margin: '0 auto',
    background: '#0f1729',
    position: 'relative',
  },

  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(15,23,41,0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '14px 18px',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  logoTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 500,
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 20,
    padding: '5px 14px',
    fontSize: 12,
    color: '#22C55E',
    fontWeight: 600,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22C55E',
    boxShadow: '0 0 8px rgba(34,197,94,0.6)',
  },

  chatArea: {
    flex: 1,
    overflow: 'auto',
    padding: '18px 14px',
    WebkitOverflowScrolling: 'touch',
  },
  chatInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  msgRow: {
    display: 'flex',
    animation: 'fadeSlideUp 0.3s ease-out',
  },
  userBubble: {
    maxWidth: '82%',
    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    borderRadius: '20px 20px 6px 20px',
    padding: '13px 18px',
    boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
  },
  userText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: '#fff',
    wordBreak: 'break-word',
  },
  assistantBubble: {
    maxWidth: '90%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px 20px 20px 6px',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  sectionCorrection: {
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.55)',
  },
  corrOriginal: {
    fontSize: 14,
    color: 'rgba(248,113,113,0.9)',
    lineHeight: 1.6,
    textDecoration: 'line-through',
    textDecorationColor: 'rgba(248,113,113,0.3)',
  },
  corrFixed: {
    fontSize: 14,
    color: '#34D399',
    lineHeight: 1.6,
    fontWeight: 600,
  },
  corrItalian: {
    fontSize: 13.5,
    color: 'rgba(165,180,252,0.85)',
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  corrPerfect: {
    fontSize: 14,
    color: '#34D399',
    fontWeight: 600,
    lineHeight: 1.6,
  },
  corrLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.6,
  },

  sectionQuestion: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
    border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 14,
    padding: '14px 16px',
  },
  questionText: {
    fontSize: 15,
    color: '#e8ecf4',
    lineHeight: 1.6,
    fontWeight: 500,
  },

  sectionResponse: {
    padding: '0 2px',
  },
  responseText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.7,
  },
  plainText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.7,
  },

  typingDots: {
    display: 'flex',
    gap: 6,
    padding: '6px 0',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
    animation: 'dotPulse 1.2s infinite',
    display: 'inline-block',
  },

  inputBar: {
    position: 'sticky',
    bottom: 0,
    background: 'rgba(15,23,41,0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '12px 14px env(safe-area-inset-bottom, 12px)',
  },
  inputInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: '8px 8px 8px 18px',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#e8ecf4',
    fontSize: 15,
    lineHeight: 1.5,
    resize: 'none',
    fontFamily: "'DM Sans', sans-serif",
    padding: '6px 0',
    maxHeight: 120,
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  micBtnActive: {
    background: 'rgba(239,68,68,0.15)',
    color: '#EF4444',
    boxShadow: '0 0 20px rgba(239,68,68,0.2)',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    transition: 'all 0.2s',
    flexShrink: 0,
  },

  listeningBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '6px 0',
  },
  pulseRing: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#EF4444',
    position: 'relative',
    boxShadow: '0 0 0 0 rgba(239,68,68,0.6)',
    animation: 'pulseAnim 1.5s infinite',
  },
  listeningText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
  },
};
