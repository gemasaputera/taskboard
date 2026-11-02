import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

const proseClasses = [
  'prose prose-sm max-w-none text-[13.5px] leading-relaxed text-ink/90',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  'prose-h1:mb-1.5 prose-h1:mt-4 prose-h1:text-[18px] prose-h1:font-semibold prose-h1:leading-snug prose-h1:text-ink',
  'prose-h2:mb-1.5 prose-h2:mt-4 prose-h2:text-[15px] prose-h2:font-semibold prose-h2:leading-snug prose-h2:text-ink',
  'prose-h3:mb-1 prose-h3:mt-3 prose-h3:text-[13.5px] prose-h3:font-semibold prose-h3:text-ink',
  'prose-h4:mb-1 prose-h4:mt-3 prose-h4:text-[13px] prose-h4:font-semibold prose-h4:text-ink',
  'prose-p:my-2',
  'prose-a:font-medium prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
  'prose-strong:font-semibold prose-strong:text-ink',
  'prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5 prose-li:my-0.5',
  'prose-blockquote:my-3 prose-blockquote:border-l-2 prose-blockquote:border-accent/40 prose-blockquote:pl-3 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-muted',
  'prose-code:rounded prose-code:bg-surface-soft prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[12px] prose-code:font-normal prose-code:text-ink prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border prose-pre:border-line prose-pre:bg-surface-soft prose-pre:p-3 prose-pre:text-[12px] prose-pre:text-ink',
  'prose-hr:my-4 prose-hr:border-line',
  'prose-table:my-3 prose-table:text-xs prose-th:border prose-th:border-line prose-th:bg-surface-soft prose-th:p-1.5 prose-th:text-left prose-td:border prose-td:border-line prose-td:p-1.5',
  'prose-img:my-3 prose-img:max-h-96 prose-img:rounded-lg prose-img:border prose-img:border-line',
].join(' ');

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('markdown', proseClasses, className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children, title }) => (
            <a
              href={href}
              title={title}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words"
            >
              {children}
            </a>
          ),
          img: ({ src, alt, title }) => (
            <img src={src} alt={alt ?? ''} title={title} loading="lazy" />
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
