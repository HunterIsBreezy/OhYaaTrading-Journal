/**
 * ohYaaa Trading Journal - Firebase Cloud Functions
 * 
 * Includes:
 * - Email sending (registration, mentor invites, daily targets, weekly recaps, monthly reports)
 * - In-app notifications for all email events
 * - Session reminders (24 hours before)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();
const db = admin.firestore();

// IMPORTANT: Replace with your actual Resend API key
const resend = new Resend("re_abc123xyz789...");  // Your real Resend API key
const FROM_EMAIL = "ohYaaa <noreply@ohyaaa.com>";  // Your real verified domain

// =============================================================================
// HELPER: Create In-App Notification
// =============================================================================
async function createNotification(userId, type, title, message, link = null) {
  try {
    await db.collection('users').doc(userId).collection('notifications').add({
      type, title, message, link,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Notification created for ${userId}: ${type}`);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

// =============================================================================
// HELPER: Send Email via Resend
// =============================================================================
async function sendEmail(to, subject, html) {
  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    console.log(`Email sent to ${to}:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

// =============================================================================
// EMAIL TEMPLATES (simplified for brevity - use your existing templates)
// =============================================================================
const getRegistrationEmailHtml = (name) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">Welcome to <span style="color: #2563eb;">ohYaaa</span>, ${name}! 🎉</h1>
    <p>Your trading journal is ready. Start tracking your trades today.</p>
    <a href="https://ohyaaa.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Open Your Journal</a>
  </div>
`;

const getMentorInviteEmailHtml = (mentorName, menteeEmail) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">You've Been Invited! 👨‍🏫</h1>
    <p><strong>${mentorName}</strong> wants to mentor you on ohYaaa.</p>
    <a href="https://ohyaaa.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Accept Invitation</a>
    <p style="color: #64748b; font-size: 12px;">Log in with ${menteeEmail} to accept.</p>
  </div>
`;

const getInviteAcceptedEmailHtml = (menteeName) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">Great News! 🎉</h1>
    <p><strong>${menteeName}</strong> accepted your mentorship invitation!</p>
    <a href="https://ohyaaa.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Mentee</a>
  </div>
`;

const getDailyTargetEmailHtml = (name, profit, target) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">🎯 Daily Target Achieved!</h1>
    <p>Congratulations ${name}! You made $${profit.toLocaleString()} (target: $${target.toLocaleString()})</p>
  </div>
`;

const getWeeklyRecapEmailHtml = (name, stats, weekStart, weekEnd) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">📊 Weekly Recap</h1>
    <p>${weekStart} - ${weekEnd}</p>
    <p style="font-size: 32px; font-weight: bold; color: ${stats.totalPnL >= 0 ? '#10b981' : '#ef4444'};">
      ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toLocaleString()}
    </p>
    <p>Trades: ${stats.totalTrades} | Win Rate: ${stats.winRate}%</p>
    <a href="https://ohyaaa.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Full Report</a>
  </div>
`;

const getMonthlyReportEmailHtml = (name, stats, monthName, year) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">📈 ${monthName} ${year} Report</h1>
    <p style="font-size: 32px; font-weight: bold; color: ${stats.totalPnL >= 0 ? '#10b981' : '#ef4444'};">
      ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toLocaleString()}
    </p>
    <p>Trades: ${stats.totalTrades} | Win Rate: ${stats.winRate}% | Trading Days: ${stats.tradingDays}</p>
    <a href="https://ohyaaa.com" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Full Report</a>
  </div>
`;

const getSessionReminderEmailHtml = (menteeName, mentorName, sessionDate, topic, videoLink) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="color: #1e293b;">⏰ Session Reminder</h1>
    <p>Your session with <strong>${mentorName}</strong> is tomorrow!</p>
    <p><strong>When:</strong> ${sessionDate}</p>
    <p><strong>Topic:</strong> ${topic}</p>
    ${videoLink ? `<a href="${videoLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Join Video Call</a>` : ''}
  </div>
`;

// =============================================================================
// CALLABLE FUNCTIONS
// =============================================================================

exports.sendRegistrationEmail = onCall(async (request) => {
  const { email, name } = request.data;
  if (!email || !name) throw new HttpsError("invalid-argument", "Email and name required");
  await sendEmail(email, "Welcome to ohYaaa! 🎉", getRegistrationEmailHtml(name));
  return { success: true };
});

exports.sendMentorInviteEmail = onCall(async (request) => {
  const { mentorName, menteeEmail } = request.data;
  if (!mentorName || !menteeEmail) throw new HttpsError("invalid-argument", "Missing params");
  await sendEmail(menteeEmail, `${mentorName} invited you to ohYaaa`, getMentorInviteEmailHtml(mentorName, menteeEmail));
  return { success: true };
});

exports.sendInviteAcceptedEmail = onCall(async (request) => {
  const { mentorEmail, menteeName } = request.data;
  if (!mentorEmail || !menteeName) throw new HttpsError("invalid-argument", "Missing params");
  await sendEmail(mentorEmail, `${menteeName} accepted your invitation!`, getInviteAcceptedEmailHtml(menteeName));
  return { success: true };
});

exports.sendDailyTargetEmail = onCall(async (request) => {
  const { email, name, profit, target } = request.data;
  if (!email || !name || profit === undefined || !target) throw new HttpsError("invalid-argument", "Missing params");
  await sendEmail(email, "🎯 Daily Target Achieved!", getDailyTargetEmailHtml(name, profit, target));
  return { success: true };
});

// =============================================================================
// SCHEDULED: Weekly Recap - Every Friday at 1 PM EST
// =============================================================================
exports.sendWeeklyRecap = onSchedule({
  schedule: "0 13 * * 5",
  timeZone: "America/New_York",
}, async (event) => {
  console.log("Starting weekly recap emails...");
  
  const now = new Date();
  const weekEnd = now.toISOString().split('T')[0];
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    if (!user.email || !user.displayName) continue;
    
    const journalDoc = await db.collection('users').doc(doc.id).collection('journalData').doc('state').get();
    if (!journalDoc.exists) continue;
    
    const trades = journalDoc.data().trades || [];
    const weekTrades = trades.filter(t => t.date >= weekStart && t.date <= weekEnd);
    if (weekTrades.length === 0) continue;
    
    const wins = weekTrades.filter(t => (t.pnl || 0) > 0);
    const losses = weekTrades.filter(t => (t.pnl || 0) < 0);
    const totalPnL = Math.round(weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const stats = {
      totalTrades: weekTrades.length,
      totalPnL,
      winRate: ((wins.length / weekTrades.length) * 100).toFixed(1),
      avgWin: wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0,
      avgLoss: losses.length > 0 ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0,
    };
    
    await sendEmail(user.email, `📊 Weekly Recap: ${weekStart} - ${weekEnd}`, getWeeklyRecapEmailHtml(user.displayName, stats, weekStart, weekEnd));
    await createNotification(doc.id, 'weekly_recap', 'Weekly Recap Ready', `${stats.totalTrades} trades, ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()}`, 'checkins');
    console.log(`Weekly recap sent to ${user.email}`);
  }
});

// =============================================================================
// SCHEDULED: Monthly Report - Last day of month at 5 PM EST
// =============================================================================
exports.sendMonthlyReport = onSchedule({
  schedule: "0 17 28-31 * *",
  timeZone: "America/New_York",
}, async (event) => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (tomorrow.getDate() !== 1) return; // Only run on actual last day
  
  console.log("Starting monthly reports...");
  
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = now.toISOString().split('T')[0];
  
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    if (!user.email || !user.displayName) continue;
    
    const journalDoc = await db.collection('users').doc(doc.id).collection('journalData').doc('state').get();
    if (!journalDoc.exists) continue;
    
    const trades = journalDoc.data().trades || [];
    const monthTrades = trades.filter(t => t.date >= monthStart && t.date <= monthEnd);
    if (monthTrades.length === 0) continue;
    
    const wins = monthTrades.filter(t => (t.pnl || 0) > 0);
    const totalPnL = Math.round(monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const tradingDays = new Set(monthTrades.map(t => t.date)).size;
    
    const stats = {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: ((wins.length / monthTrades.length) * 100).toFixed(1),
      tradingDays,
    };
    
    await sendEmail(user.email, `📈 ${monthName} ${year} Report`, getMonthlyReportEmailHtml(user.displayName, stats, monthName, year));
    await createNotification(doc.id, 'monthly_report', `${monthName} Report Ready`, `${stats.totalTrades} trades, ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toLocaleString()}`, 'dashboard');
    console.log(`Monthly report sent to ${user.email}`);
  }
});

// =============================================================================
// SCHEDULED: Session Reminders - Daily at 9 AM EST
// =============================================================================
exports.sendSessionReminders = onSchedule({
  schedule: "0 9 * * *",
  timeZone: "America/New_York",
}, async (event) => {
  console.log("Checking for upcoming sessions...");
  
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);
  
  // Get all mentees
  const usersSnapshot = await db.collection('users').where('mentorId', '!=', null).get();
  
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    
    const sessionsSnapshot = await db.collection('users').doc(userDoc.id).collection('sessions').where('status', '==', 'confirmed').get();
    
    for (const sessionDoc of sessionsSnapshot.docs) {
      const session = sessionDoc.data();
      if (!session.dateTime) continue;
      
      const sessionDate = session.dateTime.toDate();
      
      // Check if session is tomorrow
      if (sessionDate >= tomorrowStart && sessionDate <= tomorrowEnd) {
        const formattedDate = sessionDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        
        // Email to mentee
        if (user.email) {
          await sendEmail(user.email, `⏰ Session Tomorrow with ${user.mentorName}`, 
            getSessionReminderEmailHtml(user.displayName, user.mentorName, formattedDate, session.topic, session.videoLink));
          console.log(`Session reminder sent to ${user.email}`);
        }
        
        // Notification to mentee
        await createNotification(userDoc.id, 'session_reminder', 'Session Tomorrow!', 
          `${formattedDate} with ${user.mentorName}: ${session.topic}`, 'sessions');
        
        // Notification to mentor
        if (session.scheduledById) {
          await createNotification(session.scheduledById, 'session_reminder', 'Session Tomorrow!', 
            `${formattedDate} with ${user.displayName}: ${session.topic}`, 'mentees');
        }
      }
    }
  }
  console.log("Session reminder check completed");
});
