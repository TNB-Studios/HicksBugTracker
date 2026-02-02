import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span'];
const ALLOWED_ATTR = ['class', 'style'];

export function sanitizeHtml(html) {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function stripHtml(html) {
  if (!html) return '';

  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  return div.textContent || div.innerText || '';
}
