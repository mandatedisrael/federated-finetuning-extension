"use client";

import * as React from "react";

/**
 * Sets document.title for client-rendered routes. Server-rendered
 * routes should prefer Next's metadata export — this hook fills
 * the a11y gap where the page is a client component.
 */
export function usePageTitle(title: string) {
  React.useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · FFE`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
