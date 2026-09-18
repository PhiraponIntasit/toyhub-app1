// Emails are mocked: no real send, just logged to the email_log table (and
// console) so the confirmation/tracking timeline in the app is backed by a
// real record instead of a client-side fake. Swap this for a real provider
// (Resend, SendGrid, SMTP via nodemailer) by replacing the body of send().
const { pool } = require('../db');

async function send({ orderRef, kind, to, subject, body }) {
  console.log(`[mock email] to=${to} subject="${subject}"\n${body}\n`);
  const { rows } = await pool.query(
    `INSERT INTO email_log (order_ref, kind, to_email, subject, body) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [orderRef, kind, to, subject, body]
  );
  return rows[0];
}

module.exports = { send };
