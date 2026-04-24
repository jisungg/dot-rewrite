"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Edit2,
  Eye,
  Trash2,
  Check,
  Download,
  Ellipsis,
  Pin,
  Copy,
  FolderSymlink,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useClickAway } from "react-use";
import type { Note, Space } from "@/data/types";
import { capitalizeWords, truncate } from "@/lib/string";

type ActionSubmenu = "main" | "moveToSpace";

const ROW_HEIGHT = "40px";
const NOTES_PER_PAGE = 15;

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortNotes(notesToSort: Note[], order: string): Note[] {
  return [...notesToSort].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    if (order === "newest") {
      return (
        new Date(b.last_modified_at).getTime() -
        new Date(a.last_modified_at).getTime()
      );
    }
    if (order === "oldest") {
      return (
        new Date(a.last_modified_at).getTime() -
        new Date(b.last_modified_at).getTime()
      );
    }
    return 0;
  });
}

export default function Notes({
  allSpaces,
  allNotes,
  handleNoteEdit,
  handleNoteView,
  handleNoteArchive,
  handleNotePin,
  handleNoteDuplicate,
  handleNoteExport,
  handleNoteToMoveToSpace,
}: {
  allSpaces: Space[];
  allNotes: Note[];
  handleNoteEdit: (noteToEdit: Note, spaceLinked: Space) => void;
  handleNoteView: (noteToView: Note) => void;
  handleNoteArchive: (noteToArchive: Note) => Promise<void>;
  handleNotePin: (noteToPin: Note) => Promise<void>;
  handleNoteDuplicate: (noteToDuplicate: Note) => Promise<Note | null>;
  handleNoteExport: (noteToExport: Note) => void | Promise<void>;
  handleNoteToMoveToSpace: (
    noteToMoveToSpace: Note,
    newSpace: Space,
  ) => Promise<Note | null>;
}) {
  const [notes, setNotes] = useState(allNotes);
  const [filteredAndSortedNotes, setFilteredAndSortedNotes] =
    useState<Note[]>(allNotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSpacesOpen, setIsSpacesOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubmenu] = useState<ActionSubmenu>("main");

  const allTags = [...new Set(notes.flatMap((note) => note.tags))].sort();

  const spacesRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const actionMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useClickAway(spacesRef, () => setIsSpacesOpen(false));
  useClickAway(tagsRef, () => setIsTagsOpen(false));
  useClickAway(sortRef, () => setIsSortOpen(false));

  const mapSpaceIdtoSpaceName = (spaceId: string): string => {
    const space = allSpaces.find((s) => s.id === spaceId);
    return space ? space.name : "Unknown Space";
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!activeActionMenu) return;
      const menu = actionMenuRefs.current[activeActionMenu];
      const btn = actionButtonRefs.current[activeActionMenu];
      if (
        menu &&
        !menu.contains(event.target as Node) &&
        btn &&
        !btn.contains(event.target as Node)
      ) {
        setActiveActionMenu(null);
        setActiveSubmenu("main");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeActionMenu]);

  useEffect(() => {
    let filtered = [...notes];

    if (searchQuery) {
      filtered = filtered.filter((note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (spaceFilter !== "All") {
      filtered = filtered.filter(
        (note) => mapSpaceIdtoSpaceName(note.space_id) === spaceFilter,
      );
    }

    if (tagFilter !== "All") {
      filtered = filtered.filter((note) => note.tags.includes(tagFilter));
    }

    filtered = sortNotes(filtered, sortOrder);

    setFilteredAndSortedNotes(filtered);
    setCurrentPage(1);
    // mapSpaceIdtoSpaceName uses allSpaces; included via allSpaces dep
  }, [notes, searchQuery, spaceFilter, tagFilter, sortOrder, allSpaces]);

  const indexOfLastNote = currentPage * NOTES_PER_PAGE;
  const indexOfFirstNote = indexOfLastNote - NOTES_PER_PAGE;
  const currentNotes = filteredAndSortedNotes.slice(
    indexOfFirstNote,
    indexOfLastNote,
  );
  const totalPages = Math.ceil(filteredAndSortedNotes.length / NOTES_PER_PAGE);

  const handleArchive = async (note: Note) => {
    await handleNoteArchive(note);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  };

  const handleEdit = (note: Note) => {
    const spaceOfNote = allSpaces.find((spc) => spc.id === note.space_id);
    if (spaceOfNote) handleNoteEdit(note, spaceOfNote);
  };

  const handlePin = async (note: Note) => {
    await handleNotePin(note);
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)),
    );
    setActiveActionMenu(null);
    setActiveSubmenu("main");
  };

  const handleDuplicate = async (note: Note) => {
    setActiveActionMenu(null);
    const data = await handleNoteDuplicate(note);
    if (data) setNotes((prev) => [...prev, data]);
    setActiveSubmenu("main");
  };

  const handleMoveToSpace = async (note: Note, space: Space) => {
    setActiveActionMenu(null);
    const data = await handleNoteToMoveToSpace(note, space);
    if (data) {
      setNotes((prev) => prev.map((n) => (n.id === data.id ? data : n)));
    }
    setActiveSubmenu("main");
  };

  const handleExport = async (note: Note) => {
    setActiveActionMenu(null);
    setActiveSubmenu("main");
    await handleNoteExport(note);
  };

  const handleView = (note: Note) => handleNoteView(note);

  const renderEmptyRows = (count: number) =>
    Array.from({ length: count }).map((_, index) => (
      <tr
        key={`empty-${index}`}
        style={{ height: ROW_HEIGHT }}
        className="border-b border-gray-100/80 dark:border-zinc-800"
      >
        <td className="px-4 py-5.5" />
        <td className="px-4 py-5.5" />
        <td className="px-4 py-5.5" />
        <td className="px-4 py-5.5" />
        <td className="px-4 py-5.5" />
        <td className="px-4 py-5.5" />
      </tr>
    ));

  return (
    <div className="w-full mx-auto space-y-4 bg-transparent">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-500 h-3.5 w-3.5" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 h-8 w-full border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 text-xs focus:ring-0 focus:border-gray-300 dark:focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="relative" ref={spacesRef}>
            <button
              onClick={() => setIsSpacesOpen(!isSpacesOpen)}
              className="flex items-center gap-1 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 border-b border-transparent hover:border-gray-300 dark:hover:border-zinc-600 transition-all py-1"
            >
              <span>
                Space: <span className="font-semibold">{spaceFilter}</span>
              </span>
            </button>
            <div
              className={`absolute left-0 top-full z-10 mt-1 w-40 border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 py-1 shadow-sm transition-all duration-200 origin-top rounded-md ${
                isSpacesOpen
                  ? "opacity-100 scale-y-100 translate-y-0"
                  : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
              }`}
            >
              <div
                className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  setSpaceFilter("All");
                  setIsSpacesOpen(false);
                }}
              >
                All Spaces
              </div>
              {allSpaces.map((spc) => (
                <div
                  key={spc.code}
                  className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                  onClick={() => {
                    setSpaceFilter(spc.name);
                    setIsSpacesOpen(false);
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: spc.color }}
                  />
                  {capitalizeWords(spc.name)}
                </div>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

          <div className="relative" ref={tagsRef}>
            <button
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="flex items-center gap-1 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 border-b border-transparent hover:border-gray-300 dark:hover:border-zinc-600 transition-all py-1"
            >
              <span>
                Tag: <span className="font-semibold">{tagFilter}</span>
              </span>
            </button>
            <div
              className={`absolute left-0 top-full z-10 mt-1 w-40 max-h-60 overflow-y-auto border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 py-1 shadow-sm transition-all duration-200 origin-top rounded-md ${
                isTagsOpen
                  ? "opacity-100 scale-y-100 translate-y-0"
                  : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
              }`}
            >
              <div
                className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  setTagFilter("All");
                  setIsTagsOpen(false);
                }}
              >
                All Tags
              </div>
              {allTags.map((tag) => (
                <div
                  key={tag}
                  className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                  onClick={() => {
                    setTagFilter(tag);
                    setIsTagsOpen(false);
                  }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-1 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 border-b border-transparent hover:border-gray-300 dark:hover:border-zinc-600 transition-all py-1"
            >
              <span>
                Sort:{" "}
                <span className="font-semibold">
                  {sortOrder === "newest" ? "Newest" : "Oldest"}
                </span>
              </span>
            </button>
            <div
              className={`absolute left-0 top-full z-10 mt-1 w-40 border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 py-1 shadow-sm transition-all duration-200 origin-top rounded-md ${
                isSortOpen
                  ? "opacity-100 scale-y-100 translate-y-0"
                  : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
              }`}
            >
              <div
                className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  setSortOrder("newest");
                  setIsSortOpen(false);
                }}
              >
                Newest First
              </div>
              <div
                className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  setSortOrder("oldest");
                  setIsSortOpen(false);
                }}
              >
                Oldest First
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden border border-gray-100/80 dark:border-zinc-800 rounded-xl">
        <div className="overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Space
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Last Edited
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Processed
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900/40 divide-y divide-gray-100 dark:divide-zinc-800">
              <AnimatePresence mode="sync">
                {currentNotes.length > 0 ? (
                  <>
                    {currentNotes.map((note, index) => {
                      const noteSpace = allSpaces.find(
                        (spc) => spc.id === note.space_id,
                      );
                      return (
                        <motion.tr
                          key={note.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.15,
                            delay: index * 0.1 + 0.1,
                          }}
                          className={`hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors border-b border-gray-100/80 dark:border-zinc-800 ${
                            note.pinned ? "bg-gray-50 dark:bg-zinc-800/40" : ""
                          }`}
                          style={{ height: ROW_HEIGHT }}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              {note.pinned && (
                                <Pin className="h-3 w-3 text-gray-400 dark:text-zinc-500 mr-1.5 flex-shrink-0" />
                              )}
                              <div className="text-xs font-medium text-gray-900 dark:text-zinc-100 truncate">
                                {capitalizeWords(
                                  truncate(note.title, { length: 25 }),
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: noteSpace?.color }}
                              />
                              <div className="text-xs text-gray-500 dark:text-zinc-400">
                                {capitalizeWords(noteSpace?.name ?? "")}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 min-w-[180px]">
                              {note.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-normal ${
                                    tagFilter === tag
                                      ? "bg-gray-200 dark:bg-zinc-700 font-medium"
                                      : ""
                                  }`}
                                  onClick={() => setTagFilter(tag)}
                                >
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDate(note.last_modified_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Check
                              className={`h-4 w-4 ${
                                note.processed
                                  ? "text-green-500"
                                  : "text-gray-300 dark:text-zinc-600"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                className="text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400"
                                onClick={() => handleView(note)}
                                aria-label="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="sr-only">View</span>
                              </button>
                              <button
                                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-200"
                                onClick={() => handleEdit(note)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Edit</span>
                              </button>
                              <button
                                className="text-gray-400 dark:text-zinc-500 hover:text-red-500"
                                onClick={() => handleArchive(note)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Delete</span>
                              </button>
                              <div className="relative">
                                <button
                                  ref={(el) => {
                                    actionButtonRefs.current[note.id] = el;
                                  }}
                                  className="text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400"
                                  onClick={() => {
                                    if (activeActionMenu === note.id) {
                                      setActiveActionMenu(null);
                                      setActiveSubmenu("main");
                                    } else {
                                      setActiveActionMenu(note.id);
                                      setActiveSubmenu("main");
                                    }
                                  }}
                                >
                                  <Ellipsis className="h-3.5 w-3.5 mt-1" />
                                  <span className="sr-only">More</span>
                                </button>
                                {activeActionMenu === note.id && (
                                  <div
                                    ref={(el) => {
                                      actionMenuRefs.current[note.id] = el;
                                    }}
                                    className="absolute z-50 right-0 top-full mt-1 w-48 border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 py-1 shadow-sm rounded-md transition-all duration-150 origin-top-right"
                                  >
                                    <AnimatePresence mode="wait">
                                      {activeSubMenu === "main" && (
                                        <motion.div
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: 10 }}
                                          transition={{ duration: 0.15 }}
                                        >
                                          <div
                                            className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                                            onClick={() => handlePin(note)}
                                          >
                                            <Pin className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-zinc-400" />
                                            {note.pinned ? "Unpin" : "Pin"}
                                          </div>
                                          <div
                                            className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                                            onClick={() =>
                                              handleDuplicate(note)
                                            }
                                          >
                                            <Copy className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-zinc-400" />
                                            Duplicate
                                          </div>
                                          <div
                                            className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                                            onClick={() =>
                                              setActiveSubmenu("moveToSpace")
                                            }
                                          >
                                            <FolderSymlink className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-zinc-400" />
                                            Move to space
                                          </div>
                                          <div
                                            className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                                            onClick={() => handleExport(note)}
                                          >
                                            <Download className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-zinc-400" />
                                            Export
                                          </div>
                                        </motion.div>
                                      )}

                                      {activeSubMenu === "moveToSpace" && (
                                        <motion.div
                                          initial={{ opacity: 0, x: 10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: -10 }}
                                          transition={{ duration: 0.15 }}
                                          className="max-h-60 overflow-y-auto"
                                        >
                                          <div className="px-3 py-1 text-xs flex items-center border-b border-gray-100/80 dark:border-zinc-800">
                                            <button
                                              className="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 mr-1"
                                              onClick={() =>
                                                setActiveSubmenu("main")
                                              }
                                            >
                                              <ChevronLeft className="h-3.5 w-3.5" />
                                            </button>
                                            <span>Move to Space</span>
                                          </div>
                                          {allSpaces.map((space) => (
                                            <div
                                              key={space.id}
                                              className="px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center"
                                              onClick={() =>
                                                handleMoveToSpace(note, space)
                                              }
                                            >
                                              <div
                                                className="w-2 h-2 rounded-full mr-2"
                                                style={{
                                                  backgroundColor: space.color,
                                                }}
                                              />
                                              {truncate(space.name, {
                                                length: 18,
                                              })}
                                            </div>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}

                    {currentNotes.length < NOTES_PER_PAGE &&
                      renderEmptyRows(NOTES_PER_PAGE - currentNotes.length)}
                  </>
                ) : (
                  <>
                    <tr
                      style={{ height: ROW_HEIGHT }}
                      className="border-b border-gray-100/80 dark:border-zinc-800"
                    >
                      <td
                        colSpan={6}
                        className="px-4 py-3 text-center text-xs text-gray-500 dark:text-zinc-400"
                      >
                        No notes found matching your filters
                      </td>
                    </tr>
                    {renderEmptyRows(NOTES_PER_PAGE - 1)}
                  </>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredAndSortedNotes.length > NOTES_PER_PAGE && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              {indexOfFirstNote + 1}-
              {Math.min(indexOfLastNote, filteredAndSortedNotes.length)} of{" "}
              {filteredAndSortedNotes.length} notes
            </div>
            <div className="flex items-center space-x-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    className={`text-xs px-1 ${
                      currentPage === page
                        ? "text-gray-900 dark:text-zinc-100 border-b border-gray-900 dark:border-zinc-100"
                        : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 border-b border-transparent hover:border-gray-300 dark:hover:border-zinc-600"
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
