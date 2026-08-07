import { useCallback, useEffect, useState } from "react";
import {
  loadSourcePreviewExpanded,
  saveSourcePreviewExpanded,
} from "./detailsPanelPrefs";
import {
  DEFAULT_SNIPPET_LINES,
  fetchFileSnippet,
  resolveNodeSnippetPath,
  type SnippetResponse,
} from "./fileSnippet";
import { relFile } from "./buildFlowGraph";
import { highlightLine } from "./highlightLine";

type Props = {
  nodeFile: string;
  projectRoot?: string;
  maxLines?: number;
};

type ViewState =
  | { status: "skip" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snippet: SnippetResponse; relativeFile: string };

export function FileSnippetPreview({
  nodeFile,
  projectRoot,
  maxLines = DEFAULT_SNIPPET_LINES,
}: Props) {
  const [expanded, setExpanded] = useState(loadSourcePreviewExpanded);
  const [state, setState] = useState<ViewState>({ status: "loading" });

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      saveSourcePreviewExpanded(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (nodeFile === "external") {
      setState({ status: "skip" });
      return;
    }

    const relativeFile = resolveNodeSnippetPath(nodeFile, projectRoot);
    if (!relativeFile) {
      setState({
        status: "error",
        message: projectRoot
          ? "Could not resolve file path for preview."
          : "No project root in graph meta. Re-run analyze or set VITE_ARCLENS_PROJECT_ROOT.",
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetchFileSnippet(relativeFile, maxLines)
      .then((snippet) => {
        if (!cancelled) {
          setState({ status: "ready", snippet, relativeFile });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nodeFile, projectRoot, maxLines]);

  if (state.status === "skip") {
    return null;
  }

  return (
    <div className="details-section details-snippet">
      <div className="details-section__heading">
        <button
          type="button"
          className="details-section__heading-toggle"
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          <span className="details-section__chevron" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="details-section__heading-label">Source preview</span>
        </button>
      </div>

      {expanded && (
        <>
          {state.status === "loading" && (
            <p className="details-snippet__status">Loading snippet…</p>
          )}

          {state.status === "error" && (
            <div className="details-snippet__fallback">
              <p className="details-snippet__path">{relFile(nodeFile)}</p>
              <p className="details-snippet__status details-snippet__status--error">
                {state.message}
              </p>
            </div>
          )}

          {state.status === "ready" && (
            <>
              <p className="details-snippet__meta">
                {state.relativeFile}
                {state.snippet.truncated
                  ? ` · showing ${state.snippet.lines} of ${state.snippet.totalLines} lines`
                  : ` · ${state.snippet.totalLines} lines`}
              </p>
              <div className="details-snippet__code atlas-scroll" tabIndex={0}>
                <pre className="details-snippet__pre">
                  {state.snippet.content.split("\n").map((line, index) => {
                    const parts = highlightLine(line);
                    return (
                      <div
                        className="snippet-line"
                        key={`${state.relativeFile}-${index}`}
                      >
                        <span className="snippet-line__num">{index + 1}</span>
                        <code className="snippet-line__code">
                          {parts.map((part, partIndex) =>
                            part.className ? (
                              <span
                                className={part.className}
                                key={`${part.key}-${partIndex}`}
                              >
                                {part.text}
                              </span>
                            ) : (
                              <span key={`${part.key}-${partIndex}`}>
                                {part.text}
                              </span>
                            )
                          )}
                        </code>
                      </div>
                    );
                  })}
                </pre>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
