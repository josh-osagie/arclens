type Props = {
  text: string;
};

export function InfoTip({ text }: Props) {
  return (
    <span className="info-tip">
      <button type="button" className="info-tip__trigger" aria-label={text}>
        i
      </button>
      <span className="info-tip__tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}
