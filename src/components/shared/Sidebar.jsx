import { useState } from 'react';
import { NAV_ITEMS } from '../../utils/constants';
import Icons from './Icons';

export default function Sidebar({ isExpanded, setIsExpanded, activePage, setActivePage, isMobile, navItems }) {
  const items = navItems || NAV_ITEMS;
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (isMobile) {
    const mainItems = items.slice(0, 4);
    const moreItems = items.slice(4);
    const isMoreActive = moreItems.some(item => item.id === activePage);

    return (
      <>
        {showMoreMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)}>
            <div className="absolute bottom-20 left-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-2">
                {moreItems.map((item) => {
                  const isActive = activePage === item.id;
                  return (
                    <button key={item.id}
                      onClick={(e) => { e.stopPropagation(); setActivePage(item.id); setShowMoreMenu(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <span className="w-6 h-6 flex items-center justify-center">{Icons[item.icon]}</span>
                      <span className="font-medium">{item.label}</span>
                      {isActive && (
                        <svg className="w-5 h-5 ml-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
          <div className="flex justify-around items-center h-16 px-2 pb-safe">
            {mainItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button key={item.id}
                  onClick={() => { setActivePage(item.id); setShowMoreMenu(false); }}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  <span className={`${isActive ? 'scale-110' : ''} transition-transform`}>{Icons[item.icon]}</span>
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </button>
              );
            })}
            {moreItems.length > 0 && (
              <button onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isMoreActive || showMoreMenu ? 'text-blue-600' : 'text-gray-500'}`}>
                <span className={`${isMoreActive || showMoreMenu ? 'scale-110' : ''} transition-transform`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                    <circle cx="12" cy="5" r="1" fill="currentColor" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-[10px] mt-1 font-medium">More</span>
              </button>
            )}
          </div>
        </nav>
      </>
    );
  }

  const LogoFull = () => (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 flex-shrink-0">
      <line x1="8" y1="6" x2="8" y2="20" stroke="#22c55e" strokeWidth="1.5"/>
      <rect x="6" y="9" width="4" height="7" fill="#22c55e" rx="0.5"/>
      <line x1="16" y1="10" x2="16" y2="28" stroke="#ef4444" strokeWidth="1.5"/>
      <rect x="14" y="14" width="4" height="10" fill="#ef4444" rx="0.5"/>
      <line x1="24" y1="3" x2="24" y2="18" stroke="#22c55e" strokeWidth="1.5"/>
      <rect x="22" y="5" width="4" height="8" fill="#22c55e" rx="0.5"/>
      <path d="M4 24 L10 16 L16 20 L22 14 L28 8" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3"/>
      <path d="M4 24 L10 16 L16 20 L22 14 L28 8" stroke="url(#sg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M23 8 L28 8 L28 13" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3"/>
      <path d="M23 8 L28 8 L28 13" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    </svg>
  );

  return (
    <aside className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 ease-in-out z-30 ${isExpanded ? 'w-56' : 'w-16'} flex flex-col`}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700">
        {isExpanded ? (
          <div className="flex items-center gap-2">
            <LogoFull />
            <span className="font-bold text-lg tracking-tight"><span className="text-white">oh</span><span className="text-blue-400">Yaaa</span></span>
          </div>
        ) : <LogoFull />}
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-auto">
          {isExpanded ? Icons.chevronLeft : Icons.chevronRight}
        </button>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {items.map((item) => {
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  <span className="flex-shrink-0">{Icons[item.icon]}</span>
                  {isExpanded && <span className="text-sm font-medium truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
