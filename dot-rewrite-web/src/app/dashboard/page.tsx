"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import type { User } from "@supabase/supabase-js";
import {
  Files,
  ScanText,
  Settings,
  LogOut,
  BotMessageSquare,
  TextQuote,
  ArrowLeft,
  Pilcrow,
  Waypoints,
  Network,
  BookOpenCheck,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
} from "lucide-react";

import type {
  Space,
  Note,
  views,
  allViewports,
  renderOptions,
} from "@/data/types";
import { getUser, signOutAction } from "@/app/actions";
import {
  archiveNote,
  deleteSpace,
  duplicateNote,
  getNotes,
  getSpaces,
  moveNoteToSpace,
  pinNote,
} from "@/utils/supabase/queries";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/lib/color-utils";
import { generateCopyTitle, truncate } from "@/lib/string";

import { useTheme } from "@/components/theme-provider";
import UnrenderableContent from "@/components/dashboard/404/unrenderable-content";
import AddSpaceModal from "@/components/dashboard/components/add-space-dialog";
import Editor, { type EditorApi } from "@/components/dashboard/home/editor";
import Notes from "@/components/dashboard/home/notes";
import Nexus from "@/components/dashboard/home/nexus";
import Letters from "@/components/dashboard/home/letters";
import BillingBanner from "@/components/dashboard/billing-banner";
import { useTier } from "@/lib/use-tier";
import { useRouter } from "next/navigation";
import Dot from "@/components/dashboard/class/dot";
import SpaceOutline from "@/components/dashboard/class/space-outline";
import SpaceTldr from "@/components/dashboard/class/space-tldr";
import SpaceRelationships from "@/components/dashboard/class/space-relationships";
import SpaceUnderstand from "@/components/dashboard/class/space-understand";
import SpaceExam from "@/components/dashboard/class/space-exam";
import SettingsPage, {
  type SettingsApi,
} from "@/components/dashboard/settings/settings";
import NoteView from "@/components/dashboard/components/note-view";
import { exportNoteAsPdf } from "@/lib/pdf-export";
import { toast, Toaster } from "sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { useRealtimeTable } from "@/lib/realtime";
import { emitEngineUpdate } from "@/lib/engine-events";

interface NavigationItem {
  name: string;
  icon: React.ElementType;
  id: string;
}

const homeNavigationItems: NavigationItem[] = [
  { name: "Editor", icon: Pilcrow, id: "editor" },
  { name: "Notes", icon: Files, id: "notes" },
  { name: "Nexus", icon: Waypoints, id: "nexus" },
  { name: "Letters", icon: Mail, id: "letters" },
];
const spaceNavigationItems: NavigationItem[] = [
  { name: "Dot", icon: BotMessageSquare, id: "dot" },
  { name: "Outline", icon: TextQuote, id: "outline" },
  { name: "TL;DR", icon: ScanText, id: "tl;dr" },
  { name: "Relationships", icon: Network, id: "relationships" },
  { name: "Understand", icon: BookOpenCheck, id: "understand" },
  { name: "Exam", icon: GraduationCap, id: "exam" },
];
const homeBottomItems: NavigationItem[] = [
  { name: "Settings", icon: Settings, id: "settings" },
  { name: "Log Out", icon: LogOut, id: "logOut" },
];
const spaceBottomItems: NavigationItem[] = [
  { name: "Back to Home", icon: ArrowLeft, id: "backToHome" },
  { name: "Settings", icon: Settings, id: "settings" },
  { name: "Log Out", icon: LogOut, id: "logOut" },
];

const LOGO_PATH =
  "M 43.001 68.4 L 42.201 65.4 A 828.429 828.429 0 0 1 47.973 60.805 Q 57.494 53.3 61.401 50.8 A 33.492 33.492 0 0 1 63.923 49.326 Q 66.482 47.988 68.426 47.687 A 7.038 7.038 0 0 1 69.501 47.6 A 4.629 4.629 0 0 1 70.708 47.744 Q 72.305 48.176 72.554 49.912 A 4.84 4.84 0 0 1 72.601 50.6 Q 72.601 52.6 61.301 66.9 A 809.483 809.483 0 0 0 58.652 70.269 Q 50.366 80.869 50.016 82.201 A 0.403 0.403 0 0 0 50.001 82.3 Q 50.001 83.4 50.701 83.4 A 1.822 1.822 0 0 0 51.21 83.148 Q 53.732 81.644 68.21 71.146 A 2986.095 2986.095 0 0 0 73.501 67.3 A 410.649 410.649 0 0 1 81.18 61.829 Q 95.413 51.954 99.789 51.254 A 3.891 3.891 0 0 1 100.401 51.2 A 3.729 3.729 0 0 1 102.195 51.674 A 5.344 5.344 0 0 1 103.101 52.3 Q 104.259 53.28 104.385 54.181 A 1.577 1.577 0 0 1 104.401 54.4 Q 104.401 56.458 96.608 66.676 A 326.224 326.224 0 0 1 93.801 70.3 A 443.597 443.597 0 0 0 91.316 73.492 Q 83.201 84.025 83.201 85.6 A 1.804 1.804 0 0 0 83.393 86.46 Q 83.791 87.208 85.016 87.361 A 5.539 5.539 0 0 0 85.701 87.4 Q 87.741 87.4 93.579 83.802 A 111.804 111.804 0 0 0 96.401 82 A 318.501 318.501 0 0 0 116.006 68.151 A 103.138 103.138 0 0 1 120.994 62.807 A 133.083 133.083 0 0 1 121.201 62.6 Q 118.801 56.8 118.801 50.4 A 14.452 14.452 0 0 1 119.713 45.176 A 12.966 12.966 0 0 1 123.401 40 Q 128.001 36 134.101 36 A 15.361 15.361 0 0 1 139.846 37.047 A 14.203 14.203 0 0 1 144.401 40 Q 148.601 44 148.601 51.4 A 37.848 37.848 0 0 1 145.489 66.184 A 51.31 51.31 0 0 1 141.201 74.2 Q 141.866 74.366 143.084 74.394 A 22.494 22.494 0 0 0 143.601 74.4 Q 153.735 74.4 167.471 64.084 A 105.337 105.337 0 0 0 170.401 61.8 L 170.876 61.94 A 226.675 226.675 0 0 1 185.501 42.7 Q 195.601 30.8 204.701 20.2 A 319.338 319.338 0 0 0 207.821 16.513 Q 213.61 9.559 214.511 7.433 A 3.167 3.167 0 0 0 214.601 7.2 Q 196.468 8.848 185.264 11.04 A 115.159 115.159 0 0 0 180.801 12 L 176.801 12.8 Q 175.201 13 175.201 15.8 A 0.898 0.898 0 0 1 174.688 16.607 Q 174.01 16.996 172.433 17 A 12.935 12.935 0 0 1 172.401 17 A 15.469 15.469 0 0 1 170.22 16.832 Q 169.076 16.668 167.771 16.345 A 36.917 36.917 0 0 1 165.501 15.7 A 12.339 12.339 0 0 1 163.953 15.103 Q 162.275 14.308 161.7 13.217 A 2.572 2.572 0 0 1 161.401 12 A 2.507 2.507 0 0 1 162.554 9.884 Q 163.486 9.215 165.171 8.848 A 13.604 13.604 0 0 1 165.401 8.8 Q 195.001 3.6 207.401 2.5 A 3881.276 3881.276 0 0 1 212.428 2.057 Q 220.697 1.334 223.901 1.1 A 114.383 114.383 0 0 1 226.238 0.956 Q 230.08 0.755 236.387 0.607 A 726.444 726.444 0 0 1 236.701 0.6 A 1754.754 1754.754 0 0 1 240.234 0.522 Q 244.692 0.429 247.111 0.407 A 144.816 144.816 0 0 1 248.401 0.4 Q 254.588 0.125 262.241 0.039 A 647.362 647.362 0 0 1 269.501 0 Q 281.601 0 284.201 1 Q 286.465 1.871 286.757 4.108 A 5.346 5.346 0 0 1 286.801 4.8 A 1.501 1.501 0 0 1 285.951 6.15 Q 284.835 6.794 282.253 6.8 A 20.971 20.971 0 0 1 282.201 6.8 L 253.601 5.4 Q 236.001 5.4 218.601 6.8 L 219.601 10.8 A 3.074 3.074 0 0 1 219.144 12.057 Q 217.526 15.048 210.181 23.458 A 417.412 417.412 0 0 1 206.601 27.5 A 487.325 487.325 0 0 0 187.507 50.199 A 564.312 564.312 0 0 0 180.601 59.1 Q 167.601 76.2 167.601 84.4 A 6.557 6.557 0 0 0 167.692 85.548 Q 168.059 87.6 169.901 87.6 A 4.133 4.133 0 0 0 171.161 87.342 Q 173.962 86.397 180.401 82 Q 195.601 72 208.201 61.8 L 209.769 60.517 A 68.716 68.716 0 0 1 212.001 58.1 A 87.475 87.475 0 0 1 217.957 52.431 Q 224.145 47.117 229.255 45.32 A 14.917 14.917 0 0 1 234.201 44.4 A 6.373 6.373 0 0 1 236.27 44.708 Q 239.201 45.713 239.201 50 Q 238.336 59.506 215.366 74.688 A 243.306 243.306 0 0 1 207.601 79.6 L 207.601 81.6 A 9.063 9.063 0 0 0 207.955 84.252 Q 208.847 87.167 211.99 87.93 A 10.669 10.669 0 0 0 214.501 88.2 Q 220.427 88.2 227.165 84.807 A 45.975 45.975 0 0 0 229.401 83.6 Q 245.001 74.4 258.601 62.6 L 263.601 58.4 A 6.86 6.86 0 0 1 264.498 57.851 Q 264.995 57.601 265.465 57.49 A 3.18 3.18 0 0 1 266.201 57.4 A 1.459 1.459 0 0 1 266.711 57.482 Q 267.353 57.721 267.397 58.657 A 3.018 3.018 0 0 1 267.401 58.8 L 267.401 59.2 Q 246.601 76.4 232.801 85 A 72.679 72.679 0 0 1 224.024 89.718 Q 219.267 91.841 214.861 92.803 A 33.074 33.074 0 0 1 207.801 93.6 Q 198.801 93.6 198.801 84.8 A 29.14 29.14 0 0 1 201.701 72.459 A 46.273 46.273 0 0 1 203.374 69.264 A 475.674 475.674 0 0 1 187.151 81 A 540.885 540.885 0 0 1 180.701 85.4 A 206.296 206.296 0 0 1 176.129 88.391 Q 166.963 94.2 164.201 94.2 A 9.423 9.423 0 0 1 162.012 93.969 Q 159.069 93.263 158.524 90.409 A 7.52 7.52 0 0 1 158.401 89 Q 158.401 82.865 163.939 72.951 A 103.637 103.637 0 0 1 166.69 68.332 A 113.358 113.358 0 0 1 163.769 70.355 Q 150.429 79.2 140.001 79.2 A 20.555 20.555 0 0 1 139.164 79.184 Q 138.407 79.153 137.893 79.062 A 4.35 4.35 0 0 1 137.601 79 A 54.045 54.045 0 0 1 130.46 86.273 A 45.674 45.674 0 0 1 125.801 89.7 Q 121.765 92.286 118.365 93.241 A 13.937 13.937 0 0 1 114.601 93.8 A 9.699 9.699 0 0 1 111.456 93.333 Q 107.001 91.808 107.001 85.3 A 14.491 14.491 0 0 1 108.187 79.91 A 30.928 30.928 0 0 1 109.501 77.159 A 417.723 417.723 0 0 1 105.67 80.017 Q 88.043 92.956 81.214 94.091 A 7.438 7.438 0 0 1 80.001 94.2 A 10.238 10.238 0 0 1 77.848 93.994 Q 74.704 93.315 74.27 90.394 A 6.764 6.764 0 0 1 74.201 89.4 A 13.595 13.595 0 0 1 74.78 85.632 Q 75.748 82.285 78.332 78.26 A 46.68 46.68 0 0 1 78.501 78 Q 82.801 71.4 87.101 66.3 Q 90.695 62.037 91.285 60.638 A 1.211 1.211 0 0 0 91.401 60.2 A 2.492 2.492 0 0 0 91.379 59.86 Q 91.327 59.482 91.145 59.321 A 0.5 0.5 0 0 0 90.801 59.2 Q 73.869 70.487 69.45 73.82 A 33.742 33.742 0 0 0 68.701 74.4 Q 65.201 77.2 57.301 83.6 A 626.273 626.273 0 0 1 54.531 85.831 Q 49.159 90.133 47.151 91.499 A 19.732 19.732 0 0 1 47.001 91.6 Q 44.601 93.2 41.801 93.2 Q 39.001 93.2 39.001 90.8 A 4.365 4.365 0 0 1 39.428 89.249 Q 41.188 85.109 50.201 73.2 Q 60.935 58.49 61 56.622 A 0.641 0.641 0 0 0 61.001 56.6 Q 61.001 56.225 60.386 56.202 A 2.227 2.227 0 0 0 60.301 56.2 Q 59.69 56.2 46.977 65.486 A 1687.733 1687.733 0 0 0 43.001 68.4 Z M 132.201 58.4 L 132.201 59 A 731.463 731.463 0 0 1 128.922 61.725 A 39.827 39.827 0 0 0 129.001 61.9 A 31.63 31.63 0 0 0 131.775 66.882 Q 133.671 69.628 135.99 71.502 A 18.341 18.341 0 0 0 137.201 72.4 A 62.959 62.959 0 0 0 140.335 66.498 Q 143.401 59.833 143.401 54.7 A 23.488 23.488 0 0 0 143.083 50.701 Q 142.332 46.361 139.801 43.9 A 16.911 16.911 0 0 0 137.681 42.13 Q 135.191 40.4 132.801 40.4 A 9.766 9.766 0 0 0 129.993 40.768 Q 125.801 42.028 125.801 47.6 A 33.943 33.943 0 0 0 127.732 58.747 L 128.401 58.2 A 6.86 6.86 0 0 1 129.298 57.651 Q 129.795 57.401 130.265 57.29 A 3.18 3.18 0 0 1 131.001 57.2 A 1.728 1.728 0 0 1 131.475 57.26 Q 132.008 57.412 132.149 57.956 A 1.768 1.768 0 0 1 132.201 58.4 Z M 229.001 50.6 A 7.255 7.255 0 0 0 226.168 51.252 Q 222.561 52.793 217.725 57.973 A 63.131 63.131 0 0 0 217.701 58 Q 210.801 65.4 208.401 74.8 Q 218.001 69 224.601 62.5 Q 231.201 56 231.201 53.3 A 4.867 4.867 0 0 0 231.11 52.315 Q 230.8 50.821 229.429 50.629 A 3.083 3.083 0 0 0 229.001 50.6 Z M 115.201 84.2 A 4.332 4.332 0 0 0 115.546 85.997 Q 116.541 88.2 120.401 88.2 Q 125.251 88.2 132.538 78.976 A 78.607 78.607 0 0 0 133.601 77.6 A 20.028 20.028 0 0 1 128.651 73.902 Q 126.797 72.042 125.121 69.561 A 38.896 38.896 0 0 1 124.001 67.8 Q 116.96 75.481 115.552 81.369 A 12.17 12.17 0 0 0 115.201 84.2 Z M 9.601 83.565 A 4.845 4.845 0 0 0 8.301 83.4 Q 6.812 83.4 4.527 85.731 A 26.307 26.307 0 0 0 3.201 87.2 A 40.972 40.972 0 0 0 2.681 87.829 Q 0.001 91.144 0.001 92.7 Q 0.001 94.4 1.001 95.7 Q 2.001 97 4.201 97 Q 5.885 97 8.038 95.007 A 19.478 19.478 0 0 0 9.401 93.6 Q 12.401 90.2 12.401 88 A 8.107 8.107 0 0 0 12.384 87.483 Q 12.338 86.76 12.159 86.157 A 3.922 3.922 0 0 0 11.301 84.6 A 3.546 3.546 0 0 0 9.601 83.565 Z";

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardInner />
    </ErrorBoundary>
  );
}

function TierBadge({ onClickUpgrade }: { onClickUpgrade: () => void }) {
  const { isPlus, loading } = useTier();
  if (loading) return null;
  return (
    <div className="px-3 mb-2">
      {isPlus ? (
        <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10px] font-semibold">
          <span className="text-[9px]">★</span>
          Plus
        </div>
      ) : (
        <button
          type="button"
          onClick={onClickUpgrade}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 text-[10px] font-medium hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 transition-colors"
        >
          Free · Upgrade
        </button>
      )}
    </div>
  );
}

function DashboardInner() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [isComplete, setIsComplete] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showLogo, setShowLogo] = useState(true);

  const [view, setView] = useState<views>("home");
  const [activeViewport, setActiveViewport] = useState<allViewports>("editor");

  const [allSpaces, setAllSpaces] = useState<Space[] | null>(null);
  const [focusedSpace, setFocusedSpace] = useState<Space | null>(null);
  const [loadingSpace, setLoadingSpace] = useState(true);

  const [allNotes, setAllNotes] = useState<Note[] | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);

  const [options, setOptions] = useState<renderOptions>({});

  const settingsApiRef = useRef<SettingsApi | null>(null);
  const editorApiRef = useRef<EditorApi | null>(null);
  const [examActive, setExamActive] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | {
    run: () => void;
    kind: "settings" | "editor" | "exam";
  }>(null);
  const [resolving, setResolving] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState<string | null>(null);

  const guardNav = useCallback(
    (next: () => void) => {
      const sApi = settingsApiRef.current;
      const eApi = editorApiRef.current;
      if (examActive && activeViewport === "exam") {
        setPendingNav({ run: next, kind: "exam" });
        return;
      }
      if (activeViewport === "settings" && sApi && sApi.dirty) {
        setPendingNav({ run: next, kind: "settings" });
        return;
      }
      if (
        (activeViewport === "editor" || activeViewport === "editEditor") &&
        eApi &&
        eApi.dirty
      ) {
        setPendingNav({ run: next, kind: "editor" });
        return;
      }
      next();
    },
    [activeViewport, examActive],
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const sApi = settingsApiRef.current;
      const eApi = editorApiRef.current;
      const dirty =
        (activeViewport === "settings" && sApi?.dirty) ||
        ((activeViewport === "editor" || activeViewport === "editEditor") &&
          eApi?.dirty);
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeViewport]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await getUser();
        if (!cancelled) setUser(userData);
      } catch (error) {
        console.error("getUser:", error);
        toast.error("Could not load your account");
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || loadingUser) return;
    let cancelled = false;
    (async () => {
      try {
        const spaces = await getSpaces(user.id);
        if (!cancelled) setAllSpaces(spaces);
      } catch (error) {
        console.error("getSpaces:", error);
        toast.error("Could not load your spaces");
      } finally {
        if (!cancelled) setLoadingSpace(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadingUser]);

  useEffect(() => {
    if (!user || loadingUser) return;
    let cancelled = false;
    (async () => {
      try {
        const notes = await getNotes(user.id);
        if (!cancelled) setAllNotes(notes);
      } catch (error) {
        console.error("getNotes:", error);
        toast.error("Could not load your notes");
      } finally {
        if (!cancelled) setLoadingNote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadingUser]);

  useEffect(() => {
    const logoTimer = setTimeout(() => setIsComplete(true), 5000);
    const removeTimer = setTimeout(() => setShowLogo(false), 6200);
    const dashboardTimer = setTimeout(() => setShowDashboard(true), 4500);
    return () => {
      clearTimeout(logoTimer);
      clearTimeout(removeTimer);
      clearTimeout(dashboardTimer);
    };
  }, []);

  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const pad = 32;
      const sx = (window.innerWidth - pad) / 1600;
      const sy = (window.innerHeight - pad) / 1000;
      setFitScale(Math.min(1, Math.min(sx, sy)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const bottomNavigationItems = useMemo(
    () => (view === "space" ? spaceBottomItems : homeBottomItems),
    [view],
  );

  const handleBackToGlobal = useCallback(() => {
    guardNav(() => {
      setView("home");
      setActiveViewport("editor");
      setFocusedSpace(null);
    });
  }, [guardNav]);

  const handleViewportChange = useCallback(
    (viewport: string) => {
      if (viewport === "settings" && activeViewport === "settings") return;
      const go = () => {
        if (viewport === "logOut") {
          setConfirmSignOut(true);
        } else if (viewport === "backToHome") {
          setView("home");
          setActiveViewport("editor");
          setFocusedSpace(null);
        } else if (viewport === "settings") {
          setView("home");
          setFocusedSpace(null);
          setActiveViewport("settings");
        } else if (["editor", "nexus", "notes", "letters"].includes(viewport)) {
          setActiveViewport(viewport as allViewports);
        } else if (
          [
            "dot",
            "outline",
            "tl;dr",
            "relationships",
            "understand",
            "exam",
          ].includes(viewport)
        ) {
          setActiveViewport(viewport as allViewports);
        }
      };
      guardNav(go);
    },
    [activeViewport, guardNav],
  );

  const handleSpaceChange = useCallback(
    (code: string) => {
      if (!allSpaces) return;
      const selected = allSpaces.find((spc) => spc.code === code);
      if (!selected) {
        console.warn("Space not found for code:", code);
        return;
      }
      guardNav(() => {
        setFocusedSpace(selected);
        setView("space");
        setActiveViewport("dot");
      });
    },
    [allSpaces, guardNav],
  );

  const handleNoteEdit = useCallback((noteToEdit: Note, spaceLinked: Space) => {
    setOptions({ handleEdit: { toEdit: noteToEdit, toSpace: spaceLinked } });
    setView("home");
    setActiveViewport("editEditor");
  }, []);

  const handleNoteArchive = useCallback(async (noteToArchive: Note) => {
    try {
      await archiveNote(noteToArchive.id);
      setAllNotes(
        (prev) => prev?.filter((n) => n.id !== noteToArchive.id) ?? [],
      );
      toast.success("Note deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete note");
    }
  }, []);

  const handleNoteView = useCallback((note: Note) => {
    setViewingNote(note);
  }, []);

  const handleSpaceUpdated = useCallback((updated: Space) => {
    setAllSpaces((prev) =>
      prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : [updated],
    );
    setFocusedSpace((prev) =>
      prev && prev.id === updated.id ? updated : prev,
    );
  }, []);

  const handleSpaceDelete = useCallback(
    async (space: Space) => {
      try {
        await deleteSpace(space.id);
        setAllSpaces((prev) =>
          prev ? prev.filter((s) => s.id !== space.id) : [],
        );
        setAllNotes((prev) =>
          prev ? prev.filter((n) => n.space_id !== space.id) : [],
        );
        if (focusedSpace?.id === space.id) {
          setFocusedSpace(null);
          setView("home");
          setActiveViewport("editor");
        }
        toast.success(`Deleted "${space.name}"`);
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Could not delete space",
        );
      }
    },
    [focusedSpace],
  );

  const handleNoteExport = useCallback(async (note: Note) => {
    try {
      toast.loading("Preparing PDF...", { id: "pdf-export" });
      await exportNoteAsPdf(note);
      toast.success("PDF downloaded", { id: "pdf-export" });
    } catch (err) {
      console.error("exportNoteAsPdf:", err);
      toast.error("Could not export note", { id: "pdf-export" });
    }
  }, []);

  const handleNotePin = useCallback(async (noteToPin: Note) => {
    const newPinnedState = !noteToPin.pinned;
    try {
      await pinNote(noteToPin.id, newPinnedState);
      setAllNotes((prev) =>
        prev
          ? prev.map((note) =>
              note.id === noteToPin.id
                ? { ...note, pinned: newPinnedState }
                : note,
            )
          : null,
      );
    } catch (err) {
      console.error(err);
      toast.error("Could not update pin");
    }
  }, []);

  const handleNoteDuplicate = useCallback(
    async (noteToDuplicate: Note): Promise<Note | null> => {
      if (!allNotes) return null;
      try {
        const existingTitles = allNotes.map((n) => n.title);
        const newTitle = generateCopyTitle(
          noteToDuplicate.title,
          existingTitles,
        );
        const data = await duplicateNote({
          ...noteToDuplicate,
          title: newTitle,
        });
        if (data) {
          setAllNotes((prev) => (prev ? [...prev, data] : [data]));
          toast.success("Note duplicated");
          return data;
        }
        return null;
      } catch (err) {
        console.error(err);
        toast.error("Could not duplicate note");
        return null;
      }
    },
    [allNotes],
  );

  const handleNoteSaved = useCallback((savedNote: Note) => {
    setAllNotes((prev) => {
      if (!prev) return [savedNote];
      const idx = prev.findIndex((n) => n.id === savedNote.id);
      if (idx === -1) return [...prev, savedNote];
      const next = [...prev];
      next[idx] = savedNote;
      return next;
    });
  }, []);

  const handleNotesRefetch = useCallback(async () => {
    if (!user) return;
    try {
      const notes = await getNotes(user.id);
      setAllNotes(notes);
    } catch (err) {
      console.error("getNotes refetch:", err);
    }
  }, [user]);

  const handleSpacesRefetch = useCallback(async () => {
    if (!user) return;
    try {
      const fresh = await getSpaces(user.id);
      setAllSpaces(fresh);
    } catch (err) {
      console.error("getSpaces refetch:", err);
    }
  }, [user]);

  // ---- Realtime: live updates without manual reloads ----
  // Notes (CRUD, processed flips, cache writes) → keep allNotes fresh.
  useRealtimeTable({
    table: "notes",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: Boolean(user),
    onChange: () => {
      void handleNotesRefetch();
    },
  });
  // Spaces (rename, delete, summary_cache writes) → keep allSpaces fresh.
  useRealtimeTable({
    table: "spaces",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: Boolean(user),
    onChange: () => {
      void handleSpacesRefetch();
    },
  });
  // Engine-completion signal — when an analyze run finishes, refetch notes
  // and broadcast so Nexus / Relationships / Understand pick up new
  // clusters, edges, diagnostics, summaries without a hard reload.
  useRealtimeTable({
    table: "analysis_runs",
    enabled: Boolean(user),
    onChange: (payload) => {
      const newRow = payload.new as Record<string, unknown> | null;
      const status = newRow ? (newRow["status"] as string | undefined) : undefined;
      const spaceId = newRow ? (newRow["space_id"] as string | undefined) : undefined;
      if (status === "ok") {
        void handleNotesRefetch();
        emitEngineUpdate({ space_id: spaceId ?? null, reason: "analysis_ok" });
      }
    },
  });

  const handleNoteToMoveToSpace = useCallback(
    async (noteToMove: Note, newSpace: Space): Promise<Note | null> => {
      if (!noteToMove || !newSpace) return null;
      try {
        const data = await moveNoteToSpace(noteToMove.id, newSpace.id);
        if (data) {
          setAllNotes((prev) =>
            prev ? prev.map((n) => (n.id === data.id ? data : n)) : [data],
          );
          toast.success(`Moved to ${newSpace.name}`);
          return data;
        }
        return null;
      } catch (err) {
        console.error(err);
        toast.error("Could not move note");
        return null;
      }
    },
    [],
  );

  const formatViewport = useCallback(
    (viewport: allViewports) => {
      if (!user) return "";
      const isFocused = Boolean(focusedSpace);
      let identifier = "";
      if (viewport === "editor") {
        identifier = " · editor";
      } else if (viewport === "editEditor") {
        identifier = options.handleEdit?.toEdit
          ? ` · editing ${truncate(options.handleEdit.toEdit.title, { length: 22 })}`
          : " · editing";
      } else if (viewport === "notes") {
        identifier = " · notes";
      } else if (viewport === "nexus") {
        identifier = " · nexus";
      } else if (viewport === "letters") {
        identifier = " · letters";
      } else if (viewport === "dot" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · dot`;
      } else if (viewport === "outline" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · outline`;
      } else if (viewport === "tl;dr" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · tl;dr`;
      } else if (viewport === "relationships" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · relationships`;
      } else if (viewport === "understand" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · understand`;
      } else if (viewport === "exam" && isFocused) {
        identifier = ` · ${focusedSpace?.code} · exam`;
      } else if (viewport === "settings") {
        identifier = " · settings";
      }
      const firstName = user.user_metadata["first_name"] as string | undefined;
      return (firstName?.toLowerCase() ?? "") + identifier;
    },
    [user, focusedSpace, options],
  );

  const focusedNotes = useMemo(() => {
    if (!user || !focusedSpace || !allNotes) return [];
    return allNotes.filter(
      (note) =>
        note.user_id === user.id &&
        note.archived === false &&
        note.space_id === focusedSpace.id,
    );
  }, [user, focusedSpace, allNotes]);

  const renderContent = (viewport: allViewports) => {
    if (!allSpaces || loadingSpace) return <UnrenderableContent />;
    if (!allNotes || loadingNote) return <UnrenderableContent />;
    if (!user || loadingUser) return <UnrenderableContent />;

    if (view === "space" && focusedSpace) {
      switch (viewport) {
        case "dot":
          return (
            <Dot
              allSpaces={allSpaces}
              allNotes={allNotes}
              userNotes={focusedNotes}
              focusedSpace={focusedSpace}
              onNoteClick={handleNoteView}
            />
          );
        case "outline":
          return (
            <SpaceOutline
              allSpaces={allSpaces}
              allNotes={allNotes}
              userNotes={focusedNotes}
              focusedSpace={focusedSpace}
            />
          );
        case "tl;dr":
          return (
            <SpaceTldr
              allSpaces={allSpaces}
              allNotes={allNotes}
              userNotes={focusedNotes}
              focusedSpace={focusedSpace}
            />
          );
        case "relationships":
          return (
            <SpaceRelationships
              focusedSpace={focusedSpace}
              userNotes={focusedNotes}
            />
          );
        case "understand":
          return (
            <SpaceUnderstand
              focusedSpace={focusedSpace}
              userNotes={focusedNotes}
              onNoteClick={handleNoteView}
            />
          );
        case "exam":
          return (
            <SpaceExam
              focusedSpace={focusedSpace}
              userNotes={focusedNotes}
              onActiveChange={setExamActive}
            />
          );
        default:
          return <UnrenderableContent />;
      }
    }

    switch (viewport) {
      case "editor":
        return (
          <Editor
            user={user}
            allSpaces={allSpaces}
            allNotes={allNotes}
            onNoteSaved={handleNoteSaved}
            apiRef={editorApiRef}
          />
        );
      case "editEditor":
        if (options.handleEdit) {
          return (
            <Editor
              user={user}
              allSpaces={allSpaces}
              allNotes={allNotes}
              noteContent={options.handleEdit.toEdit}
              spaceLinked={options.handleEdit.toSpace}
              onNoteSaved={handleNoteSaved}
              apiRef={editorApiRef}
            />
          );
        }
        return (
          <Editor
            user={user}
            allSpaces={allSpaces}
            allNotes={allNotes}
            onNoteSaved={handleNoteSaved}
            apiRef={editorApiRef}
          />
        );
      case "notes":
        return (
          <Notes
            allSpaces={allSpaces}
            allNotes={allNotes}
            handleNoteEdit={handleNoteEdit}
            handleNoteArchive={handleNoteArchive}
            handleNoteView={handleNoteView}
            handleNotePin={handleNotePin}
            handleNoteDuplicate={handleNoteDuplicate}
            handleNoteExport={handleNoteExport}
            handleNoteToMoveToSpace={handleNoteToMoveToSpace}
            onProcessed={handleNotesRefetch}
          />
        );
      case "nexus":
        return <Nexus allSpaces={allSpaces} allNotes={allNotes} />;
      case "letters":
        return <Letters allSpaces={allSpaces} />;
      case "settings":
        return (
          <SettingsPage
            user={user}
            allSpaces={allSpaces}
            apiRef={settingsApiRef}
          />
        );
      default:
        return <UnrenderableContent />;
    }
  };

  return (
    <div className="relative min-h-screen">
      <BillingBanner />
      {showLogo && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: isComplete ? 0 : 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex justify-center items-center bg-white"
        >
          <svg
            width="286.801"
            height="97"
            viewBox="0 0 286.801 97"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-md block mx-auto translate-y-[-80px]"
          >
            <g
              id="svgGroup"
              strokeLinecap="round"
              fillRule="evenodd"
              fontSize="9pt"
            >
              <motion.path
                d={LOGO_PATH}
                stroke="#000"
                strokeWidth="0.25mm"
                fill="transparent"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 5.5, ease: "easeInOut" }}
              />
            </g>
          </svg>
        </motion.div>
      )}

      <Toaster
        position="bottom-right"
        theme={isDark ? "dark" : "light"}
        toastOptions={{ className: "text-xs" }}
      />

      <NoteView
        note={viewingNote}
        space={
          viewingNote
            ? (allSpaces?.find((s) => s.id === viewingNote.space_id) ?? null)
            : null
        }
        onClose={() => setViewingNote(null)}
      />

      <AnimatePresence>
        {pendingNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-[360px] rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border-lg"
            >
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {pendingNav.kind === "exam"
                  ? "Leave exam in progress?"
                  : "Unsaved changes"}
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {pendingNav.kind === "settings"
                  ? "You have unsaved settings. Save them before leaving, or discard."
                  : pendingNav.kind === "exam"
                    ? "Your exam is still running. Leaving discards your answers and the timer keeps counting. Are you sure?"
                    : "You have unsaved note changes. Save to the space, or discard."}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  disabled={resolving}
                  onClick={() => setPendingNav(null)}
                  className="text-xs rounded-md px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                >
                  {pendingNav.kind === "exam" ? "Stay" : "Cancel"}
                </button>
                {pendingNav.kind === "exam" ? (
                  <button
                    disabled={resolving}
                    onClick={() => {
                      const next = pendingNav.run;
                      setExamActive(false);
                      setPendingNav(null);
                      next();
                    }}
                    className="text-xs rounded-md px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40"
                  >
                    Leave exam
                  </button>
                ) : (
                  <>
                    <button
                      disabled={resolving}
                      onClick={() => {
                        if (pendingNav.kind === "settings") {
                          settingsApiRef.current?.discard();
                        } else {
                          editorApiRef.current?.discard();
                        }
                        const next = pendingNav.run;
                        setPendingNav(null);
                        next();
                      }}
                      className="text-xs rounded-md px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                      Discard
                    </button>
                    <button
                      disabled={resolving}
                      onClick={async () => {
                        const api =
                          pendingNav.kind === "settings"
                            ? settingsApiRef.current
                            : editorApiRef.current;
                        if (!api) {
                          setPendingNav(null);
                          return;
                        }
                        setResolving(true);
                        try {
                          await api.save();
                          const next = pendingNav.run;
                          setPendingNav(null);
                          next();
                        } catch (err) {
                          console.error(err);
                          toast.error("Could not save");
                        } finally {
                          setResolving(false);
                        }
                      }}
                      className="text-xs rounded-md border border-zinc-800 dark:border-zinc-200 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-3 py-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
                    >
                      {resolving ? "Saving..." : "Save & continue"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingSpace && (
        <AddSpaceModal
          space={editingSpace}
          openControlled
          onOpenChange={(o) => {
            if (!o) setEditingSpace(null);
          }}
          onSpaceUpdated={(s) => {
            handleSpaceUpdated(s);
            setEditingSpace(null);
            toast.success("Space updated");
          }}
        />
      )}

      <AnimatePresence>
        {deletingSpace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-[380px] rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border-lg"
            >
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Delete &quot;{deletingSpace.name}&quot;?
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                This archives all notes in this space and removes the space.
                This cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setDeletingSpace(null)}
                  className="text-xs rounded-md px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const target = deletingSpace;
                    setDeletingSpace(null);
                    await handleSpaceDelete(target);
                  }}
                  className="text-xs rounded-md bg-red-600 text-white px-3 py-1.5 hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmSignOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-[340px] rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border-lg"
            >
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Sign out?
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                You&apos;ll need to sign back in to access your notes.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="text-xs rounded-md px-3 py-1.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmSignOut(false);
                    signOutAction();
                  }}
                  className="text-xs rounded-md border border-zinc-800 dark:border-zinc-200 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-3 py-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showDashboard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 h-full w-full bg-white dark:bg-zinc-950 transition-colors duration-500 ease-in-out">
            <div className="relative mx-auto flex h-screen items-center justify-center">
              <div
                className="absolute inset-0 z-0 rounded-2xl transition-[background-color] duration-1000 ease-in-out"
                style={{
                  filter: isDark ? "blur(80px)" : "blur(110px)",
                  backgroundColor: focusedSpace?.color
                    ? hexToRgba(focusedSpace.color, isDark ? 0.55 : 0.6)
                    : isDark
                      ? "rgba(34, 148, 241, 0.45)"
                      : "rgba(34, 148, 241, 0.55)",
                }}
              />

              <div
                className="relative h-[1000px] w-[1600px] overflow-hidden rounded-2xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md border border-gray-100/80 dark:border-zinc-800 transition-colors duration-500 ease-in-out flex glow-border-lg"
                style={{
                  transform: `scale(${fitScale})`,
                  transformOrigin: "center center",
                }}
              >
                <div className="w-[200px] border-r border-gray-100/80 dark:border-zinc-800 transition-colors duration-500 ease-in-out flex flex-col">
                  <div className="h-16 flex items-center justify-center mr-6 mt-6">
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.15,
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <button
                        onClick={handleBackToGlobal}
                        className="flex items-center text-zinc-800 hover:text-zinc-600 transition-colors"
                      >
                        <span className="text-6xl text-zinc-800 dark:text-zinc-100 font-medium font-handwriting">
                          .note
                        </span>
                      </button>
                    </motion.div>
                  </div>

                  <div className="flex-1 py-4 overflow-y-auto">
                    <ul className="space-y-2 px-2">
                      {view === "home"
                        ? homeNavigationItems.map((item, i) => (
                            <motion.li
                              key={item.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.35,
                                delay: 0.04 * i,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <button
                                onClick={() => handleViewportChange(item.id)}
                                className={cn(
                                  "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                  activeViewport === item.id
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100",
                                )}
                              >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.name}</span>
                              </button>
                            </motion.li>
                          ))
                        : spaceNavigationItems.map((item, i) => (
                            <motion.li
                              key={item.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.35,
                                delay: 0.04 * i,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <button
                                onClick={() => handleViewportChange(item.id)}
                                className={cn(
                                  "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                  activeViewport === item.id
                                    ? "text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100",
                                )}
                                style={
                                  activeViewport === item.id &&
                                  focusedSpace?.color
                                    ? {
                                        backgroundColor: hexToRgba(
                                          focusedSpace.color,
                                          isDark ? 0.3 : 0.2,
                                        ),
                                      }
                                    : {}
                                }
                              >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.name}</span>
                              </button>
                            </motion.li>
                          ))}
                    </ul>

                    {view === "home" && allSpaces && allSpaces.length === 0 && (
                      <div className="mt-8 px-4">
                        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">
                          Spaces
                        </div>
                        <p className="mt-3 text-[11px] text-center text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          No spaces yet. Use{" "}
                          <span className="font-semibold">+</span> below to
                          create one.
                        </p>
                      </div>
                    )}
                    {view === "home" && allSpaces && allSpaces.length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center justify-center mt-4">
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                            Spaces
                          </div>
                        </div>
                        <ul className="space-y-2 px-3 mt-4">
                          {allSpaces.map((spaceItem, i) => (
                            <motion.li
                              key={spaceItem.code}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.35,
                                delay: 0.04 * i + 0.08,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <div className="relative group/space">
                                <button
                                  onClick={() =>
                                    handleSpaceChange(spaceItem.code)
                                  }
                                  className={cn(
                                    "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors pr-7",
                                    focusedSpace === spaceItem
                                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100",
                                  )}
                                >
                                  <div
                                    className="h-2 w-2 rounded-full mr-3 flex-shrink-0"
                                    style={{
                                      backgroundColor: spaceItem.color,
                                    }}
                                  />
                                  <div className="truncate">
                                    <span>{spaceItem.name}</span>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSpaceMenuOpen(
                                      spaceMenuOpen === spaceItem.id
                                        ? null
                                        : spaceItem.id,
                                    );
                                  }}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/space:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity"
                                  aria-label="Space options"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </button>
                                {spaceMenuOpen === spaceItem.id && (
                                  <div
                                    className="absolute right-0 top-full mt-1 z-20 w-36 bg-white dark:bg-zinc-900 border border-gray-100/80 dark:border-zinc-800 rounded-md glow-border py-1 text-xs"
                                    onMouseLeave={() => setSpaceMenuOpen(null)}
                                  >
                                    <button
                                      onClick={() => {
                                        setSpaceMenuOpen(null);
                                        setEditingSpace(spaceItem);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                    >
                                      <Pencil className="h-3 w-3" /> Edit
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSpaceMenuOpen(null);
                                        setDeletingSpace(spaceItem);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto">
                    <div className="w-full flex justify-center px-2 mb-2">
                      {view !== "space" && (
                        <AddSpaceModal
                          onSpaceAdded={(spc) =>
                            setAllSpaces((prev) =>
                              prev ? [...prev, spc] : [spc],
                            )
                          }
                        />
                      )}
                    </div>
                    <div className="border-t border-gray-100/80 dark:border-zinc-800 pt-2 pb-4">
                      <TierBadge onClickUpgrade={() => router.push("/pricing")} />
                      <ul className="space-y-1 px-2">
                        {bottomNavigationItems.map((item, i) => (
                          <motion.li
                            key={item.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.35,
                              delay: 0.04 * i + 0.2,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <button
                              onClick={() => handleViewportChange(item.id)}
                              className={cn(
                                "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                                activeViewport === item.id
                                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100",
                              )}
                            >
                              <item.icon className="mr-2 h-4 w-4" />
                              <span>{item.name}</span>
                            </button>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="h-16 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      <motion.h1
                        key={formatViewport(activeViewport)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{
                          duration: 0.32,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="text-sm font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
                      >
                        {formatViewport(activeViewport)}
                      </motion.h1>
                    </AnimatePresence>
                  </div>

                  <Suspense>
                    <div className="flex-1 overflow-hidden p-6 relative">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={activeViewport}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="h-full"
                        >
                          {renderContent(activeViewport)}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
