"use client";

import { useEffect } from "react";

// Public marketing surfaces (landing, auth) are designed in light mode only.
// If the user signed out from a dashboard that was in dark mode, the
// `<html class="dark">` flag persists in localStorage + on the root element
// and our radial-gradient + bg-white panels glitch over the dark
// background tokens.
//
// This component force-removes the dark class while it's mounted, and
// restores whatever was there on unmount, so navigating back into the
// dashboard picks up the user's preference.

export function ForceLightTheme() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    const prevScheme = html.style.colorScheme;
    html.classList.remove("dark");
    html.style.colorScheme = "light";
    return () => {
      if (wasDark) html.classList.add("dark");
      html.style.colorScheme = prevScheme;
    };
  }, []);
  return null;
}
