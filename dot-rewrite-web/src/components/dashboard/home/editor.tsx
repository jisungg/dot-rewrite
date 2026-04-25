"use client";

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react";
import {
  ChevronDown,
  Info,
  ExternalLink,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrism from "rehype-prism-plus";
import remarkEmoji from "remark-emoji";
import remarkToc from "remark-toc";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import "@/data/css/prism.css";
import type { Space, Note, Profile } from "@/data/types";
import {
  fetchProfileByEmail,
  saveNoteAndConnectToSpace,
} from "@/utils/supabase/queries";
import { markdownComponents } from "@/lib/markdown-components";
import { truncate } from "@/lib/string";

const triple = "```js";
const tripleend = "```";

const scrollbarHideStyles = `
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

const testMarkdownText = `
# Markdown Tutorial

Welcome to the **Markdown Tutorial**. This guide teaches you how to write Markdown and see it rendered live.

---

## Headings

Use the \`#\` symbol for headings. More \`#\` characters mean a smaller heading.

**Example Syntax:**
${triple}
# Heading 1
## Heading 2
### Heading 3
${tripleend}

**Rendered:**

# Heading 1
## Heading 2
### Heading 3

---

## Basic Text Formatting

**Bold:**
  Wrap text with \`**double asterisks**\` or \`__double underscores__\`.

**Example:**
${triple}
**This is bold text**
${tripleend}

*Italic:*
  Wrap text with \`*single asterisks*\` or \`_single underscores_\`.

  **Example:**
${triple}
*This is italic text*
${tripleend}

~~Strikethrough:~~
  Wrap text with \`~~double tildes~~\`.

  **Example:**
${triple}
~~This is strikethrough~~
${tripleend}

---

## Lists

### Unordered List

Use hyphens (\`-\`), pluses (\`+\`), or asterisks (\`*\`).

**Example Syntax:**
${triple}
- Item 1
- Item 2
  - Nested Item A
  - Nested Item B
${tripleend}

**Rendered:**

- Item 1
- Item 2
  - Nested Item A
  - Nested Item B

### Ordered List

Number your items.

**Example Syntax:**
${triple}
1. First item
2. Second item
   1. Sub-item A
   2. Sub-item B
${tripleend}

**Rendered:**

1. First item
2. Second item
   1. Sub-item A
   2. Sub-item B

---

## Links and Images

### Links

Use the syntax \`[Link Text](URL)\` to create a link.

**Example Syntax:**
${triple}
[.note](https://(dot)note.com)
${tripleend}

**Rendered:**

[.note](https://(dot)note.com)

### Images

Embed images with \`![Alt Text](Image URL "Optional Title")\`.

**Example Syntax:**
${triple}
![Placeholder Image](https://via.placeholder.com/200x100 "Placeholder Image")
${tripleend}

**Rendered:**

![Placeholder Image](https://images.unsplash.com/photo-1742063730527-ef243ba6fb50?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D "Placeholder Image")

---

## Blockquotes

Prefix text with a greater-than symbol (\`>\`) for blockquotes.

**Example Syntax:**
${triple}
> This is a blockquote.
>
> It spans multiple lines.
${tripleend}

**Rendered:**

> This is a blockquote.
>
> It spans multiple lines.

---

## Horizontal Rule

Insert a horizontal rule using three or more hyphens.

**Example Syntax:**
${triple}
This is the end to a chapter.
(mind the gap; a space is needed between the first line and the horizontal rule)
---
This is the start to another chapter.
${tripleend}

**Rendered:**

This is the end to a chapter.

---

This is the start to another chapter.

## Code Blocks

For code blocks, use triple backtick and specify the language for future reference. Triple backticks without a specified language will render as inline code.

**Example Syntax:**
${triple}
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet("World"));
${tripleend}

**Rendered:**

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet("World"));
\`\`\`

---

## Inline Code

Wrap inline code with single backticks.

**Example Syntax:**
${triple}
Here is some inline code: \`print("Hello World")\`
${tripleend}

**Rendered:**

Here is some inline code: \`print("Hello World")\`

---

## Tables

Create tables using pipes (\`|\`) and hyphens.

**Example Syntax:**
${triple}
| Name    | Age | City          |
| ------- | --- | ------------- |
| Alice   | 30  | New York      |
| Bob     | 25  | San Francisco |
| Charlie | 35  | London        |
${tripleend}

**Rendered:**

| Name    | Age | City          |
| ------- | --- | ------------- |
| Alice   | 30  | New York      |
| Bob     | 25  | San Francisco |
| Charlie | 35  | London        |

---

## Math Expressions

### Inline Math

Wrap inline math in single dollar signs.

**Example Syntax:**
${triple}
Inline math: $E = mc^2$
${tripleend}

**Rendered:**

Inline math: $E = mc^2$

### Display Math

Wrap display math in double dollar signs.

**Example Syntax:**
${triple}
$$
\\int_{0}^{\\infty} e^{-x}\\, dx = 1
$$
${tripleend}

**Rendered:**

$$
\\int_{0}^{\\infty} e^{-x}\\, dx = 1
$$

---

## Emoji Support

Use emoji shortcodes to include emojis.

**Example Syntax:**
${triple}
:smile: :rocket: :heart:
${tripleend}

**Rendered:**

:smile: :rocket: :heart:

`;

const remarkPlugins = [remarkGfm, remarkEmoji, remarkToc, remarkMath];
const rehypePlugins: import("unified").PluggableList = [
  rehypeHighlight,
  rehypeSanitize,
  rehypeKatex,
  [rehypePrism, { ignoreMissing: true }],
];

export type EditorApi = {
  dirty: boolean;
  save: () => Promise<void>;
  discard: () => void;
};

export default function Editor({
  user,
  allSpaces,
  allNotes,
  noteContent,
  spaceLinked,
  onNoteSaved,
  apiRef,
}: {
  user: User;
  allSpaces: Space[];
  allNotes: Note[];
  noteContent?: Note;
  spaceLinked?: Space;
  onNoteSaved?: (note: Note) => void;
  apiRef?: MutableRefObject<EditorApi | null>;
}) {
  const initialSpace = spaceLinked ?? allSpaces[0];

  const initialSnapshot = useRef({
    content: noteContent?.content ?? "",
    title: noteContent?.title ?? "Untitled Note",
    tags: noteContent?.tags ?? [],
    spaceId: (spaceLinked ?? allSpaces[0])?.id ?? "",
  });

  const [note, setNote] = useState<string>(noteContent?.content ?? "");
  const [saved, setSaved] = useState<boolean>(true);
  const [noteTitle, setNoteTitle] = useState<string>(
    noteContent?.title ?? "Untitled Note",
  );
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isTitleDuplicate, setIsTitleDuplicate] = useState(false);
  const [isSpacesOpen, setIsSpacesOpen] = useState(false);
  const [currentSpace, setCurrentSpace] = useState<Space | undefined>(
    initialSpace,
  );
  const [, setProfile] = useState<Profile | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [tags, setTags] = useState<string[]>(noteContent?.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const checkTitleDuplicate = useCallback(
    (title: string) => {
      if (!currentSpace) {
        setIsTitleDuplicate(false);
        return;
      }
      const lowerTitle = title.toLowerCase();
      const isDuplicate = allNotes.some(
        (n) =>
          n.space_id === currentSpace.id &&
          n.title.toLowerCase() === lowerTitle,
      );
      setIsTitleDuplicate(isDuplicate);
    },
    [allNotes, currentSpace],
  );

  useEffect(() => {
    if (!noteContent) {
      const savedNotes = localStorage.getItem("quick-notes");
      const savedTitle = localStorage.getItem("quick-notes-title");
      const savedSpace = localStorage.getItem("quick-notes-space");
      const savedTags = localStorage.getItem("quick-notes-tags");
      let restoredSpaceId = initialSnapshot.current.spaceId;
      let restoredTags: string[] = initialSnapshot.current.tags;
      if (savedNotes) setNote(savedNotes);
      if (savedTitle) setNoteTitle(savedTitle);
      if (savedSpace) {
        try {
          const parsed = JSON.parse(savedSpace) as Space;
          setCurrentSpace(parsed);
          restoredSpaceId = parsed?.id ?? restoredSpaceId;
        } catch (e) {
          console.error("Error parsing saved space", e);
        }
      }
      if (savedTags) {
        try {
          const parsed = JSON.parse(savedTags) as string[];
          setTags(parsed);
          restoredTags = parsed;
        } catch (e) {
          console.error("Error parsing saved tags", e);
        }
      }
      initialSnapshot.current = {
        content: savedNotes ?? "",
        title: savedTitle ?? "Untitled Note",
        tags: restoredTags,
        spaceId: restoredSpaceId,
      };
    }
  }, [noteContent]);

  useEffect(() => {
    const fetchAndAssignProfile = async () => {
      if (!user || !user.email) {
        redirect("/sign-in");
      }
      try {
        const fetchedProfile = await fetchProfileByEmail(user.email);
        setProfile(fetchedProfile);
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchAndAssignProfile();
  }, [user]);

  useEffect(() => {
    checkTitleDuplicate(noteTitle);
  }, [noteTitle, currentSpace, checkTitleDuplicate]);

  const saveNote = useCallback(() => {
    localStorage.setItem("quick-notes", note);
    localStorage.setItem("quick-notes-title", noteTitle);
    if (currentSpace) {
      localStorage.setItem("quick-notes-space", JSON.stringify(currentSpace));
    }
    localStorage.setItem("quick-notes-tags", JSON.stringify(tags));
    setSaved(true);
  }, [note, noteTitle, currentSpace, tags]);

  useEffect(() => {
    if (!saved) {
      const saveTimer = setTimeout(saveNote, 3000);
      return () => clearTimeout(saveTimer);
    }
  }, [saved, saveNote]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
    setSaved(false);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteTitle(e.target.value);
    setSaved(false);
  };

  const handleTitleBlur = () => {
    setIsTitleFocused(false);
    saveNote();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") titleInputRef.current?.blur();
  };

  const handleEditorScroll = () => {
    if (editorRef.current && previewRef.current) {
      const editorScrollPercentage =
        editorRef.current.scrollTop /
        (editorRef.current.scrollHeight - editorRef.current.clientHeight);
      previewRef.current.scrollTop =
        editorScrollPercentage *
        (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveNote();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsSpacesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSpace = (space: Space) => {
    setCurrentSpace(space);
    setIsSpacesOpen(false);
  };

  const toggleInfo = () => setShowInfo(!showInfo);

  const saveToSpace = useCallback(async () => {
    if (!currentSpace) return;
    const savedNote = await saveNoteAndConnectToSpace({
      id: noteContent?.id,
      space_id: currentSpace.id,
      title: noteTitle,
      content: note,
      tags,
    });
    onNoteSaved?.(savedNote);

    setNote("");
    setNoteTitle("");
    setTags([]);

    localStorage.setItem("quick-notes", "");
    localStorage.setItem("quick-notes-title", "Untitled note");
    localStorage.setItem("quick-notes-tags", JSON.stringify([]));

    const successElement = document.getElementById("save-success");
    if (successElement) {
      successElement.classList.remove("opacity-0");
      successElement.classList.add("opacity-100");
      setTimeout(() => {
        successElement.classList.remove("opacity-100");
        successElement.classList.add("opacity-0");
      }, 2000);
    }
  }, [currentSpace, noteTitle, note, tags, onNoteSaved, noteContent?.id]);

  const handleHoldComplete = useCallback(async () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    await saveToSpace();
    setIsHolding(false);
    setHoldProgress(0);
  }, [saveToSpace]);

  const handleHoldStart = () => {
    if (!canSaveToSpace) return;
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    const holdDuration = 1500;
    holdTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / holdDuration, 1);
      setHoldProgress(progress);
      if (progress >= 1) await handleHoldComplete();
    }, 10);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const normalizedTag = newTag.trim().toLowerCase();
      const tagExists = tags.some((tag) => tag.toLowerCase() === normalizedTag);
      if (!tagExists) {
        setTags([...tags, normalizedTag]);
        setSaved(false);
      }
      setNewTag("");
    }
    setIsAddingTag(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddTag();
    else if (e.key === "Escape") {
      setIsAddingTag(false);
      setNewTag("");
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
    setSaved(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  const isEffectivelyEmpty =
    note.trim() === "" &&
    (noteTitle.trim() === "" || noteTitle === "Untitled Note") &&
    tags.length === 0;

  // Normalize whitespace so edits that only add/remove spaces, tabs, or
  // trailing newlines don't count as a real change:
  //   - Collapse runs of spaces/tabs within a line to one space
  //   - Strip trailing whitespace from every line
  //   - Collapse 3+ consecutive blank lines to 2
  //   - Trim the whole thing
  // Paragraph breaks (single blank line) are preserved because they matter
  // for rendered markdown and for the engine's section parser.
  const normalizeContent = (s: string) =>
    s
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  const normalizeTitle = (s: string) => s.replace(/\s+/g, " ").trim();

  const contentChanged =
    normalizeContent(note) !==
    normalizeContent(initialSnapshot.current.content);
  const titleChanged =
    normalizeTitle(noteTitle) !==
    normalizeTitle(initialSnapshot.current.title);
  const tagsChanged =
    JSON.stringify(tags) !== JSON.stringify(initialSnapshot.current.tags);
  const spaceChanged =
    (currentSpace?.id ?? "") !== initialSnapshot.current.spaceId;

  const dirty =
    !isEffectivelyEmpty &&
    (contentChanged || titleChanged || tagsChanged || spaceChanged);

  // Editing an existing note: require actual changes before saving.
  // Creating a new note: any non-empty content is savable.
  const isEditing = Boolean(noteContent);
  const canSaveToSpace = isEditing
    ? contentChanged || titleChanged || tagsChanged || spaceChanged
    : !isEffectivelyEmpty;

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      dirty,
      save: async () => {
        await saveToSpace();
        initialSnapshot.current = {
          content: note,
          title: noteTitle,
          tags,
          spaceId: currentSpace?.id ?? "",
        };
      },
      discard: () => {
        setNote(initialSnapshot.current.content);
        setNoteTitle(initialSnapshot.current.title);
        setTags(initialSnapshot.current.tags);
        setSaved(true);
      },
    };
    return () => {
      if (apiRef) apiRef.current = null;
    };
  }, [apiRef, dirty, note, noteTitle, tags, currentSpace, saveToSpace]);

  if (!currentSpace) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No spaces available. Create a space to begin.
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <style>{scrollbarHideStyles}</style>
      <div className="flex flex-col flex-1 h-full overflow-hidden rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 glow-border">
        <header className="flex h-12 items-center justify-between border-b border-gray-100/80 dark:border-zinc-800 px-4">
          <div className="flex items-center gap-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsSpacesOpen(!isSpacesOpen)}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-150"
              >
                <div
                  className="h-2 w-2 rounded-full mr-1 flex-shrink-0"
                  style={{ backgroundColor: currentSpace.color }}
                />
                <span className="font-medium">{currentSpace.name}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-gray-500 dark:text-zinc-400 transition-transform duration-200 ${
                    isSpacesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-md transition-all duration-200 origin-top ${
                  isSpacesOpen
                    ? "opacity-100 scale-y-100 translate-y-0"
                    : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
                }`}
              >
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-zinc-500">
                  Spaces
                </div>
                {allSpaces.map((space) => (
                  <button
                    key={space.id}
                    onClick={() => selectSpace(space)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 ${
                      currentSpace.id === space.id
                        ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                        : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div
                      className="h-2 w-2 rounded-full mr-3 flex-shrink-0"
                      style={{ backgroundColor: space.color }}
                    />
                    <span>{truncate(space.name, { length: 17 })}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

            <div
              className="flex items-center min-w-[240px] relative"
              onClick={() => {
                if (!isTitleFocused) {
                  setIsTitleFocused(true);
                  setTimeout(() => {
                    titleInputRef.current?.focus();
                    titleInputRef.current?.select();
                  }, 0);
                }
              }}
            >
              <div className="flex-grow max-w-[200px]">
                {isTitleFocused ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={noteTitle}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    onKeyDown={handleTitleKeyDown}
                    maxLength={200}
                    className="text-sm font-medium text-gray-800 dark:text-zinc-100 bg-transparent border-none outline-none focus:ring-0 w-full"
                    placeholder="Note title..."
                    autoFocus
                  />
                ) : (
                  <h1 className="text-sm font-medium text-gray-800 dark:text-zinc-100 cursor-text truncate">
                    {noteTitle || "Untitled Note"}
                  </h1>
                )}
              </div>

              <div className="w-5 flex-shrink-0 ml-1">
                {isTitleDuplicate && (
                  <div className="relative group">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                )}
              </div>
            </div>

            <div className="h-4 w-px mr-2 bg-gray-200 dark:bg-zinc-700" />

            <div className="flex items-center w-[242px]">
              <button
                onClick={() => setIsAddingTag(true)}
                className={`flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                  isAddingTag ? "hidden" : "flex"
                }`}
                aria-label="Add tag"
              >
                <Plus className="h-3 w-3" />
              </button>

              {isAddingTag && (
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  className="flex-shrink-0 text-xs bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 border border-gray-100/80 dark:border-zinc-700 rounded-md px-2 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600"
                  placeholder="Add tag..."
                  autoFocus
                />
              )}

              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-hide ml-1 flex-grow">
                {tags.map((tag, index) => (
                  <div
                    key={tag + index}
                    className="flex-shrink-0 flex items-center bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs rounded-md px-1.5 py-0.5 whitespace-nowrap group"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => removeTag(index)}
                      className="ml-1 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onMouseLeave={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                disabled={!canSaveToSpace}
                className={`flex items-center gap-1 text-xs transition-colors duration-150 relative ${
                  canSaveToSpace
                    ? "text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100"
                    : "text-gray-300 dark:text-zinc-600 cursor-not-allowed"
                }`}
                aria-label="Add to space"
                aria-disabled={!canSaveToSpace}
                title={
                  canSaveToSpace
                    ? `Hold to save to ${currentSpace.code.toUpperCase()}`
                    : isEditing
                      ? "No changes to save"
                      : "Add some content first"
                }
              >
                <div className="relative w-4 h-4">
                  <svg
                    className="absolute inset-0 w-full h-full -m-0.5 pt-0.5"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="text-gray-200 dark:text-zinc-700"
                      strokeWidth="2"
                      stroke="currentColor"
                      fill="transparent"
                      r="10"
                      cx="12"
                      cy="12"
                    />
                  </svg>

                  {isHolding && (
                    <svg
                      className="absolute inset-0 w-full h-full -m-0.5 pt-0.5"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="text-blue-500"
                        strokeWidth="2"
                        strokeDasharray={`${holdProgress * 63} 63`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="10"
                        cx="12"
                        cy="12"
                        style={{
                          transformOrigin: "center",
                          transform: "rotate(-90deg)",
                        }}
                      />
                    </svg>
                  )}
                </div>
                <span>Save to {currentSpace.code.toUpperCase()}</span>

                <span
                  id="save-success"
                  className="absolute inset-0 flex items-center justify-center bg-white dark:bg-zinc-900 bg-opacity-90 text-green-500 text-xs font-medium opacity-0 transition-opacity duration-200"
                >
                  Spoof! Added!
                </span>
              </button>
              <div className="absolute right-0 top-full z-10 mt-2 w-sm opacity-0 rounded-md border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-md transition-all duration-200 group-hover:opacity-100">
                <div className="space-y-1.5">
                  {canSaveToSpace ? (
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      Hold to save &quot;
                      <span className="font-medium">
                        {truncate(noteTitle, { length: 14 }) || "Untitled Note"}
                      </span>
                      &quot; to{" "}
                      <span className="font-bold">
                        {currentSpace.code.toUpperCase()}
                      </span>{" "}
                      space
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {isEditing
                        ? "No changes to save — edit the title, content, tags, or space to enable."
                        : "Add some content before saving."}
                    </p>
                  )}
                  {isTitleDuplicate && canSaveToSpace && (
                    <>
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        You are editing over an existing note.
                      </p>
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        This note will replace the already existing note.
                      </p>
                    </>
                  )}
                </div>
                <div className="absolute -top-2 right-4 h-2 w-4 overflow-hidden">
                  <div className="absolute h-2 w-2 origin-bottom-left rotate-45 transform border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900" />
                </div>
              </div>
            </div>

            <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

            <div className="relative group">
              <button
                onClick={saveNote}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors duration-150"
                aria-label="Save notes"
              >
                <span>{saved ? "Locally Saved" : "Save"}</span>
              </button>
            </div>

            <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

            <div className="relative group">
              <button
                onClick={toggleInfo}
                className={`flex items-center text-xs ${
                  showInfo
                    ? "text-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                } transition-colors duration-150`}
                aria-label="Information"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {showInfo ? (
          <div className="h-[calc(100%-3rem)] overflow-auto p-6 bg-transparent">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-medium text-zinc-800 dark:text-zinc-100 mb-8">
                About This Editor
              </h2>

              <div className="space-y-10">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                      What is Markdown?
                    </h3>
                    <a
                      href="https://www.markdownguide.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <span>Learn More</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Markdown is a lightweight markup language that lets you
                    create formatted text using a plain-text editor.
                  </p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                      Titles & Content
                    </h3>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The title of the note will always be located on the top
                    left, next to your selected space. If there is no local
                    stored note, it will automatically be set to &quot;Untitled
                    Note&quot;. To change the title of the note, simply click
                    the title.
                  </p>
                  <p className="items-center text-xs text-red-500 transition-colors">
                    Duplicate titles within the same space are NOT allowed, and
                    will REPLACE the original contents. Duplicate titles amongst
                    seperate spaces will not be considered. There will be a
                    warning sign reminding you that a duplicate title (not
                    case-sensitive) exists.
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The content of your note is essentially what you type into
                    the editor. We will save your title and content, for
                    minimal, accessible viewing in your selected space.
                  </p>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                      Advanced Markdown Features
                    </h3>
                    <p className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 transition-colors">
                      See more in our live markdown example down below.
                    </p>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Our editor supports a wide range of Markdown functionality:
                  </p>
                  <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li>
                      <strong>Code Blocks & Inline Code:</strong> Write and
                      highlight code effortlessly.
                    </li>
                    <li>
                      <strong>Math Expressions:</strong> Use inline math ($...$)
                      or display math ($$...$$) rendered via KaTeX.
                    </li>
                    <li>
                      <strong>Emoji Support:</strong> Easily include emojis by
                      typing short codes (e.g., :smile: =&gt; 😄).
                    </li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                    What does &quot;Locally Saved&quot; mean?
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Your notes are automatically saved in your browser&apos;s
                    local storage, ensuring your work persists between sessions.
                    To permanently save your note, see the section below.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                    Organizing with Spaces
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Spaces help you categorize your notes by project, subject,
                    or personal preference for easy management.
                  </p>
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-md border border-gray-100/80 dark:border-zinc-800">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                      <span className="font-medium">Adding a Note:</span> Select
                      a space, write your note, and hold{" "}
                      <span className="italic">save to space</span>.
                      <br />
                      <span className="text-xs font-light text-red-500">
                        Warning: Although the note will be stored and editable
                        in a space, the current editor will reset.
                      </span>
                    </p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">Creating a New Space:</span>{" "}
                      Use the + symbol on the sidebar to create a new class.
                    </p>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                    Handy Shortcuts
                  </h3>
                  <div className="flex items-center justify-between text-sm bg-white dark:bg-zinc-900 p-2 rounded-md border border-gray-100/80 dark:border-zinc-800">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Quick Save
                    </span>
                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded">
                      Ctrl+S / Cmd+S
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Use Ctrl+S (or Cmd+S on macOS) to quickly save your work
                    without losing any progress.
                  </p>
                </section>
              </div>

              <div className="mt-20">
                <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-100 mb-4">
                  Live Markdown Example
                </h3>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-md border border-gray-100/80 dark:border-zinc-800 prose prose-zinc dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                  >
                    {testMarkdownText}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <button
                onClick={toggleInfo}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-md text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Back to Editor
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-[calc(100%-3rem)] divide-x divide-gray-200 dark:divide-zinc-800">
            <div className="w-1/2 overflow-auto">
              <textarea
                ref={editorRef}
                className="h-full resize-none border-none bg-transparent text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 p-8 text-xs leading-relaxed outline-none font-mono overflow-visible w-full break-after-all"
                value={note}
                onChange={handleChange}
                onScroll={handleEditorScroll}
                onKeyDown={handleKeyDown}
                placeholder="Start typing in Markdown... Click (i) in the top right for more info..."
                spellCheck
                autoFocus
              />
            </div>

            <div ref={previewRef} className="w-1/2 overflow-auto p-6">
              <div className="prose prose-zinc dark:prose-invert max-w-none overflow-visible w-full border-none bg-transparent outline-none break-after-all">
                {note ? (
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                  >
                    {note}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-400 dark:text-zinc-500 text-sm pt-1">
                    Preview will appear here...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
