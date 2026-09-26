import { Star, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

// Indice corso come skill path: timeline verticale con nodi di stato.
// modules: [{title, level?, items: [{key, title, badge?}]}]
// getStatus(key) -> 'completed' | 'generated' | 'not-generated'
export function LevelBadge({ level }) {
  if (!level) return null;
  return (
    <span className={cn(
      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      level === 'foundation' && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      level === 'applied' && 'bg-indigo-100 text-primary dark:bg-indigo-900/50 dark:text-indigo-300',
      level === 'challenge' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    )}>
      {level}
    </span>
  );
}

const dot = {
  completed: 'bg-green-500',
  generated: 'bg-primary',
  'not-generated': 'bg-gray-300 dark:bg-gray-600',
};

export default function IndexPath({ modules, getStatus, isFav, isCurrent, onSelect, onToggleFav, className }) {
  return (
    <div className={className}>
      {(modules || []).map((module, mIdx) => (
        <div key={mIdx} className="mb-5">
          <div className="flex items-center gap-2 px-4 py-1.5">
            <span className="flex-1 text-[13px] font-bold leading-snug text-gray-800 dark:text-gray-200">{module.title}</span>
            <LevelBadge level={module.level} />
          </div>
          <ol className="relative ml-[21px] border-l border-gray-200 pl-1 dark:border-gray-700">
            {(module.items || []).map((item) => {
              const status = getStatus(item.key);
              const current = isCurrent(item.key);
              const fav = isFav(item.key);
              return (
                <li key={item.key}>
                  <button
                    onClick={() => onSelect(item)}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-r-lg py-2 pl-4 pr-3 text-left text-sm transition',
                      current
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                    )}
                  >
                    <span className={cn(
                      'absolute -left-[9px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4',
                      dot[status] || dot['not-generated'],
                      current ? 'ring-primary/20' : 'ring-white dark:ring-gray-900'
                    )} title={status} />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge}
                    {status !== 'not-generated' && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onToggleFav(e, item.key); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') onToggleFav(e, item.key); }}
                        title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        className="shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        <Star className={cn('h-3.5 w-3.5', fav ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400 dark:text-gray-600')} />
                      </span>
                    )}
                    {current && <ChevronRight className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
