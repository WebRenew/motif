'use client';

import type React from 'react';

/**
 * Geist VSCode Theme - Syntax highlighting colors
 *
 * Colors from: https://github.com/phiewter/geist-vscode-theme
 *
 * Color Philosophy:
 * - Uses Vercel's Geist grid background palette
 * - Syntax colors from ray.so (pink, green, purple, blue)
 * - Minimal and elegant for an immersive coding experience
 *
 * @see https://marketplace.visualstudio.com/items?itemName=phiewter.geist-vscode-theme
 */
export const oneDark = {
  // Backgrounds - pure grays only: HSL(0, 0%, L%)
  // No hue, no saturation - achromatic for clean look
  bg: '#000000', // hsl(0, 0%, 0%)   - Editor background
  bgDark: '#0a0a0a', // hsl(0, 0%, 4%)   - Main background
  bgLight: '#1a1a1a', // hsl(0, 0%, 10%)  - Elevated elements

  // Text - pure grays only: HSL(0, 0%, L%)
  text: '#ededed', // hsl(0, 0%, 93%)  - Primary text
  textMuted: '#a3a3a3', // hsl(0, 0%, 64%)  - Secondary text
  comment: '#737373', // hsl(0, 0%, 45%)  - Comments

  // Rayso syntax colors (from Geist VSCode theme)
  keyword: '#FF4D84', // Rayso pink - keywords, operators, type annotations
  string: '#33FF66', // Rayso green - strings, JSX tags
  function: '#B875FF', // Rayso purple - functions, types, attributes
  number: '#57A5FF', // Rayso blue - numbers, constants
  type: '#B875FF', // Rayso purple - types
  builtin: '#57A5FF', // Rayso blue - built-ins, variables
  property: '#B875FF', // Rayso purple - object properties, attributes
  operator: '#FF4D84', // Rayso pink - operators
  punctuation: '#a3a3a3', // hsl(0, 0%, 64%) - punctuation
  tag: '#33FF66', // Rayso green - HTML/JSX tags
  variable: '#57A5FF', // Rayso blue - variables
};

/**
 * Syntax highlighting cache with LRU eviction.
 *
 * **Client-side only:** This cache runs in the browser, not in serverless
 * functions. It persists for the lifetime of the page and is cleared on
 * page refresh.
 *
 * **Size limit:** Maximum 100 entries with LRU eviction to prevent
 * unbounded memory growth during long sessions.
 */
const highlightCache = new Map<string, React.ReactNode[]>();
const MAX_CACHE_SIZE = 100;

/**
 * Generate a simple hash code for a string
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Generate cache key for code/language pair
 * Uses hash for long code to keep keys reasonable
 */
function getCacheKey(code: string, language: string): string {
  if (code.length > 500) {
    return `${language}:${hashCode(code)}`;
  }
  return `${language}:${code}`;
}

/**
 * Perform the actual syntax highlighting (expensive operation)
 */
function performHighlighting(code: string, _language: string): React.ReactNode[] {
  const lines = code.split('\n');

  // Geist VSCode theme token scopes mapped to regex patterns
  // @see https://github.com/phiewter/geist-vscode-theme/blob/main/src/theme.js
  const patterns: { regex: RegExp; color: string }[] = [
    // Comments (gray - secondary foreground)
    { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|<!--[\s\S]*?-->)/gm, color: oneDark.comment },

    // Strings - rayso green (string.quoted, string.template)
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, color: oneDark.string },

    // Keywords - rayso pink (keyword.control, storage.type)
    {
      regex:
        /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|export|from|default|async|await|yield|typeof|instanceof|in|of|this|super|static|public|private|protected|interface|type|enum|implements|abstract|readonly|declare|namespace|module|require|as|is|keyof|infer)\b/g,
      color: oneDark.keyword,
    },

    // Constants/Booleans - rayso blue (constant.language, variable.other.constant)
    {
      regex: /\b(null|undefined|true|false|NaN|Infinity)\b/g,
      color: oneDark.variable,
    },

    // Types/Classes - rayso purple (entity.name.type)
    {
      regex: /\b([A-Z][a-zA-Z0-9]*)\b/g,
      color: oneDark.type,
    },

    // Functions - rayso purple (entity.name.function)
    { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, color: oneDark.function },

    // Numbers - rayso blue
    {
      regex: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+)\b/gi,
      color: oneDark.number,
    },

    // JSX Tags - rayso green (entity.name.tag)
    {
      regex: /(<\/?[a-z][a-zA-Z0-9]*)/g,
      color: oneDark.tag,
    },

    // JSX Component tags - rayso blue (support.class.component)
    {
      regex: /(<\/?[A-Z][a-zA-Z0-9]*)/g,
      color: oneDark.variable,
    },

    // Attributes - rayso purple (entity.other.attribute-name)
    {
      regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*=)/g,
      color: oneDark.property,
    },

    // Operators - rayso pink (keyword.operator.assignment, keyword.operator.type.annotation)
    {
      regex: /([=:+\-*/%&|^!<>?]+)/g,
      color: oneDark.operator,
    },

    // Object properties (variable.other.object)
    {
      regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\.)/g,
      color: oneDark.variable,
    },

    // Builtins - rayso blue (support.class.component)
    {
      regex:
        /\b(console|window|document|Math|JSON|Object|Array|String|Number|Boolean|Date|RegExp|Error|Promise|Map|Set|Symbol|Proxy|Reflect|Intl|fetch|setTimeout|setInterval|clearTimeout|clearInterval|parseInt|parseFloat|isNaN|isFinite|encodeURI|decodeURI|eval)\b/g,
      color: oneDark.builtin,
    },
  ];

  return lines.map((line, lineIndex) => {
    // Create segments with their colors
    type Segment = { start: number; end: number; text: string; color: string };
    const segments: Segment[] = [];

    // Find all matches and their positions
    for (const { regex, color } of patterns) {
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(line)) !== null) {
        segments.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          color,
        });
      }
    }

    // Sort by start position, then by length (longer matches first)
    segments.sort((a, b) => a.start - b.start || b.end - a.end);

    // Remove overlapping segments (keep first/longest)
    const filtered: Segment[] = [];
    let lastEnd = 0;
    for (const seg of segments) {
      if (seg.start >= lastEnd) {
        filtered.push(seg);
        lastEnd = seg.end;
      }
    }

    // Build the highlighted line
    const result: React.ReactNode[] = [];
    let pos = 0;
    for (const seg of filtered) {
      if (seg.start > pos) {
        result.push(
          <span key={`${lineIndex}-${pos}`} style={{ color: oneDark.text }}>
            {line.slice(pos, seg.start)}
          </span>
        );
      }
      result.push(
        <span key={`${lineIndex}-${seg.start}`} style={{ color: seg.color }}>
          {seg.text}
        </span>
      );
      pos = seg.end;
    }
    if (pos < line.length) {
      result.push(
        <span key={`${lineIndex}-${pos}`} style={{ color: oneDark.text }}>
          {line.slice(pos)}
        </span>
      );
    }
    if (result.length === 0) {
      result.push(<span key={`${lineIndex}-empty`}>{'\n'}</span>);
    }

    return (
      <span key={lineIndex}>
        {result}
        {lineIndex < lines.length - 1 ? '\n' : ''}
      </span>
    );
  });
}

/**
 * Highlight code with caching for improved performance
 * Cache hit rate should be >90% for completed messages
 */
export function highlightCode(code: string, language: string): React.ReactNode[] {
  const key = getCacheKey(code, language);

  // Check cache first
  const cached = highlightCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // Perform expensive highlighting
  const highlighted = performHighlighting(code, language);

  // LRU eviction - remove oldest entry when cache is full
  if (highlightCache.size >= MAX_CACHE_SIZE) {
    const firstKey = highlightCache.keys().next().value;
    if (firstKey !== undefined) {
      highlightCache.delete(firstKey);
    }
  }

  // Store in cache
  highlightCache.set(key, highlighted);
  return highlighted;
}

interface SyntaxHighlightedCodeProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function SyntaxHighlightedCode({
  code,
  language = '',
  showLineNumbers = false,
}: SyntaxHighlightedCodeProps) {
  const lines = code.split('\n');

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: oneDark.bg }}>
      {language && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs border-b"
          style={{
            backgroundColor: oneDark.bgDark,
            borderColor: '#262626', // Geist gray-700
            color: oneDark.comment,
          }}
        >
          <span>{language}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="font-mono" style={{ color: oneDark.text }}>
          {showLineNumbers ? (
            <table className="border-collapse">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td
                      className="pr-4 text-right select-none"
                      style={{ color: oneDark.comment, minWidth: '2.5rem' }}
                    >
                      {i + 1}
                    </td>
                    <td>{highlightCode(line, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            highlightCode(code, language)
          )}
        </code>
      </pre>
    </div>
  );
}
