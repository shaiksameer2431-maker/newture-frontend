import React, { ReactNode, useMemo } from 'react';
import { Bell, Building2, CalendarDays, ChevronRight, CircleDollarSign, ExternalLink, GraduationCap, Mail, Phone, UserRound, Briefcase, CheckCircle2 } from 'lucide-react';

type Tone = 'light' | 'dark';
type Contact = { name?: string; designation?: string; department?: string; emails: string[]; phones: string[] };

export interface RichResponseRendererProps {
  text: string;
  isDark: boolean;
  fallback: ReactNode;
  plainText?: boolean; // Flag to disable rich rendering
}

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d{1,4}[\s.-]?)?(?:\(?\d{3,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}\b/g;
const namePattern = /(?:Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|डॉ\.?|डा\.?|శ్రీ|ప్రొఫెసర్)\s+(?:(?:[A-Z]\.?\s*){0,3}[\p{L}.'-]+(?:\s+(?:(?:[A-Z]\.?\s*){0,3}[\p{L}.'-]+)){0,4})/iu;
const designationPattern = /(Principal|Vice[- ]?Principal|Dean|HOD|Head of Department|Director|Registrar|Coordinator|Counsel(?:l)?or|Professor|Assistant Professor|Associate Professor|Manager|Officer|ప్రిన్సిపాల్|ప్రొఫెసర్|प्राचार्य|प्रोफेसर)/i;
const departmentPattern = /(Department(?:\s+of)?\s+[\p{L}& -]+|CSE|ECE|EEE|MECH|CIVIL|AIML|AIDS|MBA|MCA)/iu;

const unique = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))];
const cleanPhone = (value: string) => value.replace(/[^\d+]/g, '');
const words = (value: string) => value.trim().replace(/\s+/g, ' ');

function detectContacts(text: string): Contact[] {
  const lines = text.replace(/\r/g, '').split(/\n|(?<=[.;])\s+(?=(?:Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|डॉ\.?|శ్రీ))/iu);
  const contacts: Contact[] = [];
  let current: Contact | null = null;
  for (const raw of lines) {
    const line = words(raw);
    if (!line) continue;
    const labelledName = line.match(/(?:name|नाम|పేరు)\s*:\s*([\p{L}.' -]{3,80})/iu)?.[1]?.trim();
    const designationBeforeName = line.match(/^([\p{L}.' -]{3,80}?)\s*(?:\(|[-–—,])\s*(?:Principal|Dean|HOD|Director|Professor|Manager|Officer|ప్రిన్సిపాల్|ప్రొఫెసర్|प्राचार्य|प्रोफेसर)/iu)?.[1]?.trim();
    const name = line.match(namePattern)?.[0] || labelledName || designationBeforeName;
    const emails = unique(line.match(emailPattern) || []);
    const phones = unique((line.match(phonePattern) || []).filter(phone => cleanPhone(phone).replace(/^\+/, '').length >= 7));
    const designation = line.match(designationPattern)?.[0];
    const department = line.match(departmentPattern)?.[0];
    if (name) {
      if (current && (current.name || current.emails.length || current.phones.length)) contacts.push(current);
      current = { name, designation, department, emails, phones };
    } else if (current) {
      current.emails = unique([...current.emails, ...emails]);
      current.phones = unique([...current.phones, ...phones]);
      current.designation ||= designation;
      current.department ||= department;
    } else if (emails.length || phones.length) {
      current = { designation, department, emails, phones };
    }
  }
  if (current && (current.name || current.emails.length || current.phones.length)) contacts.push(current);
  return contacts.filter(contact => contact.name || contact.emails.length || contact.phones.length);
}

function parseTable(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows = lines.filter(line => line.includes('|')).map(line => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
  if (rows.length < 2 || rows[0].length < 2 || rows.some(row => row.length !== rows[0].length)) return null;
  const filtered = rows.filter(row => !row.every(cell => /^:?-{2,}:?$/.test(cell)));
  return filtered.length > 1 ? { headers: filtered[0], rows: filtered.slice(1) } : null;
}

function parseList(text: string) {
  const items = text.split(/\r?\n/).map(line => line.trim()).filter(line => /^(?:[-*•]|\d+[.)])\s+/.test(line));
  return items.length >= 2 ? items.map(item => item.replace(/^(?:[-*•]|\d+[.)])\s+/, '')) : null;
}

function parseTimeline(text: string) {
  if (!/(process|schedule|procedure|timeline|steps?|events?|admission|placement)/i.test(text)) return null;
  const list = parseList(text);
  if (list) return list;
  const sentences = text.split(/(?<=[.!?])\s+/).map(words).filter(sentence => sentence.length > 10);
  return sentences.length >= 2 && sentences.length <= 8 ? sentences : null;
}

function detectInformationKind(text: string): { title: string; icon: 'notice' | 'department' | 'fee' | 'portal' | 'faculty' | 'recruiters' } | null {
  if (/\b(notice|announcement|circular|holiday|exam(?:ination)? alert)\b/i.test(text)) return { title: 'Notice details', icon: 'notice' };
  if (/\b(fee|fees|tuition|payment|scholarship|refund)\b/i.test(text)) return { title: 'Fee information', icon: 'fee' };
  if (/\b(department|branch|programme|program|speciali[sz]ation)\b/i.test(text)) return { title: 'Department information', icon: 'department' };
  if (/\b(portal|login|dashboard|website)\b/i.test(text)) return { title: 'Portal information', icon: 'portal' };
  if (/\b(faculty|professor|lecturer|teaching staff|hod|head of department)\b/i.test(text)) return { title: 'Faculty information', icon: 'faculty' };
  if (/\b(recruit(er|ment)|major recruiters|top recruiters|companies|recruiters?)\b/i.test(text)) return { title: 'Major Recruiters', icon: 'recruiters' };
  return null;
}

const surface = (tone: Tone) => tone === 'dark'
  ? 'border-slate-700/80 bg-slate-900/80 text-slate-100'
  : 'border-slate-200 bg-white text-slate-800';

// Detect recruiters listed as "Major Recruiters: Accenture, TCS, Deloitte" or as a bulleted list
function parseDepartments(text: string): string[] | null {
  const labelMatch = text.match(/(?:Departments?|Branches?|Programs?|Programmes?)\s*[:\-]\s*([^\n]+)/i);
  if (labelMatch) {
    const list = labelMatch[1].split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if (list.length >= 1) return list;
  }
  const list = parseList(text);
  if (list && list.length >= 2) {
    // ensure items look like department names (letters, &, spaces)
    const filtered = list.filter(i => /[A-Za-z&\s]{2,}/.test(i));
    return filtered.length ? filtered : null;
  }
  return null;
}

// Detect recruiters listed as "Major Recruiters: Accenture, TCS, Deloitte" or as a bulleted list
function parseRecruiters(text: string): string[] | null {
  const labelMatch = text.match(/(?:Major Recruiters|Top Recruiters|Recruiters|Companies)\s*[:\-]\s*([^\n]+)/i);
  if (labelMatch) {
    const list = labelMatch[1].split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if (list.length >= 1) return list;
  }
  const list = parseList(text);
  if (list && list.length >= 2) return list;
  // Fallback: look for common company names (small heuristic)
  const known = ['Accenture','TCS','Deloitte','Reliance','Infosys','Wipro','Cognizant','Capgemini','Tech Mahindra','HCL'];
  const found = known.filter(k => new RegExp('\\b'+k+'\\b','i').test(text));
  return found.length ? found : null;
}

function detectTicketIds(text: string): string[] {
  const ids = Array.from(new Set((text.match(/\bNECN[-_ ]?\d{8}[-_ ]?\d{4,6}\b/gi) || []).map(s => s.replace(/\s+/g, '').toUpperCase())));
  return ids;
}

function DepartmentList({ items, tone }: { items: string[]; tone: Tone }) {
  return <div className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)}`} aria-label="Departments">
    <h4 className="nexa-display text-sm font-bold mb-2">Departments</h4>
    <div className="space-y-1.5">
      {items.map(item => {
        // Format as: • **CSE** – Computer Science & Engineering
        const parts = item.split(/[-–—]/);
        const code = parts[0]?.trim() || item;
        const description = parts.slice(1).join('-').trim() || '';
        
        return (
          <div key={item} className="flex items-start gap-2 text-sm">
            <span className={`font-bold ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>•</span>
            <span>
              <span className="font-bold">{code}</span>
              {description && <span className="ml-1">– {description}</span>}
            </span>
          </div>
        );
      })}
    </div>
  </div>;
}

function CompanyList({ companies, tone }: { companies: string[]; tone: Tone }) {
  return <div className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)}`} aria-label="Recruiters">
    <h4 className="nexa-display text-sm font-bold mb-2">Major Recruiters</h4>
    <ul className="space-y-1.5 list-none p-0 m-0">
      {companies.map(c => (
        <li key={c} className="flex items-start gap-2 text-sm">
          <span className={`font-bold ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>•</span>
          <span className="font-semibold">{c}</span>
        </li>
      ))}
    </ul>
  </div>;
}

function FacultyCard({ contact, tone }: { contact: Contact; tone: Tone }) {
  const heading = tone === 'dark' ? 'text-white' : 'text-slate-950';
  const muted = tone === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const subheading = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  return <article className={`rounded-2xl border p-4 shadow-sm ${surface(tone)}`}>
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-300"><UserRound className="h-5 w-5"/></div>
      <div className="min-w-0 flex-1">
        <h3 className={`nexa-display text-sm font-extrabold ${heading} leading-tight`}>{contact.name}</h3>
        <div className={`text-xs font-semibold ${muted} mt-0.5`}>{contact.designation || 'Faculty'}</div>
        <div className={`text-xs ${subheading} mt-0.5`}>{contact.department}</div>
        
        <div className="mt-3 space-y-1.5">
          {(contact.emails||[]).map(e => (
            <a key={e} href={`mailto:${e}`} className={`flex items-center gap-2 text-xs font-semibold ${tone === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'}`}>
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{e}</span>
            </a>
          ))}
          {(contact.phones||[]).map(p => (
            <a key={p} href={`tel:${cleanPhone(p)}`} className={`flex items-center gap-2 text-xs font-semibold ${tone === 'dark' ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-700'}`}>
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{p}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  </article>;
}

function NoticeCard({ text, tone }: { text: string; tone: Tone }) {
  // very lightweight parsing for title/date
  const title = text.split(/\r?\n/)[0].slice(0, 120);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s\d{4})/i);
  const date = dateMatch ? dateMatch[0] : undefined;
  return <article className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)}`}>
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-300"><CalendarDays className="h-4 w-4"/></span><div><h4 className="nexa-display text-sm font-bold">{title}</h4><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{date || 'Notice'}</p></div></div>
    </header>
    <div className="mt-3 text-xs leading-relaxed">{text.split(/\r?\n/).slice(1).join('\n').trim()}</div>
  </article>;
}

function TicketCard({ ticketId, tone }: { ticketId: string; tone: Tone }) {
  const link = `/tickets/track?id=${encodeURIComponent(ticketId)}`;
  return <article className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)}`}>
    <div className="flex items-center gap-3"><span className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5"/></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3"><div><h4 className="nexa-display text-sm font-bold">Support Ticket Created</h4><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ticket ID: <span className="nexa-mono font-extrabold">{ticketId}</span></p></div><a className="nexa-focus inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white" href={link}>Track Ticket <ChevronRight className="h-3.5 w-3.5"/></a></div>
      </div>
    </div>
  </article>;
}


function ContactCards({ contacts, tone }: { contacts: Contact[]; tone: Tone }) {
  const heading = tone === 'dark' ? 'text-white' : 'text-slate-950';
  const muted = tone === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const subheading = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const blue = tone === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700';
  const green = tone === 'dark' ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-600 hover:text-emerald-700';
  return <div className="space-y-3" aria-label="Contact information">
    {contacts.map((contact, index) => <article key={`${contact.name || 'contact'}-${index}`} className={`rounded-2xl border p-4 shadow-sm ${surface(tone)}`}>
      <div className="flex gap-3 items-start">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ${tone === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}><UserRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h4 className={`nexa-display text-sm font-bold leading-tight ${heading}`}>{contact.name || 'College Contact'}</h4>
          <p className={`mt-0.5 text-xs font-semibold ${muted}`}>{[(contact.designation || 'Designation Not Available'), contact.department].filter(Boolean).join(' · ')}</p>
          <div className="mt-3 space-y-1.5">
            {contact.emails.map(email => <a key={email} href={`mailto:${email}`} className={`nexa-focus flex items-center gap-2 text-xs font-semibold ${blue}`}><Mail className="h-3.5 w-3.5 shrink-0" /><span className="break-all">{email}</span></a>)}
            {contact.phones.map(phone => <a key={phone} href={`tel:${cleanPhone(phone)}`} className={`nexa-focus flex items-center gap-2 text-xs font-semibold ${green}`}><Phone className="h-3.5 w-3.5 shrink-0" /><span className="break-all">{phone}</span></a>)}
          </div>
        </div>
      </div>
    </article>)}
  </div>;
}

function PortalCards({ urls, tone }: { urls: string[]; tone: Tone }) {
  return <div className="space-y-2.5" aria-label="Portal links">
    {urls.map((url, index) => {
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const hostname = url.replace(/^https?:\/\//i, '').split('/')[0];
      return <article key={url} className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)}`}>
        <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-300"><ExternalLink className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h4 className="nexa-display text-sm font-bold">College portal {urls.length > 1 ? index + 1 : ''}</h4><p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{hostname}</p><a className="nexa-focus mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700" href={safeUrl} target="_blank" rel="noreferrer">Open portal <ChevronRight className="h-3.5 w-3.5" /></a></div></div>
      </article>;
    })}
  </div>;
}

function InformationCard({ kind, tone, children }: { kind: NonNullable<ReturnType<typeof detectInformationKind>>; tone: Tone; children: ReactNode }) {
  const Icon = kind.icon === 'notice' ? Bell : kind.icon === 'fee' ? CircleDollarSign : kind.icon === 'faculty' ? GraduationCap : kind.icon === 'portal' ? ExternalLink : Building2;
  return <article className={`rounded-2xl border p-3.5 shadow-sm ${surface(tone)} `}>
    <header className={`mb-3 flex items-center gap-2 border-b pb-2.5 ${tone === 'dark' ? 'border-slate-700' : 'border-slate-200/80'}`}>
      <span className={`rounded-lg bg-indigo-500/10 p-1.5 ${tone === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}><Icon className="h-4 w-4" /></span>
      <h4 className="nexa-display text-sm font-bold">{kind.title}</h4>
    </header>
    <div className="text-xs leading-relaxed">{children}</div>
  </article>;
}

export function RichResponseRenderer({ text, isDark, fallback, plainText }: RichResponseRendererProps) {
  // If plainText flag is set, skip all rich rendering and return fallback
  if (plainText) {
    return <>{fallback}</>;
  }

  const tone: Tone = isDark ? 'dark' : 'light';
  const model = useMemo(() => ({
    contacts: detectContacts(text),
    table: parseTable(text),
    list: parseList(text),
    timeline: parseTimeline(text),
    urls: unique(text.match(/(?:https?:\/\/|www\.)[^\s<>]+/gi) || []),
    informationKind: detectInformationKind(text),
    recruiters: parseRecruiters(text),
    departments: parseDepartments(text),
    ticketIds: detectTicketIds(text)
  }), [text]);

  // Ticket IDs take highest priority — show ticket card for confirmation messages
  if (model.ticketIds && model.ticketIds.length > 0) {
    return <div className="space-y-3">{model.ticketIds.map(id => <TicketCard key={id} ticketId={id} tone={tone} />)}</div>;
  }

  // Recruiter lists and department lists have explicit renderers
  if (model.recruiters && model.recruiters.length > 0) return <CompanyList companies={model.recruiters} tone={tone} />;
  if (model.departments && model.departments.length > 0) return <DepartmentList items={model.departments} tone={tone} />;

  // Faculty / Contacts — prefer faculty-style cards when the information kind suggests faculty
  if (model.contacts.length) {
    const anyFaculty = model.informationKind?.icon === 'faculty' || model.contacts.some(c => /\b(HOD|Head|Dean|Professor|Lecturer|Assistant Professor|Associate Professor)\b/i.test(`${c.designation || ''} ${c.department || ''}`));
    if (anyFaculty) return <div className="space-y-3">{model.contacts.map((c, idx) => <FacultyCard key={`${c.name||'faculty'}-${idx}`} contact={c} tone={tone} />)}</div>;
    return <ContactCards contacts={model.contacts} tone={tone} />;
  }

  if (model.table) return <div className={`overflow-x-auto rounded-2xl border shadow-sm ${surface(tone)}`} role="region" aria-label="Structured information table" tabIndex={0}><table className="min-w-full text-left text-xs"><thead className={tone === 'dark' ? 'bg-slate-800 text-slate-100' : 'bg-slate-100/80 text-slate-700'}><tr>{model.table.headers.map(header => <th className="whitespace-nowrap px-3 py-2.5 font-extrabold" key={header}>{header}</th>)}</tr></thead><tbody>{model.table.rows.map((row, rowIndex) => <tr className={`border-t ${tone === 'dark' ? 'border-slate-700 even:bg-slate-800/50' : 'border-slate-200/70 even:bg-slate-50/70'}`} key={rowIndex}>{row.map((cell, cellIndex) => <td className="px-3 py-2.5 align-top leading-relaxed" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (model.timeline) {
    return (
      <ol className="space-y-3" aria-label="Process timeline">
        {model.timeline.map((item, index) => (
          <li className="relative flex gap-3" key={item}>
            <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-extrabold text-white">
              {index + 1}
            </span>
            {index < model.timeline!.length - 1 && (
              <span className="absolute left-3 top-6 h-[calc(100%+0.25rem)] w-px bg-indigo-200 dark:bg-indigo-900" />
            )}
            <p className={`min-w-0 pb-1 pt-0.5 text-xs leading-relaxed ${tone === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
              {item}
            </p>
          </li>
        ))}
      </ol>
    );
  }
  if (model.list) return <ul className={`space-y-2 rounded-2xl border p-3.5 text-xs leading-relaxed shadow-sm ${surface(tone)}`}>{model.list.map(item => <li className="flex gap-2" key={item}><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{item}</li>)}</ul>;
  if (model.urls.length) return <PortalCards urls={model.urls} tone={tone} />;
  if (model.informationKind) return <InformationCard kind={model.informationKind} tone={tone}>{fallback}</InformationCard>;
  return <>{fallback}</>;
}

export const richResponseIcons = { Bell, Building2, CalendarDays, CircleDollarSign, GraduationCap };
