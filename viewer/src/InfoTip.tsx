import type { KeyboardEvent, MouseEvent } from "react";

type Props = {
  text: string;
  /** Use when InfoTip sits inside another button to avoid invalid nested buttons. */
  nested?: boolean;
};

function stopTriggerEvent(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

export function InfoTip({ text, nested = false }: Props) {
  const triggerProps = {
    className: "info-tip__trigger",
    "aria-label": text,
    onClick: stopTriggerEvent,
  };

  return (
    <span className="info-tip">
      {nested ? (
        <span
          {...triggerProps}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              stopTriggerEvent(event);
            }
          }}
        >
          i
        </span>
      ) : (
        <button type="button" {...triggerProps}>
          i
        </button>
      )}
      <span className="info-tip__tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}
