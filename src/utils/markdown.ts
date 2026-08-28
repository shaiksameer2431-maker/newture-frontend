// Lightweight markdown formatter used by the chat widget.
// This intentionally avoids adding new runtime dependencies (markdown-it / DOMPurify)
// and implements safe escaping + a small subset of Markdown features used in content.

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function formatMarkdown(input: string, isDark = false): string {
  if (!input) return '';
  // 1) Bold tokens for known entities (CSE, ECE, ticket IDs, simple numbers/dates)
  const tokenRegex = /\b(?:CSE|ECE|EEE|MECH|CIVIL|MBA|MCA|\d{6}|[0-9]{1,2}:[0-9]{2}\s?(?:AM|PM)|[0-9]+(?:\.[0-9]+)?%|[0-9]+\s+(?:days?|weeks?|months?|years?))\b/gi;
  const withTokenBolding = input.replace(tokenRegex, '**$&**');

  // 2) Escape HTML
  let escaped = escapeHtml(withTokenBolding);

  // 3) Simple markdown: **bold** -> <strong>
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 4) Links: [text](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
    const href = url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim();
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 5) Auto-link plain URLs
  escaped = escaped.replace(/(https?:\/\/[\w./?=&%#-]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // 6) Paragraphs and line breaks
  const paragraphs = escaped.split(/\n{2,}/g).map(p => p.replace(/\n/g, '<br/>'));
  return paragraphs.map(p => `<p>${p}</p>`).join('');
}

