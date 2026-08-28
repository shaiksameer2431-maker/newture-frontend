/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Ticket, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TicketFormProps {
  isDark: boolean;
  onCancel: () => void;
  onSubmitSuccess: (ticketId: string, fullName: string) => void;
  originalQuery?: string;
}

export default function TicketForm({ isDark, onCancel, onSubmitSuccess, originalQuery = '' }: TicketFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(originalQuery);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const countryCodes = ['+91', '+1', '+44', '+61', '+971', '+86', '+81', '+49', '+33', '+39'];

  useEffect(() => {
    if (originalQuery) {
      setMessage(originalQuery);
    }
  }, [originalQuery]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{7,15}$/.test(phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number (7-15 digits)';
    }
    
    if (!message.trim()) {
      newErrors.message = 'Message is required';
    } else if (message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          countryCode,
          phone: phone.trim(),
          message: message.trim(),
          originalQuery: originalQuery || null,
          sourcePage: window.location.pathname
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit ticket');
      }

      const data = await response.json();
      onSubmitSuccess(data.ticketId, data.fullName);
      
      // Reset form
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage(originalQuery || '');
      setErrors({});
      
    } catch (err: any) {
      console.error('Ticket submission error:', err);
      setSubmitError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form state
    setFullName('');
    setEmail('');
    setPhone('');
    setMessage(originalQuery || '');
    setErrors({});
    setSubmitError(null);
    onCancel();
  };

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm ${
    isDark 
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' 
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  const errorClass = 'text-xs text-red-500 mt-1';
  const labelClass = `block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
             Official Support Channel
          </h2>
        </div>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>
      </div>

      {/* Form Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 touch-overflow-scrolling no-scrollbar">
        {submitError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pb-4">
          <div>
            <label className={labelClass}>
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
              }}
              placeholder="Enter your full name"
              className={inputClass}
              disabled={isSubmitting}
            />
            {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="yourname@example.com"
              className={inputClass}
              disabled={isSubmitting}
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Contact Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-100' 
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
                disabled={isSubmitting}
              >
                {countryCodes.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                placeholder="Enter phone number"
                className={inputClass}
                disabled={isSubmitting}
              />
            </div>
            {errors.phone && <p className={errorClass}>{errors.phone}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Your Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (errors.message) setErrors(prev => ({ ...prev, message: '' }));
              }}
              placeholder="Describe your issue or question in detail..."
              rows={4}
              className={`${inputClass} resize-none`}
              disabled={isSubmitting}
            />
            {errors.message && <p className={errorClass}>{errors.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Ticket className="w-4 h-4" />
                Submit Ticket
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
