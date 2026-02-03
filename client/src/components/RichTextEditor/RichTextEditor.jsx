import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState, useMemo } from 'react';
import './RichTextEditor.css';

const EMOJI_LIST = ['👍', '👎', '❤️', '🎉', '🔥', '⚠️', '❌', '✅', '⭐', '🐛', '💡', '📝'];

export default function RichTextEditor({ value, onChange, placeholder }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);
  const isInternalChange = useRef(false);
  const lastExternalValue = useRef(value);

  // Memoize extensions to prevent recreation on every render
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      horizontalRule: false,
    }),
    Underline,
    Placeholder.configure({
      placeholder: placeholder || 'Enter text...',
    }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: value || '',
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      const html = editor.getHTML();
      // Return empty string if editor only contains empty paragraph
      const isEmpty = html === '<p></p>' || html === '';
      onChange(isEmpty ? '' : html);
    },
  });

  // Sync external value changes (only when value actually changed externally)
  useEffect(() => {
    // Skip if change originated from editor typing
    if (isInternalChange.current) {
      isInternalChange.current = false;
      lastExternalValue.current = value;
      return;
    }

    // Only update if value actually changed from external source
    if (editor && value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      const isEmpty = !value || value === '<p></p>';
      const editorEmpty = editor.getHTML() === '<p></p>';
      if (isEmpty && editorEmpty) return;
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  const insertEmoji = (emoji) => {
    editor.chain().focus().insertContent(emoji).run();
    setShowEmojiPicker(false);
  };

  return (
    <div className="rich-text-editor">
      <div className="rte-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rte-btn ${editor.isActive('bold') ? 'active' : ''}`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rte-btn ${editor.isActive('italic') ? 'active' : ''}`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rte-btn ${editor.isActive('underline') ? 'active' : ''}`}
          title="Underline"
        >
          <u>U</u>
        </button>
        <div className="rte-emoji-wrapper" ref={emojiRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`rte-btn ${showEmojiPicker ? 'active' : ''}`}
            title="Insert emoji"
          >
            😀
          </button>
          {showEmojiPicker && (
            <div className="rte-emoji-picker">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="rte-emoji-btn"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
}
