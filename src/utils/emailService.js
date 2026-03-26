const CLOUD_FUNCTION_URL =
  'https://us-central1-trading-journal-86e97.cloudfunctions.net/sendEmail';

export async function sendEmail({ to, subject, html }) {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Email send error:', data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

const year = () => new Date().getFullYear();

export const emailTemplates = {
  mentorInvite: (mentorName, studentEmail) => ({
    to: studentEmail,
    subject: `${mentorName} wants to mentor you on Trading Journal`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e40af; margin: 0;"><span style="color: #111827;">oh</span><span style="color: #2563eb;">Yaaa</span></h1>
        </div>
        <h2 style="color: #1f2937;">You've Been Invited!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          <strong>${mentorName}</strong> has invited you to be their student on Trading Journal.
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          As a student, your mentor will be able to view your trading journal to help guide your trading journey.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://ohyaatradingjournal.com"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Log In to Accept
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Log in to your account to accept or decline this invitation.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${year()} Trading Journal. All rights reserved.</p>
      </div>
    `,
  }),

  inviteAccepted: (mentorEmail, studentName) => ({
    to: mentorEmail,
    subject: `${studentName} accepted your mentor invitation!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e40af; margin: 0;"><span style="color: #111827;">oh</span><span style="color: #2563eb;">Yaaa</span></h1>
        </div>
        <h2 style="color: #1f2937;">Great News! 🎉</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          <strong>${studentName}</strong> has accepted your mentor invitation!
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          You can now view their trading journal and help guide their trading journey.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://ohyaatradingjournal.com"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            View Your Students
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${year()} Trading Journal. All rights reserved.</p>
      </div>
    `,
  }),

  welcome: (userEmail, userName) => ({
    to: userEmail,
    subject: `Welcome to Trading Journal, ${userName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1e40af; margin: 0;"><span style="color: #111827;">oh</span><span style="color: #2563eb;">Yaaa</span></h1>
        </div>
        <h2 style="color: #1f2937;">Welcome, ${userName}! 👋</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Thank you for joining Trading Journal. We're excited to help you track and improve your trading performance.
        </p>
        <h3 style="color: #1f2937;">Get Started:</h3>
        <ul style="color: #4b5563; font-size: 16px; line-height: 1.8;">
          <li>📈 Log your first trade</li>
          <li>🎯 Set up your trading setups</li>
          <li>⚠️ Track your common mistakes</li>
          <li>🏆 Set yearly goals and challenges</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://ohyaatradingjournal.com"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Start Trading Journal
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${year()} Trading Journal. All rights reserved.</p>
      </div>
    `,
  }),

  dailyTargetHit: (userEmail, userName, dailyPnL, dailyTarget) => ({
    to: userEmail,
    subject: `🎯 Daily Target Hit! +${dailyPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; text-align: center;">Daily Target Hit!</h2>
        <p style="color: #4b5563;">Hey ${userName}, you hit your daily target of ${dailyTarget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} today!</p>
        <p style="color: #4b5563;">Today's P&L: <strong style="color: #059669;">${dailyPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://ohyaatradingjournal.com"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            View Full Report
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${year()} Trading Journal. All rights reserved.</p>
      </div>
    `,
  }),

  monthlyReport: (userEmail, userName, stats) => ({
    to: userEmail,
    subject: `📈 Your ${stats.monthName} Trading Report - ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1f2937; text-align: center;">${stats.monthName} Performance Report 📈</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">Hey ${userName}, here's your monthly breakdown!</p>
        <div style="background: ${stats.totalPnL >= 0 ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px 0; font-size: 14px;">${stats.monthName} P&L</p>
          <p style="color: white; font-size: 36px; font-weight: bold; margin: 0;">${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          ${stats.yearlyGoal ? `<p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">${stats.goalProgress}% of yearly goal</p>` : ''}
        </div>
        ${stats.topSetup ? `<div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;"><p style="color: #1e40af; margin: 0; font-weight: bold;">🏆 Top Performing Setup: ${stats.topSetup}</p></div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://ohyaatradingjournal.com"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            View Full Report
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${year()} Trading Journal. All rights reserved.</p>
      </div>
    `,
  }),
};
