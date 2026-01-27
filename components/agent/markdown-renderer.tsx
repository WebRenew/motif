'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { marked } from 'marked';
import { highlightCode, oneDark } from '@/components/ui/syntax-highlight';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// =====================================================
// Code Block Component
// =====================================================

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  return (
    <div
      className="relative my-3 rounded-lg overflow-hidden max-w-full"
      style={{ backgroundColor: oneDark.bg }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 text-xs border-b border-[#3d3d3d]"
        style={{ backgroundColor: '#1e1e1e', color: oneDark.comment }}
      >
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-white/10"
          style={{ color: copied ? '#4ade80' : oneDark.comment }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto max-w-full">
        <code className="font-mono whitespace-pre" style={{ color: oneDark.text }}>
          {highlightCode(code, language)}
        </code>
      </pre>
    </div>
  );
}

// =====================================================
// Sanitization
// =====================================================

function sanitizeHtml(html: string): string {
  let safe = html;
  safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  safe = safe.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/javascript:/gi, '');
  safe = safe.replace(/data:(?!image\/(png|jpeg|gif|webp|svg\+xml))[^;,]*/gi, '');
  safe = safe.replace(/<(iframe|object|embed|form|input|button)\b[^>]*>.*?<\/\1>/gi, '');
  safe = safe.replace(/<(iframe|object|embed|form|input|button)\b[^>]*\/?>/gi, '');
  return safe;
}

function sanitizeUrl(url: string | undefined): string {
  if (!url) return '#';
  if (/^(https?:|mailto:)/i.test(url)) return url;
  return '#';
}

// =====================================================
// Custom Renderer
// =====================================================

function createRenderer() {
  const renderer = new marked.Renderer();

  renderer.heading = ({ text, depth }) => {
    const sizes: Record<number, string> = {
      1: 'text-2xl', 2: 'text-xl', 3: 'text-lg',
      4: 'text-base', 5: 'text-sm', 6: 'text-xs',
    };
    return `<h${depth} class="${sizes[depth] || 'text-base'} font-semibold text-foreground mt-4 mb-2">${text}</h${depth}>`;
  };

  renderer.paragraph = function({ tokens }) {
    return `<p class="my-2 leading-relaxed">${this.parser.parseInline(tokens)}</p>`;
  };

  renderer.list = (token) => {
    const tag = token.ordered ? 'ol' : 'ul';
    const body = token.items.map(item => renderer.listitem(item)).join('');
    return `<${tag} class="my-2 pl-6 ${token.ordered ? 'list-decimal' : 'list-disc'}">${body}</${tag}>`;
  };

  renderer.listitem = function(item) {
    const content = this.parser.parseInline(item.tokens);
    if (item.task) {
      const checkbox = item.checked ? '☑ ' : '☐ ';
      return `<li class="my-1">${checkbox}${content}</li>`;
    }
    return `<li class="my-1">${content}</li>`;
  };

  renderer.blockquote = ({ text }) =>
    `<blockquote class="border-l-2 border-muted-foreground pl-4 italic my-3 text-muted-foreground">${text}</blockquote>`;

  renderer.link = ({ href, text }) =>
    `<a href="${sanitizeUrl(href)}" target="_blank" rel="noopener noreferrer nofollow" class="text-[#C157C1] underline underline-offset-2 hover:text-[#C157C1]/80">${text}</a>`;

  renderer.image = ({ href, text }) => {
    const isValid = href && (/^https?:\/\//i.test(href) || /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(href));
    return isValid ? `<img src="${href}" alt="${text || ''}" class="max-w-full h-auto rounded my-2" loading="lazy" />` : '';
  };

  renderer.table = (token) => {
    const headerCells = token.header.map(cell => renderer.tablecell(cell)).join('');
    const headerRow = `<tr>${headerCells}</tr>`;
    const bodyRows = token.rows.map(row => {
      const cells = row.map(cell => renderer.tablecell(cell)).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<div class="overflow-x-auto my-3"><table class="w-full border-collapse"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></div>`;
  };
  renderer.tablerow = ({ text }) => `<tr>${text}</tr>`;
  renderer.tablecell = (cell) => {
    const tag = cell.header ? 'th' : 'td';
    const cls = cell.header ? 'border border-border px-3 py-2 text-left bg-secondary font-medium' : 'border border-border px-3 py-2 text-left';
    return `<${tag} class="${cls}">${cell.text}</${tag}>`;
  };

  renderer.hr = () => `<hr class="my-4 border-border" />`;
  renderer.strong = function({ tokens }) {
    return `<strong class="font-bold">${this.parser.parseInline(tokens)}</strong>`;
  };
  renderer.em = function({ tokens }) {
    return `<em class="italic">${this.parser.parseInline(tokens)}</em>`;
  };
  renderer.del = function({ tokens }) {
    return `<del class="line-through">${this.parser.parseInline(tokens)}</del>`;
  };
  renderer.codespan = ({ text }) => `<code class="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">${text}</code>`;

  // Code blocks: use a unique marker we can split on
  renderer.code = ({ text, lang }) => {
    const encoded = encodeURIComponent(text);
    return `<!--CODEBLOCK:${lang || ''}:${encoded}-->`;
  };

  return renderer;
}

// =====================================================
// Main Component - Split content by code blocks
// =====================================================

interface ContentPart {
  type: 'html' | 'code';
  content: string;
  language?: string;
}

function MarkdownRendererComponent({ content, className }: MarkdownRendererProps) {
  const parts = useMemo((): ContentPart[] => {
    if (!content) return [];

    const renderer = createRenderer();
    const rawHtml = marked.parse(content, { renderer, gfm: true, breaks: false }) as string;
    const sanitized = sanitizeHtml(rawHtml);

    // Split by code block markers
    const result: ContentPart[] = [];
    const codeBlockRegex = /<!--CODEBLOCK:([^:]*):([^>]*)-->/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(sanitized)) !== null) {
      // Add HTML before this code block
      if (match.index > lastIndex) {
        const htmlPart = sanitized.slice(lastIndex, match.index);
        if (htmlPart.trim()) {
          result.push({ type: 'html', content: htmlPart });
        }
      }

      // Add the code block
      result.push({
        type: 'code',
        language: match[1],
        content: decodeURIComponent(match[2]),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining HTML after last code block
    if (lastIndex < sanitized.length) {
      const remaining = sanitized.slice(lastIndex);
      if (remaining.trim()) {
        result.push({ type: 'html', content: remaining });
      }
    }

    return result;
  }, [content]);

  // Generate a stable key from content to force full re-render when content changes
  const contentKey = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }, [content]);

  return (
    <div className={`overflow-hidden ${className || ''}`} key={contentKey}>
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <CodeBlock key={`code-${i}`} language={part.language || ''} code={part.content} />
        ) : (
          <div 
            key={`html-${i}`} 
            className="overflow-hidden"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: part.content }} 
          />
        )
      )}
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererComponent);
