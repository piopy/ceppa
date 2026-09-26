import { Link } from 'react-router-dom';
import { Book, BrainCircuit, FileDown, Route, MessageCircle } from 'lucide-react';

// Layout split condiviso login/register: brand panel + form. Mobile: solo form.
export default function AuthLayout({ title, subtitle, error, children, footer }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr] bg-gray-50 dark:bg-gray-900">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-secondary text-white lg:flex lg:flex-col lg:justify-between p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />
        <Link to="/" className="relative flex items-center gap-2 text-xl font-bold tracking-tight">
          <Book className="h-7 w-7 text-primary" />
          Ceppa.ai
        </Link>
        <div className="relative">
          <h1 className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight text-balance">
            Impara cosa non sai
          </h1>
          <h1 className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight text-balance">
            usando l'IA.
          </h1>
          <ul className="mt-8 space-y-5 text-[15px] text-white/80">
            <li className="flex gap-3">
              <BrainCircuit className="h-5 w-5 shrink-0 text-indigo-300" />
              <span><strong className="font-semibold text-white">Corsi generati</strong> su qualsiasi argomento, nella tua lingua.</span>
            </li>
            <li className="flex gap-3">
              <Route className="h-5 w-5 shrink-0 text-indigo-300" />
              <span><strong className="font-semibold text-white">Roadmap e lab pratici</strong> con progetti reali, non snippet.</span>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="h-5 w-5 shrink-0 text-indigo-300" />
              <span><strong className="font-semibold text-white">Chatta con l'IA</strong> per fugare i tuoi dubbi</span>
            </li>
            <li className="flex gap-3">
              <FileDown className="h-5 w-5 shrink-0 text-indigo-300" />
              <span><strong className="font-semibold text-white">PDF pronti</strong> da rileggere offline, ovunque.</span>
            </li>
          </ul>
        </div>
        <p className="relative text-sm text-white/50">Ceppa nasce per capire se i modelli sanno davvero insegnare.</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Book className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Ceppa.ai</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export const authInput =
  'mt-1 w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition text-[15px]';

export const authButton =
  'w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-50';
