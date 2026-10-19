import type { Editor } from "@tiptap/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./editor";

const LABEL = "Lesson body";

async function renderEditor(props: Partial<ComponentProps<typeof RichTextEditor>> = {}) {
  const onChange = vi.fn();
  // Held in an object: TypeScript does not track assignments made inside the
  // onReady callback on a plain `let`.
  const handle: { current: Editor | null } = { current: null };

  render(
    <RichTextEditor
      ariaLabel={LABEL}
      onChange={onChange}
      onReady={(instance) => {
        handle.current = instance;
      }}
      {...props}
    />,
  );

  const textbox = await screen.findByRole("textbox", { name: LABEL });
  await waitFor(() => {
    if (!handle.current) throw new Error("editor not ready");
  });

  const editor = handle.current;
  if (!editor) throw new Error("editor not ready");
  return { editor, onChange, textbox };
}

describe("RichTextEditor", () => {
  it("renders the initial html in a labelled textbox", async () => {
    const { textbox } = await renderEditor({ value: "<h2>Intro</h2><p>Hello there</p>" });

    expect(textbox).toHaveTextContent("Hello there");
    expect(textbox.querySelector("h2")?.textContent).toBe("Intro");
  });

  it("reports document changes as html", async () => {
    const { editor, onChange } = await renderEditor();

    editor.commands.insertContent("Hello");
    expect(onChange).toHaveBeenCalledWith("<p>Hello</p>");
  });

  it("toggles marks and nodes from the toolbar", async () => {
    const { editor } = await renderEditor({ value: "<p>text</p>" });

    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(bold);
    expect(editor.isActive("bold")).toBe(true);
    await waitFor(() => expect(bold).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(bold);
    expect(editor.isActive("bold")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Heading 2" }));
    expect(editor.isActive("heading", { level: 2 })).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));
    expect(editor.isActive("bulletList")).toBe(true);
  });

  it("disables undo until the document changes", async () => {
    const { editor } = await renderEditor();
    const undo = screen.getByRole("button", { name: "Undo" });

    expect(undo).toBeDisabled();

    editor.commands.insertContent("typed");
    await waitFor(() => expect(undo).toBeEnabled());
  });

  it("replaces the document when the value prop changes", async () => {
    const view = render(<RichTextEditor ariaLabel={LABEL} value="<p>First</p>" />);
    const textbox = await screen.findByRole("textbox", { name: LABEL });
    expect(textbox).toHaveTextContent("First");

    view.rerender(<RichTextEditor ariaLabel={LABEL} value="<p>Second</p>" />);
    await waitFor(() => expect(textbox).toHaveTextContent("Second"));
  });

  it("stays read-only when editable is false", async () => {
    const { textbox } = await renderEditor({ value: "<p>Fixed</p>", editable: false });
    expect(textbox).toHaveAttribute("contenteditable", "false");
  });

  it("omits the toolbar when showToolbar is false", async () => {
    await renderEditor({ showToolbar: false });
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
  });

  it("shows the placeholder only while the document is empty", async () => {
    const { editor } = await renderEditor({ placeholder: "Write the lesson body" });

    expect(screen.getByText("Write the lesson body")).toBeInTheDocument();

    editor.commands.insertContent("content");
    await waitFor(() => expect(screen.queryByText("Write the lesson body")).toBeNull());
  });
});
