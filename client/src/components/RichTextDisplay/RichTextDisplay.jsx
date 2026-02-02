import { sanitizeHtml } from '../../utils/sanitize';
import './RichTextDisplay.css';

export default function RichTextDisplay({ content }) {
  if (!content) return null;

  const sanitized = sanitizeHtml(content);

  return (
    <div
      className="rich-text-display"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
