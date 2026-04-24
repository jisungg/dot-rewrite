"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DialogEnhanced from "@/components/ui/dialog-enhanced";
import { addSpace, updateSpace } from "@/utils/supabase/queries";
import { generateLightColor } from "@/lib/color-utils";
import type { Space } from "@/data/types";

const PRESET_COLORS = [
  "#4F46E5",
  "#2563EB",
  "#0EA5E9",
  "#14B8A6",
  "#22C55E",
  "#EAB308",
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#A855F7",
  "#64748B",
  "#0A0A0A",
];

function hexValid(h: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(h);
}

export default function AddSpaceModal({
  onSpaceAdded,
  onSpaceUpdated,
  space,
  trigger,
  openControlled,
  onOpenChange,
}: {
  onSpaceAdded?: (space: Space) => void;
  onSpaceUpdated?: (space: Space) => void;
  space?: Space;
  trigger?: React.ReactNode;
  openControlled?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(space);

  const [name, setName] = useState(space?.name ?? "");
  const [code, setCode] = useState(space?.code ?? "");
  const [color, setColor] = useState(space?.color ?? "#4F46E5");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (space) {
      setName(space.name);
      setCode(space.code);
      setColor(space.color);
    }
  }, [space]);

  const validate = (): string | null => {
    if (!name.trim()) return "Please enter a name.";
    if (name.length > 25) return "Name must be ≤ 25 characters.";
    if (!code.trim()) return "Please enter a code.";
    if (code.length > 15) return "Code must be ≤ 15 characters.";
    if (!/^[a-zA-Z0-9-_]+$/.test(code))
      return "Code can only contain letters, numbers, '-', '_'.";
    if (!hexValid(color)) return "Pick a valid color.";
    return null;
  };

  const handleSubmit = async (close: () => void) => {
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    try {
      const color_light = generateLightColor(color);
      if (isEdit && space) {
        const updated = await updateSpace(space.id, {
          name,
          code,
          color,
          color_light,
        });
        onSpaceUpdated?.(updated);
      } else {
        const newSpace = await addSpace({ name, code, color, color_light });
        onSpaceAdded?.(newSpace);
      }
      setErrorMessage("");
      close();
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "Something went wrong.",
      );
    }
  };

  return (
    <DialogEnhanced
      title={isEdit ? "Edit Space" : "New Space"}
      description={
        isEdit ? "Update your space." : "Create a brand new space."
      }
      onSubmit={handleSubmit}
      open={openControlled}
      onOpenChange={onOpenChange}
      trigger={
        trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-zinc-500"
          >
            <Plus className="h-3 w-3" />
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1">
            A shorthand identifier for your space.
          </p>
          <Input
            placeholder="e.g. math101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={15}
          />
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">A name for your space.</p>
          <Input
            placeholder="e.g. Discrete Math"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={25}
          />
        </div>

        <div>
          <p className="text-xs text-zinc-500 mb-2">Color</p>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Pick ${c}`}
                className={`h-6 w-6 rounded-full border transition-transform ${
                  color.toLowerCase() === c.toLowerCase()
                    ? "border-zinc-900 dark:border-zinc-100 scale-110"
                    : "border-transparent hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-6 rounded-full border border-gray-100/80 dark:border-zinc-700 p-0 bg-transparent cursor-pointer"
                aria-label="Custom color"
              />
            </div>
          </div>
          <div
            className="h-8 w-full rounded-md shadow-inner"
            style={{
              background: `linear-gradient(90deg, ${hexValid(color) ? color : "#4F46E5"}33, ${generateLightColor(hexValid(color) ? color : "#4F46E5")})`,
            }}
          />
        </div>

        {errorMessage && (
          <p className="text-red-500 text-xs mt-2">{errorMessage}</p>
        )}
      </div>
    </DialogEnhanced>
  );
}
