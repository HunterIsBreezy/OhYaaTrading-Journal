const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const RESEND_API_KEY = "re_2zJJCrTD_8dBRRAZSbEKHVeaCUAnRzKFq";
const EMAIL_FROM = "ohYaaa Trading Journal <noreply@noti.ohyaatradingjournal.com>";

// Helper to send email via Resend
const sendEmailViaResend = async (to, subject, html) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: to,
      subject: subject,
      html: html,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("Resend API error:", result);
    throw new Error("Failed to send email");
  }
  return result;
};

// Helper to calculate trade P&L
const calcTradePnL = (trade) => {
  if (!trade.entryPrice || !trade.shares) return 0;
  const exitPrice = trade.exitPrice || trade.entryPrice;
  const direction = trade.positionType === "short" || trade.positionType === "short_scalp" ? -1 : 1;
  const grossPnL = (exitPrice - trade.entryPrice) * trade.shares * direction;
  const fees = (trade.entryFees || 0) + (trade.exitFees || 0);
  return grossPnL - fees;
};

// Helper to format currency
const formatCurrency = (amount) => {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

// Test function to manually trigger monthly report (bypasses date check)
exports.testMonthlyReport = onRequest({
  cors: true,
}, async (req, res) => {
  console.log("Running TEST monthly report...");

  try {
    const usersSnapshot = await db.collection("users").get();
    let emailsSent = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.email) continue;

      const journalDoc = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("journalData")
        .doc("state")
        .get();

      if (!journalDoc.exists) continue;
      const journalData = journalDoc.data();
      if (!journalData.trades || journalData.trades.length === 0) continue;

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const monthTrades = journalData.trades.filter((t) => {
        return t.entryDate >= monthStartStr && t.entryDate <= todayStr;
      });

      if (monthTrades.length === 0) continue;

      let totalPnL = 0;
      let wins = 0;
      let losses = 0;
      const dailyPnL = {};
      const setupPnL = {};

      monthTrades.forEach((trade) => {
        const pnl = calcTradePnL(trade);
        totalPnL += pnl;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        if (!dailyPnL[trade.entryDate]) dailyPnL[trade.entryDate] = 0;
        dailyPnL[trade.entryDate] += pnl;
        if (trade.setupId) {
          if (!setupPnL[trade.setupId]) setupPnL[trade.setupId] = 0;
          setupPnL[trade.setupId] += pnl;
        }
      });

      const tradingDays = Object.keys(dailyPnL).length;
      const dailyValues = Object.values(dailyPnL);
      const bestDay = Math.max(...dailyValues, 0);
      const worstDay = Math.min(...dailyValues, 0);
      const avgPerDay = tradingDays > 0 ? totalPnL / tradingDays : 0;
      const winRate = monthTrades.length > 0 ? Math.round((wins / monthTrades.length) * 100) : 0;

      let topSetup = null;
      let topSetupPnL = 0;
      Object.entries(setupPnL).forEach(([setupId, pnl]) => {
        if (pnl > topSetupPnL) {
          topSetupPnL = pnl;
          const setup = journalData.setups?.find((s) => s.id === setupId);
          topSetup = setup ? setup.name : null;
        }
      });

      const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];

      let goalProgress = 0;
      if (journalData.yearlyGoal?.target) {
        const yearStart = `${today.getFullYear()}-01-01`;
        const yearTrades = journalData.trades.filter((t) => t.entryDate >= yearStart);
        const yearPnL = yearTrades.reduce((sum, t) => sum + calcTradePnL(t), 0);
        goalProgress = Math.round((yearPnL / journalData.yearlyGoal.target) * 100);
      }

      const stats = {
        monthName: monthNames[today.getMonth()],
        totalPnL, totalTrades: monthTrades.length, wins, losses, winRate,
        tradingDays, bestDay, worstDay, avgPerDay, topSetup,
        yearlyGoal: journalData.yearlyGoal?.target || null, goalProgress,
      };

      const html = generateMonthlyReportHtml(userData.displayName, stats);

      try {
        await sendEmailViaResend(
          userData.email,
          `📈 Your ${stats.monthName} Trading Report - ${totalPnL >= 0 ? "+" : ""}${formatCurrency(totalPnL)}`,
          html
        );
        console.log(`Monthly report sent to ${userData.email}`);
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send monthly report to ${userData.email}:`, emailError);
      }
    }
    
    res.status(200).json({ success: true, emailsSent });
  } catch (error) {
    console.error("Monthly report error:", error);
    res.status(500).json({ error: "Failed to send monthly reports" });
  }
});

// HTTP function to send emails with CORS support
exports.sendEmail = onRequest({
  cors: true,
}, async (req, res) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    res.status(400).json({ error: "Missing required fields: to, subject, html" });
    return;
  }

  try {
    const result = await sendEmailViaResend(to, subject, html);
    console.log("Email sent successfully to:", to);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// Weekly Recap - Runs every Friday at 1 PM EST
exports.sendWeeklyRecap = onSchedule({
  schedule: "0 13 * * 5",
  timeZone: "America/New_York",
}, async (event) => {
  console.log("Running weekly recap emails...");

  try {
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.email) continue;

      const journalDoc = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("journalData")
        .doc("state")
        .get();

      if (!journalDoc.exists) continue;
      const journalData = journalDoc.data();
      if (!journalData.trades || journalData.trades.length === 0) continue;

      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      
      const mondayStr = monday.toISOString().split("T")[0];
      const fridayStr = today.toISOString().split("T")[0];

      const weekTrades = journalData.trades.filter((t) => {
        return t.entryDate >= mondayStr && t.entryDate <= fridayStr;
      });

      if (weekTrades.length === 0) continue;

      let totalPnL = 0;
      let wins = 0;
      let losses = 0;
      let bestTrade = 0;

      weekTrades.forEach((trade) => {
        const pnl = calcTradePnL(trade);
        totalPnL += pnl;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        if (pnl > bestTrade) bestTrade = pnl;
      });

      const winRate = weekTrades.length > 0 ? Math.round((wins / weekTrades.length) * 100) : 0;
      const stats = { totalPnL, totalTrades: weekTrades.length, wins, losses, winRate, bestTrade };
      const html = generateWeeklyRecapHtml(userData.displayName, stats);

      try {
        await sendEmailViaResend(
          userData.email,
          `📊 Your Weekly Trading Recap - ${totalPnL >= 0 ? "+" : ""}${formatCurrency(totalPnL)}`,
          html
        );
        console.log(`Weekly recap sent to ${userData.email}`);
      } catch (emailError) {
        console.error(`Failed to send weekly recap to ${userData.email}:`, emailError);
      }
    }
    return null;
  } catch (error) {
    console.error("Weekly recap error:", error);
    return null;
  }
});

// Monthly Report - Runs on the last day of each month at 5 PM EST
exports.sendMonthlyReport = onSchedule({
  schedule: "0 17 28-31 * *",
  timeZone: "America/New_York",
}, async (event) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (tomorrow.getDate() !== 1) {
    console.log("Not the last day of the month, skipping...");
    return null;
  }
  
  console.log("Running monthly report emails...");

  try {
    const usersSnapshot = await db.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.email) continue;

      const journalDoc = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("journalData")
        .doc("state")
        .get();

      if (!journalDoc.exists) continue;
      const journalData = journalDoc.data();
      if (!journalData.trades || journalData.trades.length === 0) continue;

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const monthTrades = journalData.trades.filter((t) => {
        return t.entryDate >= monthStartStr && t.entryDate <= todayStr;
      });

      if (monthTrades.length === 0) continue;

      let totalPnL = 0;
      let wins = 0;
      let losses = 0;
      const dailyPnL = {};
      const setupPnL = {};

      monthTrades.forEach((trade) => {
        const pnl = calcTradePnL(trade);
        totalPnL += pnl;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        if (!dailyPnL[trade.entryDate]) dailyPnL[trade.entryDate] = 0;
        dailyPnL[trade.entryDate] += pnl;
        if (trade.setupId) {
          if (!setupPnL[trade.setupId]) setupPnL[trade.setupId] = 0;
          setupPnL[trade.setupId] += pnl;
        }
      });

      const tradingDays = Object.keys(dailyPnL).length;
      const dailyValues = Object.values(dailyPnL);
      const bestDay = Math.max(...dailyValues, 0);
      const worstDay = Math.min(...dailyValues, 0);
      const avgPerDay = tradingDays > 0 ? totalPnL / tradingDays : 0;
      const winRate = monthTrades.length > 0 ? Math.round((wins / monthTrades.length) * 100) : 0;

      let topSetup = null;
      let topSetupPnL = 0;
      Object.entries(setupPnL).forEach(([setupId, pnl]) => {
        if (pnl > topSetupPnL) {
          topSetupPnL = pnl;
          const setup = journalData.setups?.find((s) => s.id === setupId);
          topSetup = setup ? setup.name : null;
        }
      });

      const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];

      let goalProgress = 0;
      if (journalData.yearlyGoal?.target) {
        const yearStart = `${today.getFullYear()}-01-01`;
        const yearTrades = journalData.trades.filter((t) => t.entryDate >= yearStart);
        const yearPnL = yearTrades.reduce((sum, t) => sum + calcTradePnL(t), 0);
        goalProgress = Math.round((yearPnL / journalData.yearlyGoal.target) * 100);
      }

      const stats = {
        monthName: monthNames[today.getMonth()],
        totalPnL, totalTrades: monthTrades.length, wins, losses, winRate,
        tradingDays, bestDay, worstDay, avgPerDay, topSetup,
        yearlyGoal: journalData.yearlyGoal?.target || null, goalProgress,
      };

      const html = generateMonthlyReportHtml(userData.displayName, stats);

      try {
        await sendEmailViaResend(
          userData.email,
          `📈 Your ${stats.monthName} Trading Report - ${totalPnL >= 0 ? "+" : ""}${formatCurrency(totalPnL)}`,
          html
        );
        console.log(`Monthly report sent to ${userData.email}`);
      } catch (emailError) {
        console.error(`Failed to send monthly report to ${userData.email}:`, emailError);
      }
    }
    return null;
  } catch (error) {
    console.error("Monthly report error:", error);
    return null;
  }
});

function generateWeeklyRecapHtml(userName, stats) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1e40af; margin: 0;"><span style="color: #111827;">oh</span><span style="color: #2563eb;">Yaaa</span></h1>
      </div>
      <h2 style="color: #1f2937; text-align: center;">Weekly Trading Recap 📊</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
        Hey ${userName}, here's how your week went!
      </p>
      <div style="background: ${stats.totalPnL >= 0 ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px 0; font-size: 14px;">Week's P&L</p>
        <p style="color: white; font-size: 36px; font-weight: bold; margin: 0;">${stats.totalPnL >= 0 ? "+" : ""}${formatCurrency(stats.totalPnL)}</p>
      </div>
      <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Total Trades</p><p style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0;">${stats.totalTrades}</p></div></td>
          <td style="width: 50%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Win Rate</p><p style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0;">${stats.winRate}%</p></div></td>
        </tr>
        <tr>
          <td style="width: 50%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Wins / Losses</p><p style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0;"><span style="color: #059669;">${stats.wins}W</span> / <span style="color: #dc2626;">${stats.losses}L</span></p></div></td>
          <td style="width: 50%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Best Trade</p><p style="color: #059669; font-size: 24px; font-weight: bold; margin: 0;">+${formatCurrency(stats.bestTrade)}</p></div></td>
        </tr>
      </table>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://ohyaatradingjournal.com" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Full Report</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Trading Journal. All rights reserved.</p>
    </div>
  `;
}

function generateMonthlyReportHtml(userName, stats) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1e40af; margin: 0;"><span style="color: #111827;">oh</span><span style="color: #2563eb;">Yaaa</span></h1>
      </div>
      <h2 style="color: #1f2937; text-align: center;">${stats.monthName} Performance Report 📈</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
        Hey ${userName}, here's your monthly breakdown!
      </p>
      <div style="background: ${stats.totalPnL >= 0 ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px 0; font-size: 14px;">${stats.monthName} P&L</p>
        <p style="color: white; font-size: 36px; font-weight: bold; margin: 0;">${stats.totalPnL >= 0 ? "+" : ""}${formatCurrency(stats.totalPnL)}</p>
        ${stats.yearlyGoal ? `<p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">${stats.goalProgress}% of yearly goal</p>` : ""}
      </div>
      <table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
        <tr>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Total Trades</p><p style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0;">${stats.totalTrades}</p></div></td>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Win Rate</p><p style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0;">${stats.winRate}%</p></div></td>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Trading Days</p><p style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0;">${stats.tradingDays}</p></div></td>
        </tr>
        <tr>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Best Day</p><p style="color: #059669; font-size: 20px; font-weight: bold; margin: 0;">+${formatCurrency(stats.bestDay)}</p></div></td>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Worst Day</p><p style="color: #dc2626; font-size: 20px; font-weight: bold; margin: 0;">${formatCurrency(stats.worstDay)}</p></div></td>
          <td style="width: 33%; padding: 8px;"><div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;"><p style="color: #6b7280; margin: 0 0 4px 0; font-size: 12px;">Avg/Day</p><p style="color: ${stats.avgPerDay >= 0 ? "#059669" : "#dc2626"}; font-size: 20px; font-weight: bold; margin: 0;">${stats.avgPerDay >= 0 ? "+" : ""}${formatCurrency(stats.avgPerDay)}</p></div></td>
        </tr>
      </table>
      ${stats.topSetup ? `<div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 24px 0;"><p style="color: #1e40af; margin: 0; font-weight: bold;">🏆 Top Performing Setup: ${stats.topSetup}</p></div>` : ""}
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://ohyaatradingjournal.com" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Full Report</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Trading Journal. All rights reserved.</p>
    </div>
  `;
}
