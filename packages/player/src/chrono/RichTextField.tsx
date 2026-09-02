// packages/player/src/chrono/RichTextField.tsx
// FR-017 ТЗ (форматированное описание события). НЕ переиспользует
// RichTextEditor.tsx из editor-web - тот тянет @tiptap как дерево
// зависимостей конкретно editor-web-приложения (см. заголовочный
// комментарий EventDetailCard.tsx, где решение было явно отложено как
// "нужен пакет компонентов или прямая связь player->editor-web"). Вместо
// общего пакета - собственная, минимальная копия прямо в player: свой
// набор зависимостей (`@tiptap/react`+`starter-kit`+`underline`, БЕЗ
// шрифтов/цвета/выравнивания editor-web - для описания события это
// избыточно), свой маленький тулбар. Тот же принцип осознанного
// дублирования, что и у resetCode.js/masterCode.js (Фаза 4) - две копии
// небольшой, стабильной логики предпочтительнее одного хрупкого общего
// пакета ради единственного потребителя с каждой стороны.
//
// Безопасность содержимого: tiptap/ProseMirror парсит HTML через
// DOMParser и строит документ ТОЛЬКО из узлов/меток, зарегистрированных в
// схеме (StarterKit/Underline) - непризнанные элементы (включая <script>)
// молча отбрасываются при разборе, а не исполняются. Это верно и для
// РЕДАКТИРУЕМОГО, и для readOnly-режима (оба используют один и тот же
// editor.commands.setContent), поэтому нет отдельного пути
// dangerouslySetInnerHTML для "только показать" - и нет необходимости в
// отдельной санитизации через DOMPurify: чужой описание из импортированного
// .chronoline архива безопасно пройдёт тот же самый разбор.

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import './RichTextField.css';

export interface RichTextFieldProps {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

const RichTextField: React.FC<RichTextFieldProps> = ({ value, onChange, readOnly }) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || '<p></p>',
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Внешнее изменение value (например, отмена/повтор действия правит
  // событие снаружи) должно перезагрузить контент редактора - tiptap сам
  // не отслеживает пропс value, только собственное внутреннее состояние.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className={`chrono-rich-text${readOnly ? ' chrono-rich-text--readonly' : ''}`}>
      {!readOnly && (
        <div className="chrono-rich-text__toolbar">
          <button
            type="button"
            className={editor.isActive('bold') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            title="Жирный (Ctrl+B)"
          >
            <b>Ж</b>
          </button>
          <button
            type="button"
            className={editor.isActive('italic') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            title="Курсив (Ctrl+I)"
          >
            <i>К</i>
          </button>
          <button
            type="button"
            className={editor.isActive('underline') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
            title="Подчёркнутый (Ctrl+U)"
          >
            <u>Ч</u>
          </button>
          <button
            type="button"
            className={editor.isActive('strike') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }}
            title="Зачёркнутый"
          >
            <s>S</s>
          </button>
          <span className="chrono-rich-text__divider" />
          <button
            type="button"
            className={editor.isActive('bulletList') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBulletList().run();
            }}
            title="Маркированный список"
          >
            •
          </button>
          <button
            type="button"
            className={editor.isActive('orderedList') ? 'active' : ''}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleOrderedList().run();
            }}
            title="Нумерованный список"
          >
            1.
          </button>
          <span className="chrono-rich-text__divider" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().unsetAllMarks().clearNodes().run();
            }}
            title="Сбросить форматирование"
          >
            ✕
          </button>
        </div>
      )}
      <EditorContent editor={editor} className="chrono-rich-text__content" />
    </div>
  );
};

export default RichTextField;
