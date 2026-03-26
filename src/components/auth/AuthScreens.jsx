import { useState, useRef } from 'react';
import { auth, db, firebase } from '../../firebase';
import { emailTemplates, sendEmail } from '../../utils/emailService';

const FUNCTIONS_BASE = 'https://us-central1-trading-journal-86e97.cloudfunctions.net';

const getAuthErrorMessage = (code) => {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled',
    'auth/weak-password': 'Password is too weak',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
  };
  return messages[code] || 'An error occurred. Please try again';
};

// =============================================================================
// VERIFICATION SCREEN
// =============================================================================
export function VerificationScreen({ user, userProfile, onVerified }) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const handleCodeChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...verificationCode];
      digits.forEach((d, i) => { if (index + i < 6) newCode[index + i] = d; });
      setVerificationCode(newCode);
      refs[Math.min(index + digits.length, 5)]?.current?.focus();
    } else {
      const newCode = [...verificationCode];
      newCode[index] = value.replace(/\D/g, '');
      setVerificationCode(newCode);
      if (value && index < 5) refs[index + 1]?.current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) refs[index - 1]?.current?.focus();
  };

  const handleVerify = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/verifyCode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: user.uid, code }) });
      const result = await res.json();
      if (!res.ok) { setError(result.error || 'Verification failed'); setLoading(false); return; }
      try { await sendEmail(emailTemplates.welcome(user.email, userProfile?.displayName || 'there')); } catch {}
      onVerified?.();
    } catch { setError('Failed to verify code. Please try again.'); setLoading(false); }
  };

  const handleResend = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/sendVerificationCode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, displayName: userProfile?.displayName || '', uid: user.uid }) });
      if (!res.ok) throw new Error();
      setVerificationCode(['', '', '', '', '', '']); setMessage('New verification code sent! Check your email.');
    } catch { setError('Failed to resend code. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8"><h1 className="text-4xl font-extrabold mb-2"><span className="text-white">oh</span><span className="text-blue-400">Yaaa</span></h1></div>
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Verify Your Email</h3>
            <p className="text-slate-400 mb-2">We sent a 6-digit code to</p>
            <p className="text-white font-medium mb-6">{user.email}</p>
            {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>}
            {message && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">{message}</div>}
            <div className="flex justify-center gap-2 mb-6">
              {verificationCode.map((digit, i) => (
                <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={6} value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={(e) => { e.preventDefault(); handleCodeChange(i, e.clipboardData.getData('text')); }}
                  className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
              ))}
            </div>
            <p className="text-sm text-slate-500 mb-6">Code expires in 10 minutes</p>
            <div className="space-y-3">
              <button onClick={handleVerify} disabled={loading || verificationCode.join('').length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
                {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</> : <>Verify Email<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></>}
              </button>
              <button onClick={handleResend} disabled={loading} className="w-full py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-medium hover:bg-white/10 transition-all disabled:opacity-50">{loading ? 'Sending...' : 'Resend Code'}</button>
              <button onClick={() => auth.signOut()} className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">Sign out and use a different account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// AUTH SCREEN (Login / Signup / Reset)
// =============================================================================
export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState('trader');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const validatePassword = (pwd) => {
    const r = { length: pwd.length >= 8, uppercase: /[A-Z]/.test(pwd), lowercase: /[a-z]/.test(pwd), number: /[0-9]/.test(pwd), special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd) };
    const passed = Object.values(r).filter(Boolean).length;
    return { requirements: r, passed, isValid: passed >= 4 && r.length };
  };

  const pv = validatePassword(password);

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await auth.signInWithEmailAndPassword(email, password); }
    catch (err) { setError(getAuthErrorMessage(err.code)); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!pv.isValid) { setError('Password does not meet complexity requirements'); return; }
    if (!displayName.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const user = cred.user;
      await user.updateProfile({ displayName: displayName.trim() });
      await db.collection('users').doc(user.uid).set({ email: user.email, displayName: displayName.trim(), role: accountType, emailVerified: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      await db.collection('users').doc(user.uid).collection('journalData').doc('state').set({ trades: [], setups: [], mistakes: [], dailyNotes: {}, yearlyGoal: null, challenges: [] });
      if (accountType === 'mentor') await db.collection('mentorships').doc(user.uid).set({ mentorName: displayName.trim(), mentorEmail: user.email });
      await fetch(`${FUNCTIONS_BASE}/sendVerificationCode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, displayName: displayName.trim(), uid: user.uid }) });
    } catch (err) { setError(getAuthErrorMessage(err.code) || err.message); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try { await auth.sendPasswordResetEmail(email); setMessage('Password reset email sent! Check your inbox.'); }
    catch (err) { setError(getAuthErrorMessage(err.code)); }
    finally { setLoading(false); }
  };

  const switchMode = (m) => { setMode(m); setError(''); setMessage(''); };

  const inputCls = "w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all";
  const EmailIcon = () => <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
  const LockIcon = () => <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
  const Spinner = () => <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <svg viewBox="0 0 280 70" fill="none" className="w-64 h-16 mx-auto drop-shadow-2xl cursor-pointer" onClick={() => window.location.href = '/landing.html'}>
              <style>{`@keyframes floatC { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-15px)} }`}</style>
              {[{x:20,d:0,green:true},{x:42,d:.5,green:false},{x:64,d:1,green:true}].map(({x,d,green},i) => (
                <g key={i} style={{ animation: `floatC 3s ease-in-out ${d}s infinite` }}>
                  <line x1={x} y1={i===0?10:i===1?22:5} x2={x} y2={i===0?55:i===1?62:48} stroke={green?'#22c55e':'#ef4444'} strokeWidth="3"/>
                  <rect x={x-7} y={i===0?20:i===1?32:12} width="14" height={i===0?22:i===1?20:18} fill={green?'#22c55e':'#ef4444'} rx="2"/>
                </g>
              ))}
              <path d="M13 52 L35 38 L57 44 L75 30 L90 18" stroke="rgba(34,197,94,0.3)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M13 52 L35 38 L57 44 L75 30 L90 18" stroke="url(#hg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M82 18 L90 18 L90 26" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <text x="105" y="48" fontFamily="system-ui, -apple-system, sans-serif" fontSize="38" fontWeight="800" letterSpacing="-1">
                <tspan fill="white">oh</tspan><tspan fill="#60a5fa">Yaaa</tspan>
              </text>
              <defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
            </svg>
            <p className="text-slate-400 mt-3 text-lg">Your trading journey starts here</p>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {(mode === 'login' || mode === 'signup') && (
              <div className="flex border-b border-white/10">
                {[['login','Sign In'],['signup','Create Account']].map(([m, lbl]) => (
                  <button key={m} onClick={() => switchMode(m)} className={`flex-1 py-4 text-sm font-semibold transition-all ${mode === m ? 'text-white bg-white/10 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>{lbl}</button>
                ))}
              </div>
            )}
            {mode === 'reset' && (
              <div className="px-8 pt-6 pb-2">
                <button onClick={() => switchMode('login')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  Back to sign in
                </button>
                <h2 className="text-xl font-bold text-white mt-4">Reset Password</h2>
                <p className="text-slate-400 text-sm mt-1">Enter your email to receive a reset link</p>
              </div>
            )}

            <div className="p-8">
              {error && <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-center gap-3"><svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
              {message && <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm flex items-center gap-3"><svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>{message}</div>}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><EmailIcon /></div>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><LockIcon /></div>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" required />
                    </div>
                  </div>
                  <div className="flex justify-end"><button type="button" onClick={() => switchMode('reset')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</button></div>
                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                    {loading ? <><Spinner />Signing in...</> : <>Sign In<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></>}
                  </button>
                </form>
              )}

              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>
                      <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} placeholder="John Doe" required />
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><EmailIcon /></div>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${password && !pv.isValid ? 'border-amber-500/50' : 'border-white/10'}`} placeholder="••••••••" required />
                    </div>
                    <div><label className="block text-sm font-medium text-slate-300 mb-2">Confirm</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-white/10'}`} placeholder="••••••••" required />
                    </div>
                  </div>
                  {password && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400">Password Strength</span>
                        <span className={`text-xs font-semibold ${pv.passed >= 4 ? 'text-emerald-400' : pv.passed >= 2 ? 'text-amber-400' : 'text-red-400'}`}>{pv.passed >= 4 ? 'Strong' : pv.passed >= 2 ? 'Medium' : 'Weak'}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3"><div className={`h-full transition-all duration-300 ${pv.passed >= 4 ? 'bg-emerald-500' : pv.passed >= 2 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(pv.passed / 5) * 100}%` }} /></div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[['length','8+ characters'],['uppercase','Uppercase'],['lowercase','Lowercase'],['number','Number'],['special','Special char']].map(([k,lbl]) => (
                          <div key={k} className={`flex items-center gap-1.5 text-xs ${pv.requirements[k] ? 'text-emerald-400' : 'text-slate-500'}`}>{pv.requirements[k] ? '✓' : '○'} {lbl}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {confirmPassword && password !== confirmPassword && <p className="text-red-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Passwords do not match</p>}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">I am a...</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[['trader','📈','Trader','Track & improve'],['mentor','🎯','Mentor','Guide students']].map(([type, icon, lbl, sub]) => (
                        <button key={type} type="button" onClick={() => setAccountType(type)}
                          className={`p-4 rounded-xl border-2 transition-all ${accountType === type ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'}`}>
                          <div className="text-3xl mb-2">{icon}</div><div className="font-semibold">{lbl}</div><div className="text-xs opacity-70 mt-1">{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !pv.isValid || password !== confirmPassword}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 mt-2">
                    {loading ? <><Spinner />Creating account...</> : <>Get Started<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></>}
                  </button>
                </form>
              )}

              {mode === 'reset' && (
                <form onSubmit={handleReset} className="space-y-5">
                  <div><label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><EmailIcon /></div>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" required />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                    {loading ? <><Spinner />Sending...</> : <>Send Reset Link<EmailIcon /></>}
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="text-center mt-8"><p className="text-slate-500 text-sm">Track trades • Analyze performance • Grow profits</p></div>
        </div>
      </div>
    </div>
  );
}
