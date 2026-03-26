export const STORAGE_KEY = 'tradingJournal:v1';
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
export const STORAGE_WARNING_PERCENT = 80;
export const BE_THRESHOLD = 0.01;
export const PNL_MISMATCH_THRESHOLD = 0.01;

export const DEMO_PROFILE = {
  uid: "demo_user_2025",
  displayName: "Jake Mitchell",
  email: "demo@ohyaaa.com",
  photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
  emailVerified: true,
  role: "trader",
  createdAt: "2025-01-02T09:00:00Z",
};

export const FEEDBACK_TYPES = {
  general:     { icon: '💬', label: 'General',           bgColor: 'bg-blue-100',   textColor: 'text-blue-700',   borderColor: 'border-blue-200' },
  question:    { icon: '❓', label: 'Question',          bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  praise:      { icon: '⭐', label: 'Praise',            bgColor: 'bg-green-100',  textColor: 'text-green-700',  borderColor: 'border-green-200' },
  improvement: { icon: '⚠️', label: 'Needs Improvement', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  setup:       { icon: '🎯', label: 'Setup Related',     bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  psychology:  { icon: '🧠', label: 'Psychology',        bgColor: 'bg-pink-100',   textColor: 'text-pink-700',   borderColor: 'border-pink-200' },
  risk:        { icon: '📏', label: 'Risk Management',   bgColor: 'bg-red-100',    textColor: 'text-red-700',    borderColor: 'border-red-200' },
};

export const FLAG_TYPES = {
  discuss:       { icon: '🗣️', label: "Let's Discuss",    bgColor: 'bg-blue-100',   textColor: 'text-blue-700' },
  great:         { icon: '✨', label: 'Great Execution',   bgColor: 'bg-green-100',  textColor: 'text-green-700' },
  risk_concern:  { icon: '⚠️', label: 'Risk Concern',      bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
  rule_violation:{ icon: '🚫', label: 'Rule Violation',    bgColor: 'bg-red-100',    textColor: 'text-red-700' },
};

export const ASSIGNMENT_CATEGORIES = {
  reading:  { icon: '📖', label: 'Reading',         bgColor: 'bg-blue-100',   textColor: 'text-blue-700' },
  practice: { icon: '🎯', label: 'Practice',        bgColor: 'bg-green-100',  textColor: 'text-green-700' },
  review:   { icon: '📊', label: 'Review',          bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
  mindset:  { icon: '🧠', label: 'Mindset',         bgColor: 'bg-pink-100',   textColor: 'text-pink-700' },
  risk:     { icon: '📏', label: 'Risk Management', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
  other:    { icon: '📝', label: 'Other',           bgColor: 'bg-gray-100',   textColor: 'text-gray-700' },
};

export const HOMEWORK_CHALLENGE_TYPES = {
  profit:   { label: 'Profit Target',          metric: 'Total P&L',                        unit: '$' },
  winrate:  { label: 'Win Rate',               metric: 'Win percentage',                   unit: '%' },
  trades:   { label: 'Trade Count',            metric: 'Number of trades',                 unit: 'trades' },
  streak:   { label: 'Profitable Streak',      metric: 'Consecutive profitable days',      unit: 'days' },
  max_loss: { label: 'Max Loss Limit',         metric: 'No single loss over',              unit: '$' },
  custom:   { label: 'Custom',                 metric: 'Manual tracking',                  unit: '' },
};

export const EMPTY_STATE = {
  trades: [],
  setups: [],
  mistakes: [],
  dailyNotes: {},
  yearlyGoal: null,
  challenges: [],
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'tradelog',  label: 'Trade Log', icon: 'tradelog' },
  { id: 'calendar',  label: 'Calendar',  icon: 'calendar' },
  { id: 'goals',     label: 'Goals',     icon: 'goals' },
  { id: 'setups',    label: 'Setups',    icon: 'setups' },
  { id: 'mistakes',  label: 'Mistakes',  icon: 'mistakes' },
  { id: 'profile',   label: 'Profile',   icon: 'profile' },
];

export const FILTER_OPTIONS = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year' },
  { id: 'all',   label: 'All Time' },
];

export const ASSET_TYPES = [
  { id: 'stock',  label: 'Stock',  sizeLabel: 'Shares' },
  { id: 'option', label: 'Option', sizeLabel: 'Contracts' },
  { id: 'future', label: 'Future', sizeLabel: 'Contracts' },
  { id: 'forex',  label: 'Forex',  sizeLabel: 'Units' },
  { id: 'crypto', label: 'Crypto', sizeLabel: 'Units' },
];

export const POSITION_TYPES = [
  { id: 'long',        label: 'Long' },
  { id: 'short',       label: 'Short' },
  { id: 'long_scalp',  label: 'Long Scalp' },
  { id: 'short_scalp', label: 'Short Scalp' },
];
