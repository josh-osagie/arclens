import { useEffect, useRef, useState } from "react";
import {
  DETAILS_FIELD_LABELS,
  DEFAULT_DETAILS_FIELDS,
  loadDetailsFields,
  saveDetailsFields,
  type DetailsFieldKey,
  type DetailsFieldPrefs,
} from "./detailsPanelPrefs";

type Props = {
  prefs: DetailsFieldPrefs;
  onChange: (prefs: DetailsFieldPrefs) => void;
};

const FIELD_GROUPS: Array<{ title: string; keys: DetailsFieldKey[] }> = [
  {
    title: "Summary",
    keys: ["export", "astKind", "usedBy", "dependsOn", "props"],
  },
  {
    title: "Incoming",
    keys: ["importedBy", "renderedBy", "calledFrom"],
  },
  {
    title: "Outgoing",
    keys: ["imports", "renders", "callsHooks"],
  },
];

export function DetailsFieldMenu({ prefs, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = (key: DetailsFieldKey) => {
    const next = { ...prefs, [key]: !prefs[key] };
    onChange(next);
    saveDetailsFields(next);
  };

  const reset = () => {
    const next = { ...DEFAULT_DETAILS_FIELDS };
    onChange(next);
    saveDetailsFields(next);
  };

  return (
    <div className="details-field-menu" ref={rootRef}>
      <button
        type="button"
        className="details-field-menu__trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        fields
      </button>
      {open && (
        <div className="details-field-menu__panel">
          <div className="details-field-menu__header">
            <p className="details-field-menu__title">fields</p>
            <button
              type="button"
              className="details-field-menu__close"
              aria-label="Close fields menu"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="details-field-menu__scroll atlas-scroll">
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="details-field-menu__group">
                <p className="details-field-menu__group-title">{group.title}</p>
                <ul className="details-field-menu__list">
                  {group.keys.map((key) => (
                    <li key={key}>
                      <label className="details-field-menu__option">
                        <input
                          type="checkbox"
                          checked={prefs[key]}
                          onChange={() => toggle(key)}
                        />
                        <span>{DETAILS_FIELD_LABELS[key]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="details-field-menu__reset"
            onClick={reset}
          >
            reset defaults
          </button>
        </div>
      )}
    </div>
  );
}

export function useDetailsFieldPrefs(): [
  DetailsFieldPrefs,
  (prefs: DetailsFieldPrefs) => void,
] {
  const [prefs, setPrefs] = useState<DetailsFieldPrefs>(() =>
    loadDetailsFields()
  );
  return [prefs, setPrefs];
}
