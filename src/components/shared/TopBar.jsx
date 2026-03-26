import { useState } from 'react';
import { STORAGE_LIMIT_BYTES } from '../../utils/constants';
import { Avatar } from './StarRatingAvatar';
import Icons from './Icons';

export default function TopBar({ storageInfo, sidebarExpanded, isMobile, userProfile, onSignOut, notifications = [], onMarkAsRead, onMarkAllAsRead, onNotificationClick }) {
  const { megabytes, percentUsed, nearLimit } = storageInfo;
  const limitMB = (STORAGE_LIMIT_BYTES / (1024 * 1024)).toFixed(2);
  const [showMenu, setShowMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    const icons = {
      feedback: '💬', flag: '🚩', checkin: '📋', assignment: '📝',
      question_answered: '💡', assignment_reviewed: '✅', session: '📅', session_reminder: '⏰',
      question_asked: '❓', assignment_completed: '📋', student_daily_target: '🎯',
      student_challenge_complete: '🏅', student_milestone: '🎉', invite_accepted: '🤝',
      daily_target_hit: '🎯', daily_target_exceeded: '🔥', weekly_goal_progress: '📈',
      monthly_goal_progress: '🏆', yearly_goal_progress: '⭐', challenge_progress: '💪',
      challenge_completed: '🏅', challenge_failed: '😔', win_streak: '🔥',
      profitable_week: '💚', profitable_month: '💰', new_personal_best: '🏆',
      trading_milestone: '🎉', weekly_recap: '📊', monthly_report: '📈',
    };
    return icons[type] || '🔔';
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const now = new Date(), date = timestamp.toDate(), diffMs = now - date;
    const mins = Math.floor(diffMs / 60000), hrs = Math.floor(diffMs / 3600000), days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const NotificationBell = () => {
    const [selectedIds, setSelectedIds] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const toggleSelect = (id, e) => { e.stopPropagation(); setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]); };
    const markSelectedAsRead = () => { selectedIds.forEach(id => onMarkAsRead?.(id)); setSelectedIds([]); };
    const handleOpen = () => { setIsOpen(!isOpen); setSelectedIds([]); };
    const handleClose = () => { setIsOpen(false); setSelectedIds([]); };

    return (
      <>
        <button onClick={handleOpen} className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {isOpen && (
          <div className="fixed inset-0 z-[100]">
            <div className="fixed inset-0 bg-black/20" onClick={handleClose} />
            <div className={`fixed ${isMobile ? 'left-4 right-4 top-16' : 'right-4 top-14 w-96'} bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[70vh] flex flex-col`}>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  {selectedIds.length > 0 && <button onClick={markSelectedAsRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark selected ({selectedIds.length})</button>}
                  {unreadCount > 0 && selectedIds.length === 0 && <button onClick={() => onMarkAllAsRead?.()} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all as read</button>}
                  <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500"><div className="text-3xl mb-2">🔔</div><p>No notifications yet</p></div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.slice(0, 20).map(n => (
                      <div key={n.id}
                        onClick={() => { if (!n.read) onMarkAsRead?.(n.id); onNotificationClick?.(n); handleClose(); }}
                        className={`px-4 py-3 cursor-pointer transition-colors ${selectedIds.includes(n.id) ? 'bg-blue-100' : !n.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-start gap-3">
                          <div onClick={(e) => toggleSelect(n.id, e)}
                            className={`flex-shrink-0 w-5 h-5 mt-0.5 border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${selectedIds.includes(n.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}>
                            {selectedIds.includes(n.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="text-xl flex-shrink-0">{getNotificationIcon(n.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const UserMenu = ({ mobile }) => (
    <div className="relative">
      <button onClick={() => setShowMenu(!showMenu)} className={`flex items-center ${mobile ? '' : 'gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors'}`}>
        <Avatar user={userProfile} size="sm" />
        {!mobile && (
          <>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-gray-900">{userProfile.displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{userProfile.role}</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400"><path d="M6 9l6 6 6-6" /></svg>
          </>
        )}
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
          <div className={`absolute right-0 ${mobile ? 'top-10' : 'top-12'} bg-white rounded-lg shadow-lg border border-gray-200 py-2 ${mobile ? 'min-w-[160px]' : 'min-w-[200px]'} z-50`}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className={`font-medium text-gray-900 ${mobile ? 'text-sm' : ''}`}>{userProfile.displayName}</p>
              <p className={`text-gray-500 ${mobile ? 'text-xs' : 'text-sm'}`}>{userProfile.email}</p>
              {mobile && <p className="text-xs text-blue-600 capitalize">{userProfile.role}</p>}
            </div>
            <button onClick={() => { setShowMenu(false); onSignOut(); }}
              className={`w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 ${mobile ? '' : 'flex items-center gap-2'}`}>
              {!mobile && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20">
        <span className="font-bold text-lg"><span className="text-slate-900">oh</span><span className="text-blue-600">Yaaa</span></span>
        <div className="flex items-center gap-2">
          {userProfile && <NotificationBell />}
          {userProfile && <UserMenu mobile />}
        </div>
      </header>
    );
  }

  return (
    <header className={`fixed top-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20 transition-all duration-300 ease-in-out ${sidebarExpanded ? 'left-56' : 'left-16'}`}>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {nearLimit && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <span className="text-amber-600">{Icons.warning}</span>
            <span>Storage {percentUsed}% full</span>
          </div>
        )}
        {userProfile && <NotificationBell />}
        {userProfile && <UserMenu mobile={false} />}
      </div>
    </header>
  );
}
