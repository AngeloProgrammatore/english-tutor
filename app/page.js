'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `ð¬ MY RESPONSE:
Hey there! ð I'm SpeakEasy, your English conversation buddy! I'm here to chat with you, correct your mistakes, and help you sound more natural â all while having fun!

â NEXT QUESTION:
So, tell me â what topic are you into? Movies, travel, food, sports, tech, music? Pick anything and let's dive in! ð`,
};

export default function Home() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  }, [messages, isLoading]);

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

    try {
      const apiMessages = newMessages
        .filter((m) => m !== WELCOME_MESSAGE)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'â ï¸ Oops, something went wrong. Try again!' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'â ï¸ Connection error. Check your internet and try again!' },
      ]);
    } finally {
      setIsLoading(false);
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
        sendMessage(transcript);
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

      if (trimmedLine.startsWith('ð¯')) {
        currentSection = { type: 'correction', title: 'Correction', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^ð¯\s*CORRECTION:?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (trimmedLine.startsWith('ð')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('â')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('ð®ð¹')) {
        if (currentSection?.type === 'correction') {
          currentSection.lines.push(trimmedLine);
        }
      } else if (trimmedLine.startsWith('ð¬')) {
        currentSection = { type: 'response', title: 'Response', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^ð¬\s*MY RESPONSE:?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (trimmedLine.startsWith('â')) {
        currentSection = { type: 'question', title: 'Question', lines: [] };
        sections.push(currentSection);
        const rest = trimmedLine.replace(/^â\s*NEXT QUESTION:?\s*/i, '').trim();
        if (rest) currentSection.lines.push(rest);
      } else if (currentSection) {
        currentSection.lines.push(trimmedLine);
      } else {
        currentSection = { type: 'response', title: '', lines: [trimmedLine] };
        sections.push(currentSection);
      }
    }

    if (sections.length === 0) {
      return <p style={styles.plainText}>{text}</p>;
    }

    return sections.map((section, i) => {
      const content = section.lines.join('\n');
      if (section.type === 'correction') {
        return (
          <div key={i} style={styles.sectionCorrection}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>ð¯</span>
              <span style={styles.sectionLabel}>Correction</span>
            </div>
            {section.lines.map((l, j) => {
              if (l.startsWith('ð'))
                return (
                  <p key={j} style={styles.corrOriginal}>
                    {l.replace(/^ð\s*YOU SAID:\s*/i, 'ð ')}
                  </p>
                );
              if (l.startsWith('â'))
                return (
                  <p key={j} style={styles.corrFixed}>
                    {l.replace(/^â\s*CORRECT:\s*/i, 'â ')}
                  </p>
                );
              if (l.startsWith('ð®ð¹'))
                return (
                  <p key={j} style={styles.corrItalian}>
                    {l.replace(/^ð®ð¹\s*ITALIANO:\s*/i, 'ð®ð¹ ')}
                  </p>
                );
              if (l.toLowerCase().includes('perfect') || l.toLowerCase().includes('no correction'))
                return (
                  <p key={j} style={styles.corrPerfect}>
                    â¨ {l}
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
        return (
          <div key={i} style={styles.sectionQuestion}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>â</span>
              <span style={styles.sectionLabel}>Your turn!</span>
            </div>
            <p style={styles.questionText}>{content}</p>
          </div>
        );
      }

      return (
        <div key={i} style={styles.sectionResponse}>
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

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>â¡</div>
            <div>
              <h1 style={styles.logoTitle}>SpeakEasy</h1>
              <p style={styles.logoSub}>English Conversation Tutor</p>
            </div>
          </div>
          <div style={styles.statusPill}>
            <span style={styles.statusDot} />
            Online
          </div>
        </div>
      </header>

      {/* Chat area */}
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

          {isLoading && (
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

      {/* Input bar */}
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
              placeholder="Type or speak in English..."
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
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
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
              aria-label="Send message"
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
              <span style={styles.listeningText}>ðï¸ Listening... speak in English</span>
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
    background: #0a0f1c;
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
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxWidth: 520,
    margin: '0 auto',
    background: 'linear-gradient(180deg, #0d1222 0%, #0a0f1c 100%)',
    position: 'relative',
  },

  // Header
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(13,18,34,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 16px',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6C63FF 0%, #4ECDC4 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  logoTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(78,205,196,0.1)',
    border: '1px solid rgba(78,205,196,0.2)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: 500,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#4ECDC4',
    boxShadow: '0 0 8px rgba(78,205,196,0.6)',
  },

  // Chat
  chatArea: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 12px',
    WebkitOverflowScrolling: 'touch',
  },
  chatInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  msgRow: {
    display: 'flex',
    animation: 'fadeSlideUp 0.3s ease-out',
  },
  userBubble: {
    maxWidth: '82%',
    background: 'linear-gradient(135deg, #6C63FF 0%, #5B54E0 100%)',
    borderRadius: '20px 20px 6px 20px',
    padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(108,99,255,0.25)',
  },
  userText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: '#fff',
    wordBreak: 'break-word',
  },
  assistantBubble: {
    maxWidth: '88%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px 20px 20px 6px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  // Correction section
  sectionCorrection: {
    background: 'rgba(255,183,77,0.06)',
    border: '1px solid rgba(255,183,77,0.15)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.5)',
  },
  corrOriginal: {
    fontSize: 13.5,
    color: 'rgba(255,120,120,0.85)',
    lineHeight: 1.5,
    textDecoration: 'line-through',
    textDecorationColor: 'rgba(255,120,120,0.3)',
  },
  corrFixed: {
    fontSize: 13.5,
    color: '#4ECDC4',
    lineHeight: 1.5,
    fontWeight: 600,
  },
  corrItalian: {
    fontSize: 13,
    color: 'rgba(165,180,252,0.8)',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  corrPerfect: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  corrLine: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
  },

  // Question section
  sectionQuestion: {
    background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(78,205,196,0.08))',
    border: '1px solid rgba(108,99,255,0.15)',
    borderRadius: 14,
    padding: '12px 14px',
  },
  questionText: {
    fontSize: 15,
    color: '#e8ecf4',
    lineHeight: 1.55,
    fontWeight: 500,
  },

  // Response section
  sectionResponse: {
    padding: '0 2px',
  },
  responseText: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.6,
  },
  plainText: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.6,
  },

  // Typing dots
  typingDots: {
    display: 'flex',
    gap: 5,
    padding: '4px 0',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
    animation: 'dotPulse 1.2s infinite',
    display: 'inline-block',
  },

  // Input bar
  inputBar: {
    position: 'sticky',
    bottom: 0,
    background: 'rgba(13,18,34,0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 12px env(safe-area-inset-bottom, 10px)',
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
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: '6px 6px 6px 16px',
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
    width: 40,
    height: 40,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  micBtnActive: {
    background: 'rgba(255,77,77,0.15)',
    color: '#ff4d4d',
    boxShadow: '0 0 20px rgba(255,77,77,0.2)',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #6C63FF 0%, #4ECDC4 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    transition: 'all 0.2s',
    flexShrink: 0,
  },

  // Listening indicator
  listeningBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '4px 0',
  },
  pulseRing: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ff4d4d',
    position: 'relative',
    boxShadow: '0 0 0 0 rgba(255,77,77,0.6)',
    animation: 'pulseAnim 1.5s infinite',
  },
  listeningText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
  },
};
