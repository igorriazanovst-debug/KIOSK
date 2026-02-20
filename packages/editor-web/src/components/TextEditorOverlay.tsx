import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Extension } from '@tiptap/core';
import './TextEditorOverlay.css';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { fontSize: {
      default: null,
      parseHTML: (el: HTMLElement) => el.style.fontSize?.replace('px', '') || null,
      renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}px` } : {},
    }}}];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: { lineHeight: {
      default: null,
      parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
      renderHTML: (attrs: any) => attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
    }}}];
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: any) =>
        commands.updateAttributes('paragraph', { lineHeight }),
    } as any;
  },
});

const FONTS = ['Lato', 'Lobster', 'Montserrat', 'Nunito', 'Open Sans', 'Oswald', 'PT Sans', 'PT Serif', 'Pacifico', 'Raleway', 'Roboto', 'Ubuntu'];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
const LINE_HEIGHTS = ['1', '1.2', '1.4', '1.5', '1.6', '1.8', '2', '2.5', '3'];

interface TextEditorOverlayProps {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  initialHtml: string;
  onClose: (html: string) => void;
}

const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({
  x, y, width, height, zoom, initialHtml, onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      FontFamily,
      FontSize,
      LineHeight,
      Subscript,
      Superscript,
    ],
    content: initialHtml || '<p></p>',
    autofocus: true,
  });

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (editor) onClose(editor.getHTML());
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleMouseDown); };
  }, [editor, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editor) onClose(editor.getHTML());
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editor, onClose]);

  if (!editor) return null;

  const left = x * zoom;
  const top = y * zoom;
  const w = width * zoom;
  const h = height * zoom;

  return (
    <div ref={containerRef} className="text-editor-overlay" style={{ left, top, width: w, minHeight: h }}>
      <div className="teo-toolbar">
        {/* Font family */}
        <select className="teo-select teo-select-lg" title="Шрифт"
          onChange={(e) => (editor.chain().focus() as any).setFontFamily(e.target.value).run()}
          defaultValue="">
          <option value="" disabled>Шрифт</option>
          {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>

        {/* Font size */}
        <select className="teo-select teo-select-sm" title="Размер"
          onChange={(e) => (editor.chain().focus() as any).setFontSize(e.target.value).run()}
          defaultValue="">
          <option value="" disabled>Пт</option>
          {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}</option>)}
        </select>

        <div className="teo-divider" />

        {/* Bold */}
        <button className={`teo-btn ${editor.isActive('bold') ? 'active' : ''}`} title="Жирный"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleBold().run(); }}>
          <b>B</b>
        </button>

        {/* Italic */}
        <button className={`teo-btn ${editor.isActive('italic') ? 'active' : ''}`} title="Курсив"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleItalic().run(); }}>
          <i>I</i>
        </button>

        {/* Underline */}
        <button className={`teo-btn ${editor.isActive('underline') ? 'active' : ''}`} title="Подчёркнутый"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleUnderline().run(); }}>
          <u>U</u>
        </button>

        {/* Strike */}
        <button className={`teo-btn ${editor.isActive('strike') ? 'active' : ''}`} title="Зачёркнутый"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleStrike().run(); }}>
          <s>S</s>
        </button>

        {/* Subscript */}
        <button className={`teo-btn ${editor.isActive('subscript') ? 'active' : ''}`} title="Подстрочный"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleSubscript().run(); }}>
          X<sub>2</sub>
        </button>

        {/* Superscript */}
        <button className={`teo-btn ${editor.isActive('superscript') ? 'active' : ''}`} title="Надстрочный"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleSuperscript().run(); }}>
          X<sup>2</sup>
        </button>

        <div className="teo-divider" />

        {/* Text color */}
        <label className="teo-color-label" title="Цвет текста">
          <span style={{ borderBottom: '3px solid #333', lineHeight: 1 }}>A</span>
          <input type="color" onInput={(e) => (editor.chain().focus() as any).setColor((e.target as HTMLInputElement).value).run()} />
        </label>

        {/* Highlight */}
        <label className="teo-color-label" title="Фон текста">
          <span style={{ background: '#ff0', padding: '0 2px' }}>H</span>
          <input type="color" defaultValue="#ffff00" onInput={(e) => (editor.chain().focus() as any).toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()} />
        </label>

        <div className="teo-divider" />

        {/* Align left */}
        <button className={`teo-btn ${(editor as any).isActive({ textAlign: 'left' }) ? 'active' : ''}`} title="По левому краю"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('left').run(); }}>
          &#8676;
        </button>

        {/* Align center */}
        <button className={`teo-btn ${(editor as any).isActive({ textAlign: 'center' }) ? 'active' : ''}`} title="По центру"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('center').run(); }}>
          &#8801;
        </button>

        {/* Align right */}
        <button className={`teo-btn ${(editor as any).isActive({ textAlign: 'right' }) ? 'active' : ''}`} title="По правому краю"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('right').run(); }}>
          &#8677;
        </button>

        {/* Align justify */}
        <button className={`teo-btn ${(editor as any).isActive({ textAlign: 'justify' }) ? 'active' : ''}`} title="По ширине"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).setTextAlign('justify').run(); }}>
          &#8803;
        </button>

        <div className="teo-divider" />

        {/* Bullet list */}
        <button className={`teo-btn ${editor.isActive('bulletList') ? 'active' : ''}`} title="Маркированный список"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleBulletList().run(); }}>
          •≡
        </button>

        {/* Ordered list */}
        <button className={`teo-btn ${editor.isActive('orderedList') ? 'active' : ''}`} title="Нумерованный список"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).toggleOrderedList().run(); }}>
          1≡
        </button>

        <div className="teo-divider" />

        {/* Line height */}
        <select className="teo-select teo-select-sm" title="Межстрочный интервал"
          onChange={(e) => (editor.chain().focus() as any).setLineHeight(e.target.value).run()}
          defaultValue="">
          <option value="" disabled>↕</option>
          {LINE_HEIGHTS.map(lh => <option key={lh} value={lh}>{lh}</option>)}
        </select>

        <div className="teo-divider" />

        {/* Clear formatting */}
        <button className="teo-btn" title="Сбросить форматирование"
          onMouseDown={(e) => { e.preventDefault(); (editor.chain().focus() as any).clearNodes().unsetAllMarks().run(); }}>
          ✕
        </button>

        {/* Done */}
        <button className="teo-btn teo-btn-done" title="Готово (Esc)"
          onMouseDown={(e) => { e.preventDefault(); onClose(editor.getHTML()); }}>
          ✓
        </button>
      </div>
      <EditorContent editor={editor} className="teo-content" />
    </div>
  );
};

export default TextEditorOverlay;
