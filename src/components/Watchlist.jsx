import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderPlus, Plus, GripVertical, X, Check } from 'lucide-react';

const LS_KEY = 'wl_v6';

const DEFAULT_SECTIONS = [
  { id: 'tri', label: 'Triangle', icon: '▲', color: '#a78bfa' },
  { id: 'ep',  label: 'EP Setup', icon: '⚡', color: '#f59e0b' },
];

const DEFAULT_STOCKS = [
  { id: 's1', ticker: 'NVDA',  note: 'sym tri / 52W hi',   secId: 'tri' },
  { id: 's2', ticker: 'MSTR',  note: 'asc tri / pivot',    secId: 'tri' },
  { id: 's3', ticker: 'PLTR',  note: 'pennant / vol dry',  secId: 'tri' },
  { id: 's4', ticker: 'SMCI',  note: 'EP gap / hold base', secId: 'ep'  },
  { id: 's5', ticker: 'CWAN',  note: 'EP follow-thru',     secId: 'ep'  },
];

const ICON_OPTIONS  = ['▲', '⚡', '◆', '★', '●', '⬟', '◈', '◉'];
const COLOR_OPTIONS = ['#a78bfa','#f59e0b','#4ade80','#38bdf8','#fb7185','#f97316','#a3e635','#e879f9'];

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sections: DEFAULT_SECTIONS, stocks: DEFAULT_STOCKS };
}

function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Section modal ────────────────────────────────────────────────────────────
function SectionModal({ mode, initial, onSave, onDelete, onClose }) {
  const [name,  setName]  = useState(initial?.label || '');
  const [icon,  setIcon]  = useState(initial?.icon  || ICON_OPTIONS[0]);
  const [color, setColor] = useState(initial?.color || COLOR_OPTIONS[0]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKey = e => {
    if (e.key === 'Enter')  { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const handleSave = () => {
    const label = name.trim();
    if (!label) return;
    onSave({ label, icon, color });
  };

  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-lg">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-52" onKeyDown={handleKey}>
        <div className="text-[11px] font-medium text-zinc-400 mb-3">
          {mode === 'edit' ? 'Edit Section' : 'New Section'}
        </div>

        {/* Name */}
        <input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Section name"
          className="w-full text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 outline-none mb-3"
        />

        {/* Icon picker */}
        <div className="text-[10px] text-zinc-600 mb-1.5">Icon</div>
        <div className="flex flex-wrap gap-1 mb-3">
          {ICON_OPTIONS.map(ic => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className={`w-7 h-7 rounded text-[13px] flex items-center justify-center border transition-colors
                ${icon === ic ? 'border-zinc-400 bg-zinc-700' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'}`}
            >
              {ic}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="text-[10px] text-zinc-600 mb-1.5">Color</div>
        <div className="flex flex-wrap gap-1 mb-4">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-5 h-5 rounded border-2 transition-colors ${color === c ? 'border-white' : 'border-transparent'}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <button
              onClick={onDelete}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors mr-auto"
            >
              Delete
            </button>
          )}
          <button onClick={onClose} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-[11px] bg-zinc-100 text-zinc-900 font-medium rounded px-3 py-1 hover:bg-white transition-colors"
          >
            {mode === 'edit' ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Watchlist component ─────────────────────────────────────────────────
export default function Watchlist() {
  const [sections, setSections] = useState([]);
  const [stocks,   setStocks]   = useState([]);
  const [addOpen,  setAddOpen]  = useState(false);
  const [addText,  setAddText]  = useState('');
  const [addSecId, setAddSecId] = useState('');
  const [modal,    setModal]    = useState(null); // null | { mode:'create'|'edit', secId }
  const [hoveredSec, setHoveredSec] = useState(null);

  const addInputRef = useRef(null);
  const dragItem    = useRef(null); // { stockId }
  const initialized = useRef(false);

  // Load from localStorage once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const s = loadState();
    setSections(s.sections || DEFAULT_SECTIONS);
    setStocks(s.stocks || DEFAULT_STOCKS);
  }, []);

  // Set default add-section when sections load
  useEffect(() => {
    if (sections.length && !addSecId) {
      setAddSecId(sections[0].id);
    }
  }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus add input when opened
  useEffect(() => {
    if (addOpen) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addOpen]);

  const persist = useCallback((newSections, newStocks) => {
    setSections(newSections);
    setStocks(newStocks);
    saveState({ sections: newSections, stocks: newStocks });
  }, []);

  // ── Add stock ──────────────────────────────────────────────────────────────
  const handleAddSubmit = () => {
    const parts = addText.trim().split(/\s+/);
    if (!parts.length || !parts[0]) return;
    const ticker = parts[0].toUpperCase();
    const note   = parts.slice(1).join(' ') || '—';
    const secId  = addSecId || sections[0]?.id || '';
    const newStock = { id: uid(), ticker, note, secId };
    const newStocks = [...stocks, newStock];
    persist(sections, newStocks);
    setAddText('');
  };

  const handleAddKey = e => {
    if (e.key === 'Enter')  { e.preventDefault(); handleAddSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); setAddOpen(false); setAddText(''); }
  };

  // ── Delete stock ───────────────────────────────────────────────────────────
  const deleteStock = id => {
    persist(sections, stocks.filter(s => s.id !== id));
  };

  // ── Section CRUD ───────────────────────────────────────────────────────────
  const handleCreateSection = ({ label, icon, color }) => {
    const newSec = { id: uid(), label, icon, color };
    persist([...sections, newSec], stocks);
    setModal(null);
  };

  const handleEditSection = ({ label, icon, color }) => {
    const secId = modal.secId;
    persist(sections.map(s => s.id === secId ? { ...s, label, icon, color } : s), stocks);
    setModal(null);
  };

  const handleDeleteSection = () => {
    const secId = modal.secId;
    persist(
      sections.filter(s => s.id !== secId),
      stocks.filter(s => s.secId !== secId)
    );
    setModal(null);
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDragStart = (e, stockId) => {
    dragItem.current = stockId;
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('is-dragging');
    e.currentTarget.style.opacity = '0.35';
  };

  const onDragEnd = e => {
    dragItem.current = null;
    document.body.classList.remove('is-dragging');
    e.currentTarget.style.opacity = '';
    // Clear all drop indicators
    document.querySelectorAll('[data-drop-pos]').forEach(el => {
      el.style.borderTop    = '';
      el.style.borderBottom = '';
      delete el.dataset.dropPos;
    });
  };

  const onDragOver = (e, rowEl) => {
    e.preventDefault();
    const rect = rowEl.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    rowEl.style.borderTop    = before ? '1.5px solid #71717a' : '';
    rowEl.style.borderBottom = before ? '' : '1.5px solid #71717a';
    rowEl.dataset.dropPos    = before ? 'before' : 'after';
  };

  const onDragLeave = (e, rowEl) => {
    if (!rowEl.contains(e.relatedTarget)) {
      rowEl.style.borderTop    = '';
      rowEl.style.borderBottom = '';
      delete rowEl.dataset.dropPos;
    }
  };

  const onDrop = (e, targetStockId, targetSecId) => {
    e.preventDefault();
    const srcId = dragItem.current;
    if (!srcId || srcId === targetStockId) return;

    const targetRow = e.currentTarget;
    const pos = targetRow.dataset.dropPos || 'after';
    targetRow.style.borderTop    = '';
    targetRow.style.borderBottom = '';
    delete targetRow.dataset.dropPos;

    const newStocks = stocks.filter(s => s.id !== srcId);
    const targetIdx = newStocks.findIndex(s => s.id === targetStockId);
    const insertAt  = pos === 'before' ? targetIdx : targetIdx + 1;
    const moved     = { ...stocks.find(s => s.id === srcId), secId: targetSecId };
    newStocks.splice(insertAt, 0, moved);
    persist(sections, newStocks);
  };

  // Drop onto empty section placeholder
  const onDropEmpty = (e, secId) => {
    e.preventDefault();
    const srcId = dragItem.current;
    if (!srcId) return;
    const moved     = { ...stocks.find(s => s.id === srcId), secId };
    const newStocks = [...stocks.filter(s => s.id !== srcId), moved];
    persist(sections, newStocks);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const modalSec = modal ? sections.find(s => s.id === modal.secId) : null;

  return (
    <>
      {/* Inject hover-suppression CSS once */}
      <style>{`
        body:not(.is-dragging) .wl-stock-row:hover {
          background-color: rgba(39,39,42,0.6);
        }
        body:not(.is-dragging) .wl-stock-row:hover .wl-grip,
        body:not(.is-dragging) .wl-stock-row:hover .wl-del {
          opacity: 1;
        }
      `}</style>

      <div className="w-56 flex-shrink-0 border border-zinc-700 bg-zinc-900 rounded-xl flex flex-col relative select-none overflow-hidden" style={{ minHeight: 0, margin: '12px 10px 12px 0' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Watchlist</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModal({ mode: 'create' })}
              title="New section"
              className="p-1 text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 rounded transition-colors"
            >
              <FolderPlus size={13} />
            </button>
            <button
              onClick={() => { setAddOpen(v => !v); setAddText(''); }}
              title="Add stock"
              className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 rounded transition-colors"
            >
              <Plus size={11} />Add
            </button>
          </div>
        </div>

        {/* ── Add row ─────────────────────────────────────────────────────── */}
        {addOpen && (
          <div className="bg-zinc-900/50 border-b border-zinc-800 px-2 py-2 flex flex-col gap-1.5">
            <input
              ref={addInputRef}
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={handleAddKey}
              placeholder="NVDA sym tri…"
              className="w-full text-[11px] font-mono bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded px-2 py-1 text-zinc-100 placeholder-zinc-600 outline-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={addSecId}
                onChange={e => setAddSecId(e.target.value)}
                className="min-w-0 flex-1 text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-1 py-1 outline-none"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                ))}
              </select>
              <button
                onClick={handleAddSubmit}
                className="flex-shrink-0 p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                <Check size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── Sections + stocks ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {sections.map(sec => {
            const secStocks = stocks.filter(s => s.secId === sec.id);
            return (
              <div key={sec.id}>
                {/* Section header */}
                <div
                  className="group flex items-center gap-1.5 px-2 py-1.5"
                  onMouseEnter={() => setHoveredSec(sec.id)}
                  onMouseLeave={() => setHoveredSec(null)}
                >
                  <span className="text-[11px]" style={{ color: sec.color }}>{sec.icon}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{sec.label}</span>
                  <div className="flex-1 h-px bg-zinc-800 mx-1" />
                  <button
                    onClick={() => setModal({ mode: 'edit', secId: sec.id })}
                    className="text-[9px] text-zinc-700 hover:text-zinc-400 transition-colors"
                    style={{ opacity: hoveredSec === sec.id ? 1 : 0 }}
                  >
                    edit
                  </button>
                </div>

                {/* Stock rows */}
                {secStocks.length === 0 ? (
                  <div
                    className="text-[10px] text-zinc-700 border border-dashed border-zinc-800 rounded-md text-center py-2 mx-2 my-1"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => onDropEmpty(e, sec.id)}
                  >
                    drop here
                  </div>
                ) : (
                  secStocks.map(stock => (
                    <div
                      key={stock.id}
                      className="wl-stock-row flex items-center gap-1.5 px-2 py-1 cursor-grab rounded-sm mx-1 transition-colors"
                      draggable
                      onDragStart={e => onDragStart(e, stock.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={e => onDragOver(e, e.currentTarget)}
                      onDragLeave={e => onDragLeave(e, e.currentTarget)}
                      onDrop={e => onDrop(e, stock.id, sec.id)}
                    >
                      <GripVertical size={12} className="wl-grip text-zinc-700 opacity-0 flex-shrink-0 transition-opacity" />
                      <span className="text-[12px] font-medium text-zinc-100 font-mono w-10 flex-shrink-0">{stock.ticker}</span>
                      <span className="flex-1 text-[10px] text-zinc-600 truncate">{stock.note}</span>
                      <button
                        onClick={() => deleteStock(stock.id)}
                        className="wl-del opacity-0 flex-shrink-0 text-zinc-700 hover:text-red-400 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-3 py-2 border-t border-zinc-800 text-[10px] text-zinc-700">
          {stocks.length} watching
        </div>

        {/* ── Section modal ────────────────────────────────────────────────── */}
        {modal && (
          <SectionModal
            mode={modal.mode}
            initial={modal.mode === 'edit' ? modalSec : null}
            onSave={modal.mode === 'edit' ? handleEditSection : handleCreateSection}
            onDelete={modal.mode === 'edit' ? handleDeleteSection : undefined}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </>
  );
}
