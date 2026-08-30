import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  ArrowUpRight,
  TrendingUp,
  FileText,
  AlertTriangle,
  Layers,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Terminal,
  Loader2,
  DollarSign,
  Building2,
  CheckCircle2,
  ExternalLink,
  Bot,
  User,
} from 'lucide-react';
import { AiLightsCard } from './ai-lights/AiLightsCard';
import { sendChat, type Message } from './api';




interface QueryCard {
  id: string;
  category: string;
  badge: 'live' | 'cross' | 'anomaly' | 'free';
  badgeText: string;
  title: string;
  description: string;
  tags: string[];
  query: string;
  isFeatured?: boolean;
}

const STARTER_RESOURCES: QueryCard[] = [
  {
    id: 'mining-pipeline',
    category: 'Pipeline',
    badge: 'live',
    badgeText: 'Live Query',
    title: 'Mining Sector Pipeline',
    description: 'Breakdown of deals, total pipeline value with data coverage, and stage distribution in Mining.',
    tags: ['mining', 'pipeline', 'deal-value'],
    query: "How is our pipeline looking for the Mining sector? Show me value and stage distribution.",
    isFeatured: true,
  },
  {
    id: 'won-deals-audit',
    category: 'Reconciliation',
    badge: 'cross',
    badgeText: 'Cross-Board',
    title: 'Won Deals Without Work Orders',
    description: 'Cross-board join between Deals and Work Orders to flag won contracts missing execution trackers.',
    tags: ['reconciliation', 'won-deals', 'work-orders'],
    query: 'Which won deals do not have a work order yet?',
    isFeatured: true,
  },
  {
    id: 'billing-anomalies',
    category: 'Operations',
    badge: 'anomaly',
    badgeText: 'Anomaly Alert',
    title: 'Billing Overrun Audit',
    description: 'Identifies negative amounts to be billed, surfacing operational over-billing versus purchase orders.',
    tags: ['work-orders', 'billing-status', 'anomalies'],
    query: 'Are there any anomalies or negative amounts in our work order billing?',
  },
  {
    id: 'sectoral-ranking',
    category: 'Pipeline',
    badge: 'live',
    badgeText: 'Deals',
    title: 'Sector Performance Overview',
    description: 'Aggregates all 346 deals across Mining, Powerline, Renewables, Railways, and DSP sectors.',
    tags: ['sectors', 'revenue', 'aggregates'],
    query: 'Show me the pipeline breakdown and performance across all sectors.',
  },
  {
    id: 'rep-performance',
    category: 'Sales',
    badge: 'cross',
    badgeText: 'Cross-Board',
    title: 'Owner Performance Matrix',
    description: 'Evaluates rep performance across deal closures (Owner code) and project handoffs.',
    tags: ['owners', 'sales-velocity', 'operations'],
    query: 'Show me rep performance across both deals pipeline and work orders.',
  },
  {
    id: 'receivables-health',
    category: 'Finance',
    badge: 'live',
    badgeText: 'Collections',
    title: 'AR Priority & Receivables',
    description: 'Inspects billed amounts, collected cash, outstanding receivables, and priority collection flags.',
    tags: ['receivables', 'collections', 'ar-priority'],
    query: "What is our current billing and collections health across work orders?",
  },
];

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string[];
  isError?: boolean;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize theme from localStorage / system preference
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = useCallback(async (queryText?: string) => {
    const query = (queryText || input).trim();
    if (!query || loading) return;

    setInput('');
    const userMsg: DisplayMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history: Message[] = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
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
          content: `Error: ${err instanceof Error ? err.message : 'Unable to complete request'}. Please try again.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleExecutiveSummary = () => handleSubmit('/summary');
  const clearChat = () => setMessages([]);

  const filteredCards = selectedCategory === 'All'
    ? STARTER_RESOURCES
    : STARTER_RESOURCES.filter(c => c.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="site-container">
      {/* ─── Header matching stash.nishanthkonchada.dev ─── */}
      <header className="site-header">
        <div className="header-content">
          <div
            className="brand-wrapper"
            style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}
          >
            <AiLightsCard onClick={clearChat} />
            <span className="brand-tag hide-mobile">Monday.com Live</span>
          </div>






          <div className="header-actions">
            <button
              className="sparkle-btn primary"
              onClick={handleExecutiveSummary}
              title="Generate leadership update"
            >
              <Sparkles size={14} />
              <span>Weekly Briefing</span>
            </button>

            <a
              href="https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="sparkle-btn hide-mobile"
            >
              <ExternalLink size={14} />
              <span>GitHub</span>
            </a>

            {messages.length > 0 && (
              <button
                className="sparkle-btn"
                onClick={clearChat}
                title="Clear conversation history"
              >
                <Trash2 size={14} />
                <span className="hide-mobile">Reset</span>
              </button>
            )}

            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Hero Section ─── */}
        <section className="hero">
          <h1>
            Founder-level intelligence for <span className="highlight">Skylark Drones</span>.
          </h1>
          <p>
            Real-time analytics and cross-board reasoning across Deals Pipeline (346 records) and Work Orders (176 records).
          </p>
        </section>

        {/* ─── Category Filter Chips (Stash Component) ─── */}
        {messages.length === 0 && (
          <>
            <div className="category-chips-container">
              <div className="category-chips">
                <button
                  className={`chip ${selectedCategory === 'All' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('All')}
                >
                  All Queries <span className="chip-count">6</span>
                </button>
                <button
                  className={`chip ${selectedCategory === 'Pipeline' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('Pipeline')}
                >
                  Deals Pipeline <span className="chip-count">2</span>
                </button>
                <button
                  className={`chip ${selectedCategory === 'Reconciliation' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('Reconciliation')}
                >
                  Reconciliation <span className="chip-count">1</span>
                </button>
                <button
                  className={`chip ${selectedCategory === 'Operations' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('Operations')}
                >
                  Operations <span className="chip-count">1</span>
                </button>
                <button
                  className={`chip ${selectedCategory === 'Sales' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('Sales')}
                >
                  Rep Performance <span className="chip-count">1</span>
                </button>
                <button
                  className={`chip ${selectedCategory === 'Finance' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('Finance')}
                >
                  Receivables <span className="chip-count">1</span>
                </button>
              </div>
            </div>

            {/* ─── Resource Grid matching stash.nishanthkonchada.dev ─── */}
            <div className="resource-grid">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className={`resource-card ${card.isFeatured ? 'featured' : ''}`}
                  onClick={() => handleSubmit(card.query)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-header">
                    <div className="icon-title">
                      <div className="card-icon-box">
                        {card.badge === 'live' && <TrendingUp size={15} />}
                        {card.badge === 'cross' && <Layers size={15} />}
                        {card.badge === 'anomaly' && <AlertTriangle size={15} />}
                      </div>
                      <h3>{card.title}</h3>
                    </div>
                    <span className={`badge ${card.badge}`}>{card.badgeText}</span>
                  </div>

                  <p className="description">{card.description}</p>

                  <div className="card-footer">
                    <div className="tags">
                      {card.tags.map((t, idx) => (
                        <span key={idx} className="tag">#{t}</span>
                      ))}
                    </div>
                    <ArrowUpRight size={15} className="external-icon" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── Conversation Stream ─── */}
        {messages.length > 0 && (
          <div className="chat-section">
            <div className="messages-list">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={i} className={`message-item ${isUser ? 'user' : 'assistant'}`}>
                    <div className="avatar-badge">
                      {isUser ? <User size={15} /> : <Bot size={15} />}
                    </div>
                    <div className="message-body">
                      {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="message-tools-trace">
                          <Terminal size={12} />
                          <span>Executed:</span>
                          {msg.toolCalls.map((t, tIdx) => (
                            <span key={tIdx} className="tool-tag">{t}()</span>
                          ))}
                        </div>
                      )}
                      <div className="message-card">
                        {isUser ? (
                          <span>{msg.content}</span>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="typing-container">
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Querying Monday.com boards and evaluating data quality...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* ─── Search / Query Input (matching Stash search-container) ─── */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="query-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask an executive query (e.g. 'How is our Renewables pipeline?' or '/summary')..."
              disabled={loading}
            />
            <button
              className="input-send-btn"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
            >
              <span>Query</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="site-footer">
        <div>
          <span>Skylark Drones — Monday.com Business Intelligence Agent</span>
        </div>
        <div className="footer-links">
          <a
            href="https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Source Code
          </a>
        </div>
      </footer>

    </div>
  );
}
