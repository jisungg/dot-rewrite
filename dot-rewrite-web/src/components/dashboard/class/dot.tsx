"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Check, ArrowRight, Loader2 } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GlowEffect, TextEffect } from "@/components/effects";
import { cn } from "@/lib/utils";
import {
  type Space,
  type Note,
  AgentInformation,
  type Message,
} from "@/data/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fadeIn, slideInFromRight } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDisplayText, getRandomLoadingMessage } from "@/lib/string";
import { addMsgHistory, getMsgHistory } from "@/utils/supabase/queries";
import { Countdown } from "../components/countdown";
import { EmptyState, LoadingState } from "../components/agent-states";

interface DotProps {
  allSpaces: Space[];
  allNotes: Note[];
  userNotes: Note[];
  focusedSpace: Space;
}

const ArtificialIntelligence04Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    color="#000000"
    fill="none"
    {...props}
  >
    <path
      opacity="0.4"
      d="M4 12C4 8.22876 4 6.34315 5.17157 5.17157C6.34315 4 8.22876 4 12 4C15.7712 4 17.6569 4 18.8284 5.17157C20 6.34315 20 8.22876 20 12C20 15.7712 20 17.6569 18.8284 18.8284C17.6569 20 15.7712 20 12 20C8.22876 20 6.34315 20 5.17157 18.8284C4 17.6569 4 15.7712 4 12Z"
      fill="currentColor"
    />
    <path
      d="M4 12C4 8.22876 4 6.34315 5.17157 5.17157C6.34315 4 8.22876 4 12 4C15.7712 4 17.6569 4 18.8284 5.17157C20 6.34315 20 8.22876 20 12C20 15.7712 20 17.6569 18.8284 18.8284C17.6569 20 15.7712 20 12 20C8.22876 20 6.34315 20 5.17157 18.8284C4 17.6569 4 15.7712 4 12Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 15L9.34189 9.47434C9.43631 9.19107 9.7014 9 10 9C10.2986 9 10.5637 9.19107 10.6581 9.47434L12.5 15M8.5 13H11.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 9V15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 2V4M16 2V4M12 2V4M8 20V22M12 20V22M16 20V22M22 16H20M4 8H2M4 16H2M4 12H2M22 8H20M22 12H20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WorkHistoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    color="#000000"
    fill="none"
    {...props}
  >
    <path
      opacity="0.4"
      d="M9.60546 5.5H13.4082C16.9934 5.5 18.7861 5.5 19.8999 6.63496C20.7568 7.50819 20.9544 8.7909 21 11V13C21 13.6016 21 14.1551 20.9952 14.6655C20.1702 13.6493 18.9109 13 17.5 13C15.0147 13 13 15.0147 13 17.5C13 18.9109 13.6493 20.1702 14.6655 20.9952C14.1551 21 13.6015 21 13 21H9.60546C6.02021 21 4.22759 21 3.11379 19.865C2 18.7301 2 16.9034 2 13.25C2 9.59661 2 7.76992 3.11379 6.63496C4.22759 5.5 6.02021 5.5 9.60546 5.5Z"
      fill="currentColor"
    />
    <path
      d="M11.0065 21H9.60546C6.02021 21 4.22759 21 3.11379 19.865C2 18.7301 2 16.9034 2 13.25C2 9.59661 2 7.76992 3.11379 6.63496C4.22759 5.5 6.02021 5.5 9.60546 5.5H13.4082C16.9934 5.5 18.7861 5.5 19.8999 6.63496C20.7568 7.50819 20.9544 8.7909 21 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.85 18.85L17.5 17.95V15.7M13 17.5C13 19.9853 15.0147 22 17.5 22C19.9853 22 22 19.9853 22 17.5C22 15.0147 19.9853 13 17.5 13C15.0147 13 13 15.0147 13 17.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 5.5L15.9007 5.19094C15.4056 3.65089 15.1581 2.88087 14.5689 2.44043C13.9796 2 13.197 2 11.6316 2H11.3684C9.80304 2 9.02036 2 8.43111 2.44043C7.84186 2.88087 7.59436 3.65089 7.09934 5.19094L7 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DeletePutBackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    color="#000000"
    fill="none"
    {...props}
  >
    <path
      opacity="0.4"
      d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5H19.5Z"
      fill="currentColor"
    />
    <path
      d="M4.5 5.5L5.08671 15.1781C5.26178 18.066 5.34932 19.5099 6.14772 20.5018C6.38232 20.7932 6.65676 21.0505 6.96304 21.2662C8.00537 22 9.45801 22 12.3633 22H15.9867C17.4593 22 18.7162 20.9398 18.9583 19.4932C19.2643 17.6646 17.8483 16 15.9867 16H13.0357"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14.5 18.5C13.9943 18.0085 12 16.7002 12 16C12 15.2998 13.9943 13.9915 14.5 13.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 5.5H3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M16.0575 5.5L15.3748 4.09173C14.9213 3.15626 14.6946 2.68852 14.3035 2.39681C14.2167 2.3321 14.1249 2.27454 14.0288 2.2247C13.5957 2 13.0759 2 12.0363 2C10.9706 2 10.4377 2 9.99745 2.23412C9.89986 2.28601 9.80675 2.3459 9.71906 2.41317C9.3234 2.7167 9.10239 3.20155 8.66037 4.17126L8.05469 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M19 13.5L19.5 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default function Dot({ userNotes, focusedSpace }: DotProps) {
  const [message, setMessage] = useState<string>("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    "Reading your notes...",
  );
  const [focusedNote, setFocusedNote] = useState<Note | "all">("all");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [milliseconds, setMilliseconds] = useState(0);
  const [output, setOutput] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const hasMultipleTextAreas =
    AgentInformation.inputFields.filter((f) => f.type === "textarea").length >
    1;
  const hasSingleInputField =
    (AgentInformation.inputFields.length as number) === 1;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let msTimer: ReturnType<typeof setInterval> | undefined;

    if (loading) {
      setElapsedTime(0);
      setMilliseconds(0);
      timer = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
      msTimer = setInterval(
        () => setMilliseconds((prev) => (prev + 10) % 1000),
        10,
      );
    }

    return () => {
      if (timer) clearInterval(timer);
      if (msTimer) clearInterval(msTimer);
    };
  }, [loading]);

  useEffect(() => {
    const fetch = async () => {
      const msg_history = await getMsgHistory(focusedSpace.id);
      setMessageHistory(msg_history);
    };
    fetch();
  }, [focusedSpace.id]);

  const getSelectionText = () =>
    focusedNote === "all" ? "All Notes" : focusedNote.title;

  const resetState = useCallback(() => {
    setMessage("");
    setLoading(false);
  }, []);

  const handleInputChange = (value: string) => setMessage(value);

  const handleHistorySelect = (historyItem: Message) => {
    try {
      setMessage(historyItem.content);
      toast.success("Loaded from history");
    } catch {
      toast.error("Failed to load history item");
    }
  };

  const handleInputSubmit = async () => {
    if (message.trim() === "") {
      toast.error("Please enter an input or select an example");
      return;
    }

    setLoading(true);

    try {
      const mockResponse = `Dot has processed your message: "${message}"`;
      setOutput(mockResponse);

      await new Promise((r) => setTimeout(r, 50000));

      const userMessage = await addMsgHistory({
        space_id: focusedSpace.id,
        role: "user",
        content: message,
      });
      setMessageHistory((prev) => [...prev, userMessage]);
      setMessage("");
      setLoadingMessage(getRandomLoadingMessage());
    } catch (error) {
      toast.error("Failed to process request");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const firstInput = AgentInformation.inputFields[0];

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      <div className="flex-1 flex flex-col min-h-0 pb-4 bg-transparent overflow-hidden relative rounded-xl">
        <h2 className="text-[9px] font-medium text-zinc-700 dark:text-zinc-300 px-2 sm:px-4 pt-4">
          Input
        </h2>
        <div className="flex-1 flex flex-col md:flex-row min-h-0 w-[calc(100vw-1rem)] lg:w-full py-2">
          <motion.div
            variants={slideInFromRight}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full md:w-1/2 lg:w-2/5 mx-2 lg:m-2 rounded-b-2xl rounded-t-sm lg:rounded-2xl p-[1px] bg-white dark:bg-zinc-900 flex flex-col h-[calc(100vh-6rem)] lg:h-auto md:min-h-0 shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)]"
            style={{ opacity: 1, transform: "none" }}
          >
            <div
              className="flex-none sm:p-3 md:p-4 border-b border-gray-100/80 dark:border-zinc-800 bg-[#FAFAFA]/50 dark:bg-zinc-800/40 rounded-t-2xl"
              style={{ opacity: 1 }}
            >
              <div className="space-y-2 sm:space-y-3">
                <div
                  className="flex items-center justify-between"
                  style={{ opacity: 1, transform: "none" }}
                >
                  <label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] sm:text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Focused On: {focusedSpace.code.toUpperCase()}
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-gray-500 dark:hover:text-zinc-300 h-6 w-6 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-info h-3 sm:h-3.5 w-3 sm:w-3.5 text-neutral-500 dark:text-zinc-400"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-[300px] text-[11px] p-3 rounded-md"
                      >
                        <p>
                          Dot automatically focuses on all your notes, as a
                          collective. Select a specific note to tune and
                          specify Dot.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div
                  className="relative w-full"
                  style={{ opacity: 1, transform: "none" }}
                >
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] sm:text-xs border border-gray-100/80 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-1 truncate">
                        <span className="truncate">{getSelectionText()}</span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-gray-100/80 dark:border-zinc-700 rounded-md shadow-sm z-10 max-h-[200px] overflow-y-auto text-[11px] sm:text-xs text-gray-700 dark:text-zinc-300">
                        <div
                          className={cn(
                            "px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800",
                            focusedNote === "all"
                              ? "bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-zinc-100"
                              : "",
                          )}
                          onClick={() => {
                            setFocusedNote("all");
                            setIsDropdownOpen(false);
                          }}
                        >
                          All Notes
                        </div>

                        {userNotes.map((note) => (
                          <div
                            key={note.id}
                            className={cn(
                              "px-3 py-1.5 cursor-pointer truncate hover:bg-gray-50 dark:hover:bg-zinc-800",
                              focusedNote !== "all" &&
                                focusedNote.id === note.id
                                ? "bg-gray-100 dark:bg-zinc-800 font-medium text-gray-900 dark:text-zinc-100"
                                : "",
                            )}
                            onClick={() => {
                              setFocusedNote(note);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {note.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 w-full">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="p-2 sm:p-4 space-y-5"
              >
                <div className="flex items-center gap-1.5">
                  <Label
                    className={cn(
                      "text-xs font-medium transition-all duration-200",
                    )}
                  >
                    {firstInput.label}
                  </Label>
                  <AnimatePresence>
                    {message.trim() && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6, y: 5 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: 0,
                          transition: {
                            type: "spring",
                            stiffness: 500,
                            damping: 15,
                            mass: 0.5,
                          },
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.6,
                          y: 5,
                          transition: { duration: 0.2, ease: "easeOut" },
                        }}
                        className="flex items-center justify-center h-4 w-4 rounded-full bg-green-500/10 ring-1 ring-green-500/30"
                      >
                        <Check className="h-2.5 w-2.5 text-green-500 stroke-[3]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {firstInput.type === "textarea" ? (
                  <div className="relative p-1 rounded-[9px] group bg-white dark:bg-zinc-900 shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)] text-xs">
                    <Textarea
                      value={message}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder={firstInput.placeholder}
                      className={cn(
                        "rounded-[5px] resize-none text-xs leading-snug md:leading-relaxed md:text-[14px] caret-blue-400 border-none bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 ring-1 ring-[#F6F6F6] dark:ring-zinc-700 ring-offset-neutral-50 dark:ring-offset-zinc-900 ring-offset-1 transition-all duration-200 shadow-[0px_1px_0px_0px_hsla(0,_0%,_0%,_0.02)_inset,_0px_0px_0px_1px_hsla(0,_0%,_0%,_0.02)_inset,_0px_0px_0px_1px_rgba(255,_255,_255,_0.25)] focus-visible:ring-[#2B7BE5] focus-visible:ring-[1px] focus-visible:ring-offset-blue-100 focus-visible:ring-offset-2 ease-out",
                        hasMultipleTextAreas
                          ? "min-h-[150px] lg:min-h-[130px]"
                          : "min-h-[220px] lg:min-h-[240px]",
                        hasSingleInputField && "min-h-[340px] lg:min-h-[300px]",
                      )}
                    />
                    <div className="absolute bottom-3 right-3 text-[11px] text-neutral-400 dark:text-zinc-500 bg-white/80 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)]">
                      {message.length} chars
                    </div>
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={message}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={firstInput.placeholder}
                    className="text-[13px] border-none bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 ring-1 ring-[#F6F6F6] dark:ring-zinc-700 ring-offset-[#F6F6F6] dark:ring-offset-zinc-900 ring-offset-4 focus:border-neutral-300 focus:ring-neutral-200 transition-colors duration-200 shadow-[0px_1px_0px_0px_hsla(0,_0%,_0%,_0.02)_inset,_0px_0px_0px_1px_hsla(0,_0%,_0%,_0.02)_inset,_0px_0px_0px_1px_rgba(255,_255,_255,_0.25)] focus-visible:ring-neutral-300"
                  />
                )}
              </motion.div>
            </ScrollArea>
            <motion.div
              className="flex-none border-t border-gray-100/80 dark:border-zinc-800 bg-transparent"
              variants={fadeIn}
            >
              <div className="p-2 sm:p-4">
                <Card className="border-none rounded-lg px-2 pt-2 pb-2 relative bg-white dark:bg-zinc-900 shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)]">
                  <div className="text-[10px] text-neutral-600 dark:text-zinc-400">
                    <div className="px-2">
                      <h4 className="text-neutral-900 dark:text-zinc-100 flex items-center gap-1 text-[10px] py-[2px] font-medium">
                        <TextEffect className="text-neutral-900 dark:text-zinc-100">
                          {AgentInformation.name}
                        </TextEffect>
                      </h4>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="min-w-[100px] flex items-center gap-1 pl-1 absolute top-1.5 right-1.5 rounded-md px-[2px] py-[1px]">
                        <p className="font-medium text-muted-foreground/60 text-[9px]">
                          Average Processing Time
                        </p>
                        <div className="inline-block bg-neutral-50 dark:bg-zinc-800 px-1 py-0.5 text-[9px] rounded-sm text-neutral-800 dark:text-zinc-200 border border-black/10 dark:border-white/10">
                          <NumberFlow
                            value={AgentInformation.averageTime ?? 0}
                          />
                          s
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
            <div className="flex items-center justify-between gap-3 px-4 py-4 bg-[#FAFAFA]/50 dark:bg-zinc-800/40 border-t border-gray-100/80 dark:border-zinc-800 rounded-b-2xl">
              <Button
                variant="ghost"
                size="sm"
                disabled={loading || message.trim() === ""}
                onClick={resetState}
                className="group h-9 gap-1.5 rounded-lg bg-[#FFFFFF] dark:bg-zinc-800 text-[#36322F] dark:text-zinc-200 hover:enabled:bg-[#F8F8F8] dark:hover:enabled:bg-zinc-700 disabled:bg-[#F0F0F0] dark:disabled:bg-zinc-800/50 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#E0E0E0,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(0,_0,_0,_10%)] dark:[box-shadow:none] hover:enabled:[box-shadow:inset_0px_-2.53012px_0px_0px_#E8E8E8,_0px_1.44578px_7.59036px_0px_rgba(0,_0,_0,_12%)] dark:hover:enabled:[box-shadow:none] disabled:shadow-none border border-[#E0E0E0] dark:border-zinc-700 active:bg-[#F0F0F0] dark:active:bg-zinc-700 active:[box-shadow:inset_0px_-1.5px_0px_0px_#D8D8D8,_0px_0.5px_2px_0px_rgba(0,_0,_0,_15%)]"
              >
                <DeletePutBackIcon className="w-3.5 h-3.5 text-red-400" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="group h-9 gap-1.5 rounded-lg bg-[#FFFFFF] dark:bg-zinc-800 text-[#36322F] dark:text-zinc-200 hover:enabled:bg-[#F8F8F8] dark:hover:enabled:bg-zinc-700 disabled:bg-[#F0F0F0] dark:disabled:bg-zinc-800/50 [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#E0E0E0,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(0,_0,_0,_10%)] dark:[box-shadow:none] hover:enabled:[box-shadow:inset_0px_-2.53012px_0px_0px_#E8E8E8,_0px_1.44578px_7.59036px_0px_rgba(0,_0,_0,_12%)] dark:hover:enabled:[box-shadow:none] disabled:shadow-none border border-[#E0E0E0] dark:border-zinc-700 active:bg-[#F0F0F0] dark:active:bg-zinc-700 active:[box-shadow:inset_0px_-1.5px_0px_0px_#D8D8D8,_0px_0.5px_2px_0px_rgba(0,_0,_0,_15%)]"
                  >
                    <WorkHistoryIcon className="w-3.5 h-3.5" />
                    <span className="text-xs hidden md:block">History</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  sideOffset={4}
                  align="start"
                  className="w-[320px] max-h-[400px] overflow-y-auto"
                >
                  {messageHistory.length === 0 ? (
                    <div className="p-4 text-xs text-neutral-500 dark:text-zinc-400 text-center">
                      No history yet
                    </div>
                  ) : (
                    messageHistory.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => handleHistorySelect(item)}
                        className="py-2.5 px-3 break-all cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex-1 truncate text-xs">
                            {formatDisplayText(item.content)}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="relative w-full">
                {message.trim() !== "" && (
                  <GlowEffect
                    colors={["#FF5733", "#33FF57", "#3357FF", "#F1C40F"]}
                    mode="colorShift"
                    blur="soft"
                    duration={3}
                    scale={1.018}
                  />
                )}
                <button
                  onClick={handleInputSubmit}
                  className="rounded-lg w-full h-9 relative inline-flex text-center justify-center items-center gap-1 hover:bg-[#4a4542] dark:hover:bg-zinc-700 bg-[#36322F] dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-50 dark:text-zinc-100 outline-1 outline-[#fff2f21f] [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#171310,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(58,_33,_8,_58%)] dark:[box-shadow:none] hover:[box-shadow:inset_0px_-2.53012px_0px_0px_#171310,_0px_1.44578px_7.59036px_0px_rgba(58,_33,_8,_64%)] dark:hover:[box-shadow:none] border dark:border-zinc-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-5 animate-spin mr-1.5" />
                      <span className="text-xs">Processing...</span>
                    </>
                  ) : (
                    <>
                      <ArtificialIntelligence04Icon className="group-disabled:opacity-50 size-5 transition-all duration-200 ease-in-out group-disabled:fill-white group-hover:fill-blue-200 group-hover:rotate-12 text-blue-400 stroke-1 fill-black mr-1.5" />
                      <span className="text-xs">Run Dot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={slideInFromRight}
            className={cn(
              "flex flex-col min-h-0 overflow-hidden bg-transparent",
              "h-full w-full",
              "md:w-1/2 lg:w-3/5",
            )}
          >
            <h2 className="absolute top-4 right-4 hidden md:block text-[9px] font-medium text-zinc-700 dark:text-zinc-300">
              Output
            </h2>
            <div className="flex-none flex items-center justify-between w-full px-4 py-2 border-b border-gray-100/80 dark:border-zinc-800">
              {(loading || output) && (
                <Countdown
                  seconds={elapsedTime}
                  milliseconds={loading ? milliseconds : 0}
                  loading={loading}
                />
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                {loading ? (
                  <div className="flex flex-col">
                    <LoadingState
                      agent={AgentInformation}
                      elapsedTime={elapsedTime}
                      loadingMessage={loadingMessage}
                    />
                  </div>
                ) : output ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4 pb-16 text-gray-800 dark:text-zinc-100 text-sm"
                  >
                    <p>{output}</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <EmptyState agent={AgentInformation} />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
