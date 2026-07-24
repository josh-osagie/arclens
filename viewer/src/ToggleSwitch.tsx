type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  ariaLabel?: string;
};

export function ToggleSwitch({ checked, onChange, id, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`toggle-switch${checked ? " toggle-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch__thumb" aria-hidden="true" />
    </button>
  );
}
