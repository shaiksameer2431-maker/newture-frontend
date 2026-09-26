/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Save, Settings2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useToast } from './Toast';

type Settings = {
  notificationEmail: string;
  gmailEmail: string;
  gmailAppPassword: string;
  notifyAdminOnTicket: boolean;
  sendStudentAcknowledgement: boolean;
  sendStudentReplyNotifications: boolean;
  gmailConfigured: boolean;
};

const defaults: Settings = {
  notificationEmail: '',
  gmailEmail: '',
  gmailAppPassword: '',
  notifyAdminOnTicket: true,
  sendStudentAcknowledgement: true,
  sendStudentReplyNotifications: true,
  gmailConfigured: false
};

export default function NotificationSettings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/settings').then(async response => {
      if (!response.ok) throw new Error('Unable to load notification settings');
      const data = await response.json();
      setSettings({ 
        ...defaults, 
        ...data,
        gmailAppPassword: '' // Never load existing password
      });
    }).catch(error => showToast(error.message, 'error')).finally(() => setLoading(false));
  }, [showToast]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (settings.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.notificationEmail)) {
      showToast('Enter a valid notification email address.', 'error');
      return;
    }
    if (settings.gmailEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.gmailEmail)) {
      showToast('Enter a valid Gmail address.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        notificationEmail: settings.notificationEmail,
        gmailEmail: settings.gmailEmail,
        notifyAdminOnTicket: Boolean(settings.notifyAdminOnTicket),
        sendStudentAcknowledgement: Boolean(settings.sendStudentAcknowledgement),
        sendStudentReplyNotifications: Boolean(settings.sendStudentReplyNotifications)
      };

      // Only include password if provided
      if (settings.gmailAppPassword) {
        payload.gmailAppPassword = settings.gmailAppPassword;
      }

      const response = await apiFetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save notification settings');
      setSettings(current => ({ 
        ...current, 
        gmailConfigured: result.gmailConfigured,
        gmailAppPassword: '' // Clear password after save
      }));
      showToast('Notification settings saved successfully.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Unable to save notification settings', 'error');
    } finally { setSaving(false); }
  };

  return (
    <section className="w-full space-y-5" aria-labelledby="notification-settings-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-300">
            <Settings2 className="h-5 w-5" />
          </span>
          <div>
            <h2 id="notification-settings-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
              Email Notification Settings
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Configure Gmail credentials for sending emails and choose notification preferences.
            </p>
          </div>
        </div>
      </header>
      
      <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Mail className="h-3.5 w-3.5" />
              Notification email
            </span>
            <input 
              type="email" 
              value={settings.notificationEmail} 
              onChange={event => setSettings(current => ({ ...current, notificationEmail: event.target.value }))} 
              placeholder="admin@college.edu" 
              className="nexa-focus w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" 
              disabled={loading} 
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              This email receives admin notifications for new tickets and queries.
            </p>
          </label>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Mail className="h-3.5 w-3.5" />
              Gmail Email Address
            </span>
            <input 
              type="email" 
              value={settings.gmailEmail} 
              onChange={event => setSettings(current => ({ ...current, gmailEmail: event.target.value }))} 
              placeholder="yourgmail@gmail.com" 
              className="nexa-focus w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" 
              disabled={loading} 
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              Gmail App Password
            </span>
            <input 
              type="password" 
              value={settings.gmailAppPassword} 
              onChange={event => setSettings(current => ({ ...current, gmailAppPassword: event.target.value }))} 
              placeholder={settings.gmailConfigured ? '••••••••••••••••' : 'Enter Gmail App Password'} 
              className="nexa-focus w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white" 
              disabled={loading} 
              autoComplete="new-password"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Account Settings</a>. Leave blank to keep existing password.
            </p>
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Email events
          </legend>
          {([
            ['notifyAdminOnTicket', 'Notify this email when a student creates a ticket'],
            ['sendStudentAcknowledgement', 'Send acknowledgement emails to students'],
            ['sendStudentReplyNotifications', 'Send ticket reply and status notifications to students']
          ] as [keyof Settings, string][]).map(([key, label]) => (
            <label 
              key={key} 
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <input 
                type="checkbox" 
                checked={Boolean(settings[key])} 
                onChange={event => setSettings(current => ({ ...current, [key]: event.target.checked }))} 
                className="h-4 w-4 rounded border-slate-300 accent-blue-600" 
                disabled={loading} 
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-bold ${
          settings.gmailConfigured 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' 
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
        }`}>
          <CheckCircle2 className="h-4 w-4" />
          {settings.gmailConfigured 
            ? 'Gmail configured and ready to send emails.' 
            : 'Gmail not configured. Enter Gmail Email and App Password above.'
          }
        </div>

        {settings.gmailConfigured && (
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={async () => {
                setSaving(true);
                try {
                  const response = await apiFetch('/api/admin/settings/test-gmail', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      gmailEmail: settings.gmailEmail,
                      gmailAppPassword: settings.gmailAppPassword || undefined
                    })
                  });
                  const data = await response.json();
                  if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Gmail connection test failed');
                  }
                  showToast('Gmail connection test successful.', 'success');
                } catch (err: any) {
                  showToast(err.message || 'Gmail connection test failed', 'error');
                } finally { 
                  setSaving(false); 
                }
              }} 
              className="nexa-focus inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              disabled={loading || saving}
            >
              Test Gmail Connection
            </button>

            <button 
              type="button" 
              onClick={async () => {
                const to = prompt('Enter an email address to receive a test message');
                if (!to) return;
                setSaving(true);
                try {
                  const response = await apiFetch('/api/admin/settings/send-test-email', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ to }) 
                  });
                  const data = await response.json();
                  if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Send test email failed');
                  }
                  showToast('Test email sent successfully.', 'success');
                } catch (err: any) {
                  showToast(err.message || 'Send test email failed', 'error');
                } finally { 
                  setSaving(false); 
                }
              }} 
              className="nexa-focus inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={loading || saving}
            >
              Send Test Email
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={loading || saving} 
            className="nexa-focus inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </section>
  );
}
