import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Trash2, Reply, MessageCircle, X, ChevronDown, ChevronRight } from 'lucide-react';

// Thread intero (radice -> fine) come messaggi chat, da qualsiasi nodo cliccato
export function chainFor(items, node) {
  const roots = buildTree(items || []);
  const target = node?.id;
  const findRoot = (nodes) => {
    for (const n of nodes) {
      if (n.id === target) return n;
      const inKids = findIn(n.children);
      if (inKids) return n;
    }
    return null;
  };
  const findIn = (nodes) => {
    for (const n of nodes) {
      if (n.id === target) return true;
      if (findIn(n.children)) return true;
    }
    return false;
  };
  const root = findRoot(roots);
  if (!root) return [];
  const messages = [];
  const walk = (n) => {
    // Riga AI: solo risposta (question duplica quella utente). Legacy Q+A: entrambi.
    if (n.role === 'assistant') {
      if (n.answer) messages.push({ role: 'assistant', content: n.answer });
    } else {
      messages.push({ role: 'user', content: n.question });
      if (n.answer) messages.push({ role: 'assistant', content: n.answer });
    }
    n.children.forEach(walk);
  };
  walk(root);
  return messages;
}

// Costruisce albero da righe piatte (legacy + thread). Legacy: answer valorizzato, role null.
export function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortKids = (n) => { n.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); n.children.forEach(sortKids); };
  roots.forEach(sortKids);
  return roots;
}

function Answer({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <span className="text-green-600 font-bold text-sm">A</span>
      </div>
      <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

function Actions({ node, replying, setReplying, onDelete, onChat, deletingId, showReply = true }) {
  return (
    <div className="mt-3 flex gap-2">
      {showReply && (
        <button
          onClick={() => setReplying(!replying)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary transition"
        >
          <Reply className="w-3.5 h-3.5" /> Rispondi
        </button>
      )}
      <button
        onClick={() => onChat(node)}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary transition"
      >
        <MessageCircle className="w-3.5 h-3.5" /> Chat
      </button>
      <button
        onClick={() => onDelete(node.id)}
        disabled={deletingId === node.id}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition disabled:opacity-50"
        title="Elimina (con risposte)"
      >
        {deletingId === node.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function ReplyForm({ onSubmit, asking }) {
  const [reply, setReply] = useState('');
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); if (!reply.trim()) return; await onSubmit(reply.trim()); setReply(''); }}
      className="mt-3 flex gap-2"
    >
      <input
        autoFocus
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Scrivi risposta..."
        disabled={asking}
        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-primary"
      />
      <button type="submit" disabled={asking || !reply.trim()} className="px-3 py-2 bg-primary text-white text-sm rounded-lg disabled:opacity-50">
        {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </form>
  );
}

function Node({ node, depth, collapsed, onToggle, onAsk, onDelete, onChat, asking, deletingId }) {
  const [replying, setReplying] = useState(false);
  const isAssistant = node.role === 'assistant' && node.answer;
  const nested = depth > 0 ? 'ml-6 mt-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : '';

  // Riga AI: solo risposta (niente bolla Q duplicata) + figli annidati = un thread unico
  if (isAssistant) {
    return (
      <div className={nested}>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-600 font-bold text-sm">A</span>
            </div>
            <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.answer}</ReactMarkdown>
            </div>
          </div>
          <Actions node={node} replying={replying} setReplying={setReplying} onDelete={onDelete} onChat={onChat} deletingId={deletingId} />
          {replying && <ReplyForm asking={asking} onSubmit={(text) => { setReplying(false); return onAsk(text, node.id); }} />}
        </div>
        {!collapsed.has(node.id) && node.children.map((child) => (
          <Node key={child.id} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onAsk={onAsk} onDelete={onDelete} onChat={onChat} asking={asking} deletingId={deletingId} />
        ))}
      </div>
    );
  }

  // Riga utente o legacy (Q+A): bolla domanda + eventuale risposta + figli
  const isCollapsed = collapsed.has(node.id);
  return (
    <div className={nested}>
      <div className="relative group bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-start gap-3">
          {depth === 0 && node.children.length > 0 && (
            <button
              onClick={() => onToggle(node.id)}
              title={isCollapsed ? 'Espandi thread' : 'Collassa thread'}
              className="flex-shrink-0 mt-0.5 rounded p-0.5 text-gray-400 hover:text-primary"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">Q</span>
          </div>
          <div className="flex-1 pr-8">
            <p className="text-gray-800 dark:text-gray-200 font-medium">{node.question}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {new Date(node.created_at).toLocaleString()}
              {node.children.length > 0 && (
                <span className="ml-2">· {node.children.length} {node.children.length === 1 ? 'risposta' : 'risposte'}</span>
              )}
            </p>
          </div>
        </div>
        <Answer text={node.answer} />
        <Actions node={node} replying={replying} setReplying={setReplying} onDelete={onDelete} onChat={onChat} deletingId={deletingId} />
        {replying && <ReplyForm asking={asking} onSubmit={(text) => { setReplying(false); return onAsk(text, node.id); }} />}
      </div>
      {!isCollapsed && node.children.map((child) => (
        <Node key={child.id} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onAsk={onAsk} onDelete={onDelete} onChat={onChat} asking={asking} deletingId={deletingId} />
      ))}
    </div>
  );
}

export function Thread({ items, onAsk, onDelete, onChat, asking, deletingId }) {
  const [question, setQuestion] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const roots = buildTree(items || []);

  const onToggle = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    await onAsk(question.trim(), null);
    setQuestion('');
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Fai una domanda..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
            className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition"
          />
          <button type="submit" disabled={asking || !question.trim()} className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium transition">
            {asking ? <><Loader2 className="w-5 h-5 animate-spin" /> Asking...</> : <><Send className="w-5 h-5" /> Ask</>}
          </button>
        </div>
      </form>
      <div className="space-y-6">
        {roots.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Nessuna domanda</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Fai la prima domanda!</p>
          </div>
        ) : (
          roots.map((n) => (
            <Node key={n.id} node={n} depth={0} collapsed={collapsed} onToggle={onToggle} onAsk={onAsk} onDelete={onDelete} onChat={onChat} asking={asking} deletingId={deletingId} />
          ))
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ chat, onSend, sending, onClose }) {
  const [input, setInput] = useState('');
  if (!chat) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    await onSend(text);
  };

  return (
    <div className="fixed right-0 top-0 z-[90] flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-bold dark:text-gray-100">
          <MessageCircle className="h-5 w-5 text-primary" /> Chat
        </h3>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800" title="Chiudi">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {(chat.messages || []).map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-xl p-3 text-sm ${m.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-200'}`}>
            {m.role === 'assistant' ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-line">{m.content}</p>
            )}
          </div>
        ))}
        {sending && <p className="text-sm text-gray-400">AI sta scrivendo...</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi messaggio..."
          disabled={sending}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button type="submit" disabled={sending || !input.trim()} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
