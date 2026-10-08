import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldClasses, "min-h-[96px] resize-y py-3 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** Sets the textarea's height to its text's (borders included: the page is border-box). */
function fitHeight(node: HTMLTextAreaElement) {
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight + node.offsetHeight - node.clientHeight}px`;
}

/**
 * A one-line field whose text wraps and grows instead of hiding past the edge (a long option on a phone). It is as
 * tall as an input when the text is short, and still a single line of text: Enter and pasted line breaks add none.
 */
const GrowingTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, value, onChange, onKeyDown, ...props }, forwardedRef) => {
    const own = React.useRef<HTMLTextAreaElement | null>(null);
    const ref = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        own.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    React.useLayoutEffect(() => {
      if (own.current) fitHeight(own.current);
    }, [value]);

    // A new width wraps the text again (a panel sliding in, a phone turned sideways).
    React.useEffect(() => {
      const node = own.current;
      if (!node) return;
      let width = node.clientWidth;
      const observer = new ResizeObserver(() => {
        if (node.clientWidth === width) return; // its own height changed: nothing to wrap again
        width = node.clientWidth;
        fitHeight(node);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    return (
      <textarea
        ref={ref}
        rows={1}
        value={value}
        className={cn(fieldClasses, "block min-h-11 resize-none overflow-hidden py-2 leading-relaxed", className)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          onKeyDown?.(event);
        }}
        onChange={(event) => {
          if (/[\r\n]/.test(event.target.value)) event.target.value = event.target.value.replace(/\s*[\r\n]+\s*/g, " ");
          onChange?.(event);
        }}
        {...props}
      />
    );
  },
);
GrowingTextarea.displayName = "GrowingTextarea";

export { Textarea, GrowingTextarea };
