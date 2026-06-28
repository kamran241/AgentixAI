import ReactMarkdown from 'react-markdown';

export default function MarkdownContent({ content, className }) {
  return (
    <div className={className ?? 'markdown-content'}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
