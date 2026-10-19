"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef } from "react";

/** Stable across renders: TipTap treats a new array as a new configuration. */
const EXTENSIONS = [StarterKit];

const CONTENT_CLASS = [
  "min-h-40 px-4 py-3 text-sm leading-7 outline-none",
  "[&_p]:my-2",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-600",
  "dark:[&_blockquote]:border-zinc-700 dark:[&_blockquote]:text-zinc-400",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs",
  "dark:[&_pre]:bg-zinc-900",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "dark:[&_code]:bg-zinc-900",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-4 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800",
  "[&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400",
].join(" ");

const CONTENT_ATTRIBUTES: Record<string, string> = {
  class: CONTENT_CLASS,
  role: "textbox",
  "aria-multiline": "true",
  "data-editor-content": "",
};

const TOOLBAR_BUTTON_CLASS = [
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors",
  "hover:bg-zinc-100 hover:text-zinc-900",
  "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-600",
  "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
].join(" ");

const TOOLBAR_BUTTON_ACTIVE_CLASS = "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

const TOOLBAR_GROUP_CLASS =
  "[&:not(:first-child)]:border-l [&:not(:first-child)]:border-zinc-200 [&:not(:first-child)]:pl-2 dark:[&:not(:first-child)]:border-zinc-800";

export interface EditorSnapshot {
  isEmpty: boolean;
  paragraph: boolean;
  heading2: boolean;
  heading3: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

type ToolbarActionId = Exclude<keyof EditorSnapshot, "isEmpty">;

interface ToolbarAction {
  id: ToolbarActionId;
  label: string;
  Icon: LucideIcon;
  kind: "toggle" | "command";
  run: (editor: Editor) => void;
  isDisabled?: (snapshot: EditorSnapshot) => boolean;
}

const TOOLBAR_GROUPS: readonly { id: string; actions: readonly ToolbarAction[] }[] = [
  {
    id: "blocks",
    actions: [
      {
        id: "paragraph",
        label: "Paragraph",
        Icon: Pilcrow,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().setParagraph().run();
        },
      },
      {
        id: "heading2",
        label: "Heading 2",
        Icon: Heading2,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        },
      },
      {
        id: "heading3",
        label: "Heading 3",
        Icon: Heading3,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        },
      },
    ],
  },
  {
    id: "marks",
    actions: [
      {
        id: "bold",
        label: "Bold",
        Icon: Bold,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleBold().run();
        },
      },
      {
        id: "italic",
        label: "Italic",
        Icon: Italic,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleItalic().run();
        },
      },
      {
        id: "underline",
        label: "Underline",
        Icon: Underline,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleUnderline().run();
        },
      },
      {
        id: "strike",
        label: "Strikethrough",
        Icon: Strikethrough,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleStrike().run();
        },
      },
      {
        id: "code",
        label: "Inline code",
        Icon: Code,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleCode().run();
        },
      },
    ],
  },
  {
    id: "lists",
    actions: [
      {
        id: "bulletList",
        label: "Bullet list",
        Icon: List,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleBulletList().run();
        },
      },
      {
        id: "orderedList",
        label: "Numbered list",
        Icon: ListOrdered,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleOrderedList().run();
        },
      },
      {
        id: "blockquote",
        label: "Quote",
        Icon: Quote,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleBlockquote().run();
        },
      },
      {
        id: "codeBlock",
        label: "Code block",
        Icon: SquareCode,
        kind: "toggle",
        run: (editor) => {
          editor.chain().focus().toggleCodeBlock().run();
        },
      },
    ],
  },
  {
    id: "history",
    actions: [
      {
        id: "canUndo",
        label: "Undo",
        Icon: Undo2,
        kind: "command",
        run: (editor) => {
          editor.chain().focus().undo().run();
        },
        isDisabled: (snapshot) => !snapshot.canUndo,
      },
      {
        id: "canRedo",
        label: "Redo",
        Icon: Redo2,
        kind: "command",
        run: (editor) => {
          editor.chain().focus().redo().run();
        },
        isDisabled: (snapshot) => !snapshot.canRedo,
      },
    ],
  },
];

function selectEditorSnapshot({ editor }: { editor: Editor }): EditorSnapshot {
  return {
    isEmpty: editor.isEmpty,
    paragraph: editor.isActive("paragraph"),
    heading2: editor.isActive("heading", { level: 2 }),
    heading3: editor.isActive("heading", { level: 3 }),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockquote: editor.isActive("blockquote"),
    codeBlock: editor.isActive("codeBlock"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

export interface RichTextEditorProps {
  /** Initial HTML. Later changes replace the document; the editor never sanitizes on its own. */
  value?: string;
  /** Receives the current HTML on every document change. Run it through `sanitizeHtml` before storing or rendering. */
  onChange?: (html: string) => void;
  /** Called once with the editor instance, for consumers that need commands or the document JSON. */
  onReady?: (editor: Editor) => void;
  editable?: boolean;
  placeholder?: string;
  showToolbar?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface EditorSurfaceProps {
  editor: Editor;
  editable: boolean;
  placeholder: string | undefined;
  showToolbar: boolean;
  className: string | undefined;
}

function EditorSurface({
  editor,
  editable,
  placeholder,
  showToolbar,
  className,
}: EditorSurfaceProps) {
  const snapshot = useEditorState({ editor, selector: selectEditorSnapshot });

  return (
    <div
      data-editor-root
      className={[
        "rounded-md border border-zinc-200 bg-white transition-colors focus-within:border-zinc-400",
        "dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-600",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showToolbar ? (
        <div
          data-editor-toolbar
          className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800"
        >
          {TOOLBAR_GROUPS.map((group) => (
            <div key={group.id} className={`flex items-center gap-0.5 ${TOOLBAR_GROUP_CLASS}`}>
              {group.actions.map((action) => {
                const isActive = action.kind === "toggle" ? snapshot[action.id] : undefined;
                return (
                  <button
                    key={action.id}
                    type="button"
                    aria-label={action.label}
                    aria-pressed={isActive}
                    disabled={action.isDisabled?.(snapshot) ?? false}
                    className={[TOOLBAR_BUTTON_CLASS, isActive ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => action.run(editor)}
                  >
                    <action.Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        {editable && placeholder && snapshot.isEmpty ? (
          <p
            data-editor-placeholder
            aria-hidden="true"
            className="pointer-events-none absolute top-3 left-4 text-sm text-zinc-400"
          >
            {placeholder}
          </p>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onReady,
  editable = true,
  placeholder,
  showToolbar = true,
  className,
  ariaLabel = "Rich text",
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onChangeRef.current = onChange;
    onReadyRef.current = onReady;
  }, [onChange, onReady]);

  const editor = useEditor(
    {
      extensions: EXTENSIONS,
      content: value ?? "",
      // The app server-renders; render nothing on the server and mount on the client.
      immediatelyRender: false,
      editorProps: {
        attributes: { ...CONTENT_ATTRIBUTES, "aria-label": ariaLabel },
      },
      onUpdate: ({ editor: instance }) => {
        onChangeRef.current?.(instance.getHTML());
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    onReadyRef.current?.(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor || value === undefined) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
    // TipTap reads these attributes from ProseMirror props only at creation.
    editor.view.dom.setAttribute("aria-label", ariaLabel);
  }, [editor, editable, ariaLabel]);

  if (!editor) {
    return (
      <div
        data-editor-root
        aria-busy="true"
        className={[
          "min-h-40 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return (
    <EditorSurface
      editor={editor}
      editable={editable}
      placeholder={placeholder}
      showToolbar={showToolbar}
      className={className}
    />
  );
}

export default RichTextEditor;
