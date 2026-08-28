/**
 * Email Service (SMTP Mock)
 * Post-migration, email notifications are handled as SQLite notification entries
 * and displayed on the dashboard rather than being dispatched via SMTP.
 */

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[SMTP MOCK] Suppressing outbound email to ${to}. Subject: "${subject}". post-migration notifications are logged directly to SQLite database.`);
  return { messageId: `mock-msg-${Date.now()}` };
}
