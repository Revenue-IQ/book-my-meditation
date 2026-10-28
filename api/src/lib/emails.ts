// Email content for the four Phase 5 types. Pure functions — no DB, no transport — so
// wording and time formatting are unit-testable. Every sitting time is worded in the
// preceptor's HOME timezone with the zone label printed (emails are frozen text and can't
// adapt to the reader the way the browser-local web app does).
import { fmtInZone } from './tz.js';

export type EmailContent = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Shared shell: a plain centered card. Button links are repeated as plain URLs in the text part. */
function layout(bodyHtml: string, appUrl: string | undefined): string {
  const home = appUrl
    ? `<p style="margin:24px 0 0;font-size:13px;color:#78716c;">Manage your sittings any time at <a href="${esc(appUrl)}" style="color:#047857;">${esc(appUrl)}</a>. Times above are in the preceptor's home timezone.</p>`
    : `<p style="margin:24px 0 0;font-size:13px;color:#78716c;">Times above are in the preceptor's home timezone.</p>`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:24px;">
<p style="margin:0 0 16px;font-weight:600;color:#047857;">Heartfulness Sittings</p>
${bodyHtml}
${home}
</div></body></html>`;
}

const button = (href: string, label: string, solid: boolean) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;${
    solid ? 'background:#047857;color:#ffffff;' : 'border:1px solid #d6d3d1;color:#1c1917;'
  }">${esc(label)}</a>`;

type SlotLine = { startAt: Date; durationMinutes: number };
const slotLine = (s: SlotLine, tz: string) => `${fmtInZone(s.startAt, tz)} · ${s.durationMinutes} min`;

// ---- 1. New-slots announcement ----

export function announcementEmail(p: { preceptorName: string; timeZone: string; slots: SlotLine[]; appUrl?: string }): EmailContent {
  const many = p.slots.length > 1;
  const lines = p.slots.map((s) => slotLine(s, p.timeZone));
  return {
    subject: many ? `${p.preceptorName} added ${p.slots.length} new sitting slots` : `${p.preceptorName} added a new sitting slot`,
    text: `${p.preceptorName} has new ${many ? 'slots' : 'a new slot'} you can book:\n\n${lines.map((l) => `  • ${l}`).join('\n')}\n\nBook in the app${p.appUrl ? `: ${p.appUrl}` : '.'}\n`,
    html: layout(
      `<p style="margin:0 0 12px;">${esc(p.preceptorName)} has new ${many ? 'slots' : 'a slot'} you can book:</p>
<ul style="margin:0 0 16px;padding-left:20px;">${lines.map((l) => `<li style="margin:4px 0;">${esc(l)}</li>`).join('')}</ul>
${p.appUrl ? button(p.appUrl, 'Book a slot', true) : ''}`,
      p.appUrl,
    ),
  };
}

// ---- 2. Booking confirmed ----

export function bookingConfirmedToAbhyasi(p: {
  preceptorName: string;
  slot: SlotLine;
  timeZone: string;
  /** True when the preceptor pre-booked this for them (worded accordingly). */
  prebooked: boolean;
  appUrl?: string;
}): EmailContent {
  const when = slotLine(p.slot, p.timeZone);
  const lead = p.prebooked
    ? `${p.preceptorName} booked a sitting for you:`
    : `Your sitting with ${p.preceptorName} is booked:`;
  return {
    subject: `Sitting booked: ${fmtInZone(p.slot.startAt, p.timeZone)}`,
    text: `${lead}\n\n  ${when}\n\nYou can cancel any time in the app${p.appUrl ? `: ${p.appUrl}` : '.'}\n`,
    html: layout(
      `<p style="margin:0 0 12px;">${esc(lead)}</p><p style="margin:0 0 16px;font-size:17px;font-weight:600;">${esc(when)}</p>
${p.appUrl ? button(p.appUrl, 'View my sittings', true) : ''}`,
      p.appUrl,
    ),
  };
}

export function bookingConfirmedToPreceptor(p: { abhyasiName: string; slot: SlotLine; timeZone: string; appUrl?: string }): EmailContent {
  const when = slotLine(p.slot, p.timeZone);
  return {
    subject: `${p.abhyasiName} booked your ${fmtInZone(p.slot.startAt, p.timeZone)} slot`,
    text: `${p.abhyasiName} booked a sitting with you:\n\n  ${when}\n`,
    html: layout(
      `<p style="margin:0 0 12px;">${esc(p.abhyasiName)} booked a sitting with you:</p><p style="margin:0;font-size:17px;font-weight:600;">${esc(when)}</p>`,
      p.appUrl,
    ),
  };
}

// ---- 3. Booking cancelled ----

export function bookingCancelledToAbhyasi(p: { preceptorName: string; slot: SlotLine; timeZone: string; appUrl?: string }): EmailContent {
  const when = slotLine(p.slot, p.timeZone);
  return {
    subject: `Sitting cancelled: ${fmtInZone(p.slot.startAt, p.timeZone)}`,
    text: `${p.preceptorName} cancelled your sitting:\n\n  ${when}\n\nYou can book another slot in the app${p.appUrl ? `: ${p.appUrl}` : '.'}\n`,
    html: layout(
      `<p style="margin:0 0 12px;">${esc(p.preceptorName)} cancelled your sitting:</p><p style="margin:0 0 16px;font-size:17px;font-weight:600;text-decoration:line-through;color:#78716c;">${esc(when)}</p>
${p.appUrl ? button(p.appUrl, 'Book another slot', true) : ''}`,
      p.appUrl,
    ),
  };
}

export function bookingCancelledToPreceptor(p: { abhyasiName: string; slot: SlotLine; timeZone: string; appUrl?: string }): EmailContent {
  const when = slotLine(p.slot, p.timeZone);
  return {
    subject: `${p.abhyasiName} cancelled: ${fmtInZone(p.slot.startAt, p.timeZone)}`,
    text: `${p.abhyasiName} cancelled their booking:\n\n  ${when}\n\nThe spot is open for others again.\n`,
    html: layout(
      `<p style="margin:0 0 12px;">${esc(p.abhyasiName)} cancelled their booking:</p><p style="margin:0 0 8px;font-size:17px;font-weight:600;text-decoration:line-through;color:#78716c;">${esc(when)}</p>
<p style="margin:0;font-size:14px;color:#57534e;">The spot is open for others again.</p>`,
      p.appUrl,
    ),
  };
}

// ---- 4. Reminder (with one-click actions) ----

export function reminderEmail(p: {
  preceptorName: string;
  slot: SlotLine;
  timeZone: string;
  confirmUrl: string;
  cancelUrl: string;
  appUrl?: string;
}): EmailContent {
  const when = slotLine(p.slot, p.timeZone);
  const hours = Math.max(1, Math.round((p.slot.startAt.getTime() - Date.now()) / 3600000));
  const inAbout = `in about ${hours} hour${hours === 1 ? '' : 's'}`;
  return {
    subject: `Reminder: your sitting with ${p.preceptorName} is ${inAbout}`,
    text: `Your sitting with ${p.preceptorName} is ${inAbout}:\n\n  ${when}\n\nAre you coming? One click, no login needed:\n\n  I'm coming:        ${p.confirmUrl}\n  Cancel my booking: ${p.cancelUrl}\n`,
    html: layout(
      `<p style="margin:0 0 12px;">Your sitting with ${esc(p.preceptorName)} is <strong>${inAbout}</strong>:</p>
<p style="margin:0 0 16px;font-size:17px;font-weight:600;">${esc(when)}</p>
<p style="margin:0 0 8px;">Are you coming? One click, no login needed:</p>
<p style="margin:0;">${button(p.confirmUrl, "I'm coming", true)}${button(p.cancelUrl, 'Cancel my booking', false)}</p>`,
      p.appUrl,
    ),
  };
}
