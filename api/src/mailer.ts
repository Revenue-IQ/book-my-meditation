// Email transport (Resend). Lives in src/, not src/lib/, because it talks to an external
// service — lib/ stays pure per the tech-stack rule.
//
// Three operating modes, decided by environment:
//   • No RESEND_API_KEY (local dev): the email is printed to the server log instead of
//     sent — local machines stay keyless, and you still see exactly what would go out.
//   • RESEND_API_KEY + EMAIL_REDIRECT_TO (cloud, pre-domain): every email is delivered to
//     that one inbox with the real recipient noted in the subject. Resend without a
//     verified domain can only deliver to the account owner's address anyway.
//   • RESEND_API_KEY alone (cloud, domain verified): normal delivery. Set EMAIL_FROM to
//     the verified-domain sender and remove EMAIL_REDIRECT_TO — no code changes.
import type { EmailContent } from './lib/emails.js';

export type Mail = EmailContent & { to: string };

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email → ${mail.to}] ${mail.subject}\n${mail.text.replace(/^/gm, '    ')}`);
    return;
  }
  const redirect = process.env.EMAIL_REDIRECT_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Heartfulness Sittings <onboarding@resend.dev>',
      to: redirect ?? mail.to,
      subject: redirect ? `[to: ${mail.to}] ${mail.subject}` : mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend refused the email to ${mail.to} (${res.status}): ${await res.text()}`);
}
