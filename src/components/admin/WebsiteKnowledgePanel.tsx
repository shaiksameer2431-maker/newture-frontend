import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Database, ExternalLink, FileText, Globe2,
  History, Play, RefreshCw, Search, ShieldCheck, SquareArrowOutUpRight
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Props { isDark: boolean; }

interface CrawlJob {
  id: string;
  started_at: string;
  completed_at?: string | null;
  start_url: string;
  pages_discovered: number;
  pages_crawled: number;
  pages_updated: number;
  pages_failed: number;
  pages_new?: number;
  pages_unchanged?: number;
  pdf_documents?: number;
  chunks_created?: number;
  documents_skipped?: number;
  documents_too_large?: number;
  current_url?: string | null;
  job_type?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string | null;
}

interface WebsitePage {
  id: string;
  url: string;
  title?: string;
  category?: string;
  content_type?: string;
  http_status?: number;
  last_crawled?: string;
  last_changed?: string | null;
}

export default function WebsiteKnowledgePanel({ isDark }: Props) {
  const [settings, setSettings] = useState<any>({
    domain: 'necn.ac.in',
    crawl_url: 'https://necn.ac.in/',
    crawl_limit: 0,
    scheduled_interval_hours: 24,
    is_scheduled_sync: 1
  });
  const [status, setStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [pageSearch, setPageSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [embedding, setEmbedding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);

  const card = isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white';
  const soft = isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  const latest: CrawlJob | undefined = status?.latest;
  const stats = status?.stats || {};
  const activeJob = latest?.status === 'running' ? latest : null;

  const progress = useMemo(() => {
    if (!activeJob) return 0;
    if (!activeJob.pages_discovered) return 3;
    return Math.min(99, Math.round((activeJob.pages_crawled / activeJob.pages_discovered) * 100));
  }, [activeJob]);

  const setNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const loadStatus = async () => {
    try {
      const resp = await apiFetch('/api/admin/website-sync/status');
      if (resp.ok) setStatus(await resp.json());
    } catch { /* keep the admin panel usable if backend temporarily restarts */ }
  };

  const loadJobs = async () => {
    try {
      const resp = await apiFetch('/api/admin/website-sync/jobs?limit=10');
      if (resp.ok) setJobs((await resp.json()).jobs || []);
    } catch { /* ignore transient API errors */ }
  };

  const loadPages = async (search = pageSearch) => {
    setLoadingPages(true);
    try {
      const query = encodeURIComponent(search.trim());
      const resp = await apiFetch(`/api/admin/website-pages?limit=60${query ? `&search=${query}` : ''}`);
      if (resp.ok) setPages((await resp.json()).pages || []);
    } catch { /* ignore transient API errors */ }
    finally { setLoadingPages(false); }
  };

  const load = async () => {
    try {
      const [settingsResp] = await Promise.all([
        apiFetch('/api/admin/website-settings'),
        loadStatus(),
        loadJobs(),
        loadPages('')
      ]);
      if (settingsResp.ok) setSettings((await settingsResp.json()) || settings);
    } catch { /* keep UI usable when backend is unavailable */ }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => {
      void loadStatus();
      void loadJobs();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeJob?.id]);

  useEffect(() => {
    if (!syncing && latest && latest.status !== 'running') {
      void loadPages(pageSearch);
    }
  }, [latest?.status]);

  const syncNow = async (type: 'FULL' | 'INCREMENTAL' = 'FULL') => {
    if (activeJob) return;
    setSyncing(true);
    setNotice('Starting NECN website crawl. The admin panel will stay responsive while it runs…');
    try {
      const resp = await apiFetch('/api/admin/website-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrl: settings.crawl_url || 'https://necn.ac.in/',
          maxPages: Number(settings.crawl_limit ?? 0), type
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not start website crawl');
      setSyncing(false);
      setNotice(`Crawl started${data.jobId ? ` · Job ${String(data.jobId).slice(0, 8)}` : ''}. Watching live progress below.`);
      await loadStatus();
      await loadJobs();
    } catch (error: any) {
      setSyncing(false);
      setNotice(error.message || 'Website crawl failed to start.', 'error');
    }
  };

  const retryFailed = async () => {
    if (activeJob) return;
    try {
      const resp = await apiFetch('/api/admin/website-sync/retry-failed', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not retry failed URLs.');
      setNotice(data.message || 'Retrying recorded failed URLs.');
      await loadStatus(); await loadJobs();
    } catch (error: any) { setNotice(error.message || 'Could not retry failed URLs.', 'error'); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const resp = await apiFetch('/api/admin/website-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: settings.domain || 'necn.ac.in',
          crawl_url: settings.crawl_url || 'https://necn.ac.in/',
          crawl_limit: Number(settings.crawl_limit ?? 0),
          scheduled_interval_hours: Number(settings.scheduled_interval_hours || 24),
          is_scheduled_sync: settings.is_scheduled_sync ? 1 : 0
        })
      });
      if (!resp.ok) throw new Error('Failed to save website settings');
      setNotice('Website crawl and synchronization settings saved.');
      await loadStatus();
    } catch (error: any) {
      setNotice(error.message || 'Could not save settings.', 'error');
    } finally { setSaving(false); }
  };

  const backfillEmbeddings = async () => {
    setEmbedding(true);
    setNotice('Building semantic embeddings for the crawled NECN knowledge…');
    try {
      const resp = await apiFetch('/api/admin/website-sync/embeddings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 40 })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Embedding generation failed');
      setNotice(`Semantic index updated: ${data.processed} chunks embedded${data.failed ? `, ${data.failed} failed` : ''}.`);
      await loadStatus();
    } catch (error: any) {
      setNotice(error.message || 'Semantic embedding failed.', 'error');
    } finally { setEmbedding(false); }
  };

  const statusLabel = activeJob ? 'CRAWL IN PROGRESS' : latest?.status === 'failed' ? 'LAST CRAWL FAILED' : 'READY';
  const statusClass = activeJob
    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    : latest?.status === 'failed'
      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

  return (
    <section className={`rounded-2xl border p-6 shadow-sm space-y-5 ${card}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-blue-500" />
            <h3 className="text-base font-extrabold">NECN Website Knowledge & Crawler</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className={`mt-1 max-w-3xl text-xs ${muted}`}>
            Crawl the entire public NECN website into the local knowledge database. HTML pages, internal modules and text-based PDFs become searchable knowledge; the crawler keeps source URLs and content hashes for incremental synchronization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://necn.ac.in/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
            <ExternalLink className="h-3.5 w-3.5" /> Official NECN
          </a>
          <button onClick={() => void syncNow('FULL')} disabled={syncing || Boolean(activeJob)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-blue-500/10 disabled:opacity-50">
            {activeJob ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {activeJob ? 'Crawling NECN…' : 'Crawl NECN Now'}
          </button>
          <button onClick={() => void syncNow('INCREMENTAL')} disabled={syncing || Boolean(activeJob)} className="rounded-xl border px-3 py-2.5 text-xs font-bold disabled:opacity-50">Run Incremental Sync</button>
          <button onClick={() => void retryFailed()} disabled={syncing || Boolean(activeJob)} className="rounded-xl border px-3 py-2.5 text-xs font-bold disabled:opacity-50">Retry Failed</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Pages Indexed', stats.pages_indexed ?? 0],
          ['Knowledge Chunks', stats.chunks_indexed ?? 0],
          ['PDF Documents', stats.pdf_documents ?? 0],
          ['Semantic Chunks', `${status?.rag?.embeddedChunks ?? 0}/${status?.rag?.totalChunks ?? 0}`],
          ['Last Sync', latest?.completed_at ? new Date(latest.completed_at).toLocaleString() : 'Not synced yet']
        ].map(([label, value]) => (
          <div key={String(label)} className={`rounded-xl border p-3 ${soft}`}>
            <div className={`text-[10px] font-bold uppercase ${muted}`}>{label}</div>
            <div className="mt-1 text-sm font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      {activeJob && (
        <div className={`rounded-xl border p-4 ${soft}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold"><RefreshCw className="h-4 w-4 animate-spin text-blue-500" /> Live crawl progress</div>
              <p className={`mt-1 text-[11px] ${muted}`}>The crawler is discovering and indexing official NECN content in the background.</p>
            </div>
            <span className="font-mono text-[10px] text-blue-500">JOB {activeJob.id.slice(0, 8)}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
            <span>Discovered <strong>{activeJob.pages_discovered}</strong></span>
            <span>Crawled <strong>{activeJob.pages_crawled}</strong></span>
            <span>Updated <strong>{activeJob.pages_updated}</strong></span>
            <span>Failed <strong className={activeJob.pages_failed ? 'text-rose-500' : ''}>{activeJob.pages_failed}</strong></span>
          </div>
          <div className={`mt-2 truncate text-[10px] ${muted}`}>Current URL: {activeJob.current_url || 'Discovering URLs…'}</div>
        </div>
      )}

      <div className={`rounded-xl border p-4 ${soft}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Official-source crawl configuration</div>
            <div className={`mt-1 text-[11px] ${muted}`}>The crawler is restricted to <strong>necn.ac.in</strong>; it does not follow external social, advertising or tracking domains.</div>
          </div>
          <button onClick={backfillEmbeddings} disabled={embedding || Boolean(activeJob) || !(status?.rag?.enabled)} className="rounded-lg border px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">
            {embedding ? 'Embedding…' : 'Build Semantic Index'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={`text-[11px] font-semibold ${muted}`}>
            Knowledge domain
            <input type="text" value={settings.domain ?? ''} onChange={e => setSettings({...settings, domain: e.target.value})} className="mt-1 w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs" />
          </label>
          <label className={`text-[11px] font-semibold ${muted}`}>
            Crawl start URL
            <input type="text" value={settings.crawl_url ?? ''} onChange={e => setSettings({...settings, crawl_url: e.target.value})} className="mt-1 w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs" />
          </label>
          <label className={`text-[11px] font-semibold ${muted}`}>
            Crawl limit (0 = all discovered)
            <input type="number" min="0" max="5000" value={settings.crawl_limit ?? 0} onChange={e => setSettings({...settings, crawl_limit: e.target.value})} className="mt-1 w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs" />
          </label>
          <label className={`text-[11px] font-semibold ${muted}`}>
            Automatic sync interval (hours)
            <input type="number" min="1" max="168" value={settings.scheduled_interval_hours ?? 24} onChange={e => setSettings({...settings, scheduled_interval_hours: e.target.value})} className="mt-1 w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className={`flex items-center gap-2 text-[11px] font-semibold ${muted}`}>
            <input type="checkbox" checked={Boolean(Number(settings.is_scheduled_sync ?? 1))} onChange={e => setSettings({...settings, is_scheduled_sync: e.target.checked ? 1 : 0})} />
            Enable automatic incremental sync
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex items-center gap-2 text-[10px] ${muted}`}><Database className="h-3.5 w-3.5" /> Data is stored locally in SQLite and reused for chatbot retrieval.</div>
          <button onClick={saveSettings} disabled={saving} className="rounded-lg border px-3 py-2 text-[11px] font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save Sync Settings'}</button>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${messageType === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
          {messageType === 'error' ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`rounded-xl border p-4 ${soft}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold"><History className="h-4 w-4 text-violet-500" /> Crawl history</div>
              <p className={`mt-1 text-[10px] ${muted}`}>Every manual or scheduled synchronization is recorded in SQLite.</p>
            </div>
            <button onClick={() => { void loadStatus(); void loadJobs(); }} className="rounded-lg border p-2" title="Refresh crawl history"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
            {jobs.length === 0 && <div className={`py-6 text-center text-[11px] ${muted}`}>No crawl jobs yet.</div>}
            {jobs.map(job => (
              <div key={job.id} className="rounded-lg border border-slate-200/80 p-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[9px] font-extrabold uppercase ${job.status === 'completed' ? 'text-emerald-500' : job.status === 'running' ? 'text-blue-500' : 'text-rose-500'}`}>{job.status}</span>
                  <span className={`text-[9px] ${muted}`}>{new Date(job.started_at).toLocaleString()}</span>
                </div>
                <div className={`mt-1 grid grid-cols-4 gap-2 text-[9px] ${muted}`}>
                  <span>Found <strong>{job.pages_discovered}</strong></span>
                  <span>Crawled <strong>{job.pages_crawled}</strong></span>
                  <span>Updated <strong>{job.pages_updated}</strong></span>
                  <span>Failed <strong className={job.pages_failed ? 'text-rose-500' : ''}>{job.pages_failed}</strong></span>
                </div>
                <div className={`mt-1 text-[9px] ${muted}`}>{job.job_type || 'FULL'} · New {job.pages_new ?? 0} · Unchanged {job.pages_unchanged ?? 0} · PDFs {job.pdf_documents ?? 0} · Skipped {job.documents_skipped ?? 0} · Oversized {job.documents_too_large ?? 0} · Chunks {job.chunks_created ?? 0}</div>
                {job.error && <div className="mt-1 truncate text-[9px] text-rose-500" title={job.error}>{job.error}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${soft}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold"><FileText className="h-4 w-4 text-blue-500" /> Indexed NECN pages</div>
              <p className={`mt-1 text-[10px] ${muted}`}>Inspect what the crawler has actually stored. This is the dataset used by NEXA retrieval.</p>
            </div>
            <button onClick={() => void loadPages(pageSearch)} className="rounded-lg border p-2" title="Refresh indexed pages"><RefreshCw className={`h-3.5 w-3.5 ${loadingPages ? 'animate-spin' : ''}`} /></button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={pageSearch} onChange={e => setPageSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void loadPages(); }} placeholder="Search indexed pages, modules or URLs…" className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-3 text-[11px]" />
          </div>
          <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
            {pages.length === 0 && <div className={`py-6 text-center text-[11px] ${muted}`}>No indexed pages yet. Run the NECN crawl.</div>}
            {pages.map(page => (
              <div key={page.id} className="rounded-lg border border-slate-200/80 p-2.5 dark:border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold">{page.title || page.url}</div>
                    <div className={`truncate text-[9px] ${muted}`}>{page.url}</div>
                  </div>
                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border p-1.5" title="Open source page"><SquareArrowOutUpRight className="h-3 w-3" /></a>
                </div>
                <div className={`mt-1 flex flex-wrap gap-x-3 text-[9px] ${muted}`}>
                  <span>{page.category || 'General'}</span>
                  <span>{page.content_type?.includes('pdf') ? 'PDF' : 'HTML'}</span>
                  <span>HTTP {page.http_status || '—'}</span>
                  {page.last_changed && <span>Changed {new Date(page.last_changed).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] ${muted}`}>
        <span>RAG: <strong>{status?.rag?.enabled ? 'Enabled' : 'Keyword fallback'}</strong></span>
        <span>Auto sync: <strong>{status?.scheduler?.is_scheduled_sync ? `Every ${status.scheduler.scheduled_interval_hours}h` : 'Off'}</strong></span>
        <span>Source policy: <strong>NECN domain only</strong></span>
      </div>
    </section>
  );
}
