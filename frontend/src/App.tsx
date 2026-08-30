import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Trash2, BarChart3, Zap, TrendingUp, FileText,
  Activity, RefreshCw, ChevronRight
} from 'lucide-react';
import { sendChat, type Message } from './api';

const STARTER_QUERIES = [
  { icon: '📊', text: "How's our pipeline looking for Mining sector this quarter?" },
  { icon: '🏆', text: 'Which deals were won this year? Show me the total value.' },
  { icon: '⚠️', text: 'Which won deals don\'t have a work order yet?' },
  { icon: '💰', text: 'What\'s our billing and collections status breakdown?' },
  { icon: '👥', text: 'Show me rep performance across both deals and work orders.' },
  { icon: '🔍', text: 'Are there any anomalies in our work order billing amounts?' },
  { icon: '📈', text: 'Which sectors are driving the most pipeline value?' },
  { icon: '🗓️', text: 'Which open deals have overdue tentative close dates?' },
];

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string[];
  isError?: boolean;
}

function TypingIndicator({ step }: { step: string }) {
  return (
    <div className="typing-row">
      <div className="avatar agent">🤖</div>
      <div className="typing-bubble">
        <span className="typing-step">{step}</span>
        <div className="typing-dots">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`message-row ${isUser ? 'user' : ''}`}>
      <div className={`avatar ${isUser ? 'user' : 'agent'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div>
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="tool-indicator">
            <Zap size={10} />
            {msg.toolCalls.map((t, i) => (
              <span key={i} className="tool-chip">{t}()</span>
            ))}
          </div>
        )}
        <div className={`message-bubble ${isUser ? 'user' : 'agent'}`}>
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          )}
          {msg.isError && (
            <div className="dq-badge" style={{ marginTop: 8 }}>
              ⚠️ Error — check console for details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ onSummary, onNav }: { onSummary: () => void; onNav: (q: string) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🚁</div>
        <div>
          <div className="logo-text">Skylark BI</div>
          <div className="logo-sub">Intelligence Agent</div>
        </div>
      </div>

      <div className="sidebar-divider" />

      <div>
        <div className="sidebar-section-title">Navigation</div>
        <nav className="sidebar-nav">
          <button className="nav-btn active" id="nav-chat">
            <Activity size={15} /> Chat
          </button>
          <button className="nav-btn" id="nav-summary" onClick={onSummary}>
            <FileText size={15} /> Leadership Briefing
          </button>
          <button className="nav-btn" id="nav-pipeline" onClick={() => onNav("Show me the pipeline overview across all sectors")}>
            <TrendingUp size={15} /> Pipeline
          </button>
          <button className="nav-btn" id="nav-ops" onClick={() => onNav("Show me work order operational health — execution and billing status breakdown")}>
            <BarChart3 size={15} /> Operations
          </button>
        </nav>
      </div>

      <div className="sidebar-divider" />

      <div>
        <div className="sidebar-section-title">Quick Queries</div>
        <nav className="sidebar-nav">
          {STARTER_QUERIES.slice(0, 4).map((q, i) => (
            <button key={i} className="nav-btn" onClick={() => onNav(q.text)} id={`quick-${i}`}>
              <ChevronRight size={13} />
              <span style={{ fontSize: 12 }}>{q.text.slice(0, 38)}…</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="status-badge">
          <div className="status-dot" />
          Monday.com Live
        </div>
      </div>
    </aside>
  );
}

function EmptyState({ onQuery }: { onQuery: (q: string) => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <div>
        <div className="empty-title">Ask me anything about your business</div>
        <div className="empty-sub" style={{ marginTop: 8 }}>
          I have live access to your Deals Pipeline and Work Orders from Monday.com.
          Ask founder-level questions in plain English.
        </div>
      </div>
      <div className="starter-grid">
        {STARTER_QUERIES.map((q, i) => (
          <button
            key={i}
            id={`starter-${i}`}
            className="starter-card"
            onClick={() => onQuery(q.text)}
          >
            <span className="starter-card-icon">{q.icon}</span>
            <span className="starter-card-text">{q.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingStep, setTypingStep] = useState('Thinking...');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = useCallback(async (text?: string) => {
    const query = (text || input).trim();
    if (!query || loading) return;

    setInput('');
    const userMsg: DisplayMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setTypingStep('Connecting to Monday.com...');

    // Build conversation history for API
    const history: Message[] = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Simulate step progression
      setTimeout(() => setTypingStep('Querying data...'), 600);
      setTimeout(() => setTypingStep('Analyzing with AI...'), 1800);

      const result = await sendChat(history);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: result.content,
          toolCalls: result.tool_calls_made,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSummary = () => handleSubmit('/summary');
  const clearChat = () => setMessages([]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="app-layout">
      <Sidebar onSummary={handleSummary} onNav={(q) => handleSubmit(q)} />

      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div>
            <div className="chat-header-title">Business Intelligence Agent</div>
            <div className="chat-header-sub">Deals Pipeline · Work Orders · Live from Monday.com</div>
          </div>
          <div className="header-actions">
            <button id="weekly-briefing-btn" className="summary-btn" onClick={handleSummary}>
              <FileText size={14} /> Weekly Briefing
            </button>
            <button id="clear-chat-btn" className="clear-btn" onClick={clearChat} title="Clear conversation">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-container" id="messages-container">
          {messages.length === 0 && !loading ? (
            <EmptyState onQuery={(q) => handleSubmit(q)} />
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {loading && <TypingIndicator step={typingStep} />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              id="chat-input"
              ref={inputRef}
              className="message-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a business question... (e.g., 'How's our Renewables pipeline?')"
              rows={1}
              disabled={loading}
            />
            <button
              id="send-btn"
              className="send-btn"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              title="Send message"
            >
              {loading ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send · Shift+Enter for new line · Try "/summary" for the weekly briefing
          </div>
        </div>
      </div>
    </div>
  );
}
