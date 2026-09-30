import ReactMarkdown, { type Components } from "react-markdown";
import { safeHttpUrl } from "@/lib/safe-url";

// Defined once: a new `a` function on every render would remount the links each time.
const components: Components = {
  a: ({ href, children }) => {
    const url = safeHttpUrl(href);
    return url ? (
      <a href={url} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  img: () => null, // images from arbitrary URLs could track readers
  // The module's own title is the page's heading: the reading's headings go below it.
  h1: "h3",
  h2: "h3",
  h3: "h4",
};

/**
 * A module's reading, written in Markdown. Raw HTML is not rendered (react-markdown's default) and
 * links only work when they are http(s), opening in a new tab.
 */
export function Reading({ text }: { text: string }) {
  return (
    <div className="reading">
      <ReactMarkdown components={components} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
