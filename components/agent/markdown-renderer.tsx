'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { highlightCode, oneDark } from '@/components/ui/syntax-highlight';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// =====================================================
// Components
// =====================================================

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
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
      className="relative my-3 rounded-lg overflow-hidden group"
      style={{ backgroundColor: oneDark.bg }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 text-xs border-b border-[#3d3d3d]"
        style={{ backgroundColor: '#1e1e1e', color: oneDark.comment }}
      >
        <span>{language || 'code'}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-white/10"
            style={{ color: copied ? '#4ade80' : oneDark.comment }}
            aria-label={copied ? 'Copied!' : 'Copy code'}
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
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className="font-mono whitespace-pre" style={{ color: oneDark.text }}>
          {highlightCode(code, language)}
        </code>
      </pre>
    </div>
  );
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // Allow only safe HTML tags
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Allow className for styling
    '*': ['className'],
    // Restrict link attributes
    a: ['href', 'title', 'target', 'rel'],
    // Allow code language class
    code: ['className'],
    // Allow image attributes but sanitize src
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  // Block javascript: and data: URLs
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  // Strip event handlers
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
};

function MarkdownRendererComponent({ content, className }: MarkdownRendererProps) {
  // Memoize sanitization to avoid re-running expensive regex operations on every render
  const sanitizedContent = useMemo(() => {
    if (!content) return content;

    const needsSanitize = /<|javascript:|data:/i.test(content);
    if (!needsSanitize) return content;

    return (
      content
        // Remove any script tags that might have slipped through
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove event handlers
        .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
        // Remove javascript: URLs
        .replace(/javascript:/gi, '')
        // Remove data: URLs (except safe image types)
        .replace(/data:(?!image\/(png|jpeg|gif|webp|svg\+xml))[^;,]*/gi, '')
    );
  }, [content]);

  // Memoize ReactMarkdown components to prevent re-renders
  const markdownComponents = useMemo(
    () => ({
      code({
        node: _node,
        className: codeClassName,
        children,
        ...props
      }: {
        node?: unknown;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(codeClassName || '');
        const isInline = !match && !String(children).includes('\n');

        if (isInline) {
          return (
            <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
              {children}
            </code>
          );
        }

        return (
          <CodeBlock
            language={match?.[1] || ''}
            code={String(children).replace(/\n$/, '')}
          />
        );
      },
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="text-2xl font-semibold text-foreground mt-4 mb-2">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="text-xl font-semibold text-foreground mt-4 mb-2">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h3>
      ),
      h4: ({ children }: { children?: React.ReactNode }) => (
        <h4 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h4>
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="my-2 leading-relaxed">{children}</p>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="my-2 pl-6 list-disc">{children}</ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="my-2 pl-6 list-decimal">{children}</ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => <li className="my-1">{children}</li>,
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="border-l-2 border-muted-foreground pl-4 italic my-3 text-muted-foreground">
          {children}
        </blockquote>
      ),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
        // Validate URL - only allow http, https, mailto
        const isValidUrl = href && /^(https?:|mailto:)/i.test(href);
        const safeHref = isValidUrl ? href : '#';

        return (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[#C157C1] underline underline-offset-2 hover:text-[#C157C1]/80"
          >
            {children}
          </a>
        );
      },
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="overflow-x-auto my-3">
          <table className="w-full border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="border border-border px-3 py-2 text-left bg-secondary font-medium">
          {children}
        </th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="border border-border px-3 py-2 text-left">{children}</td>
      ),
      hr: () => <hr className="my-4 border-border" />,
      pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold">{children}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
      del: ({ children }: { children?: React.ReactNode }) => (
        <del className="line-through">{children}</del>
      ),
      img: ({ src, alt, ...props }: { src?: string; alt?: string }) => {
        // Only allow http, https, and safe data URLs
        const isValidSrc =
          src &&
          typeof src === 'string' &&
          (/^https?:\/\//i.test(src) ||
            /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(src));

        if (!isValidSrc) return null;

        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src || '/placeholder.svg'}
            alt={alt || ''}
            className="max-w-full h-auto rounded my-2"
            loading="lazy"
            {...props}
          />
        );
      },
    }),
    []
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={markdownComponents as Parameters<typeof ReactMarkdown>[0]['components']}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

// Memoize the component to prevent re-renders when props haven't changed
export const MarkdownRenderer = memo(MarkdownRendererComponent);
