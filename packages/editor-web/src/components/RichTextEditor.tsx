import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

// Custom FontSize extension
import { Extension } from '@tiptap/core';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize?.replace('px', '') || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}px` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: size }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    } as any;
  },
});

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
      FontSize,
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', false);
    }
  }, [value]);

  if (!editor) return null;

  const setFontSize = (size: string) => {
    (editor.chain().focus() as any).setFontSize(size).run();
  };

  return (
    <div className="rich-text-editor">
      {/* Toolbar */}
      <div className="rte-toolbar">
        {/* Font family */}
        <select
          className="rte-select"
          title="Шрифт"
          onChange={(e) => (editor.chain().focus() as any).setFontFamily(e.target.value).run()}
          value=""
        >
          <option value="" disabled>Шрифт</option>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Font size */}
        <select
          className="rte-select rte-select-sm"
          title="Размер"
          onChange={(e) => setFontSize(e.target.value)}
          value=""
        >
          <option value="" disabled>Пт</option>
          {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}</option>)}
        </select>

        <div className="rte-divider" />

        {/* Bold */}
        <button
          className={`rte-btn ${editor.isActive('bold') ? 'active' : ''}`}
          title="Жирный (Ctrl+B)"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleBold().run(); }}
        ><b>B</b></button>

        {/* Italic */}
        <button
          className={`rte-btn ${editor.isActive('italic') ? 'active' : ''}`}
          title="Курсив (Ctrl+I)"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleItalic().run(); }}
        ><i>I</i></button>

        {/* Underline */}
        <button
          className={`rte-btn ${editor.isActive('underline') ? 'active' : ''}`}
          title="Подчёркнутый (Ctrl+U)"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleUnderline().run(); }}
        ><u>U</u></button>

        {/* Strike */}
        <button
          className={`rte-btn ${editor.isActive('strike') ? 'active' : ''}`}
          title="Зачёркнутый"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleStrike().run(); }}
        ><s>S</s></button>

        <div className="rte-divider" />

        {/* Text color */}
        <label className="rte-color-label" title="Цвет текста">
          <span style={{ borderBottom: '3px solid currentColor' }}>A</span>
          <input
            type="color"
            className="rte-color-input"
            onInput={(e) => (editor.chain().focus() as any).setColor((e.target as HTMLInputElement).value).run()}
          />
        </label>

        {/* Highlight */}
        <label className="rte-color-label" title="Цвет фона текста">
          <span style={{ background: '#ff0', padding: '0 2px' }}>H</span>
          <input
            type="color"
            className="rte-color-input"
            defaultValue="#ffff00"
            onInput={(e) => (editor.chain().focus() as any).toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
          />
        </label>

        <div className="rte-divider" />

        {/* Align left */}
        <button
          className={`rte-btn ${(editor as any).isActive({ textAlign: 'left' }) ? 'active' : ''}`}
          title="По левому краю"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('left').run(); }}
        >≡</button>

        {/* Align center */}
        <button
          className={`rte-btn ${(editor as any).isActive({ textAlign: 'center' }) ? 'active' : ''}`}
          title="По центру"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('center').run(); }}
        >≡</button>

        {/* Align right */}
        <button
          className={`rte-btn ${(editor as any).isActive({ textAlign: 'right' }) ? 'active' : ''}`}
          title="По правому краю"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('right').run(); }}
        >≡</button>

        <div className="rte-divider" />

        {/* Clear formatting */}
        <button
          className="rte-btn"
          title="Сбросить форматирование"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).clearNodes().unsetAllMarks().run(); }}
        >✕</button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};

export default RichTextEditor;
