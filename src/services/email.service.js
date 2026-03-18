const nodemailer = require('nodemailer');

async function sendMissedPunchInEmail(users) {
  if (!users || users.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const list = users
    .map((u, i) => `${i + 1}. ${u.name} (${u.email})`)
    .join('<br/>');

  const html = `
    <h3>Missed Punch-In Report</h3>
    <p>The following users have not punched in today:</p>
    <br/>
    ${list}
    <br/><br/>
    <small>System generated – Attendance Module</small>
  `;

  for (const u of users) {
  const emailRes = await transporter.sendMail({
    from: `"Attendance System" <${process.env.SMTP_USER}>`,
    to: u.email,
    subject: "Missed Punch-In Alert",
    html: `
      <p>Hi ${u.name},</p>
      <p>You missed today’s punch-in.</p>
      <small>Attendance System</small>
    `
  });
}
  
}

module.exports = { sendMissedPunchInEmail };
