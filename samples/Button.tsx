export const Button = ({ onClick, label }: { onClick: () => void, label: string }) => {
  return (
    <div>
      <button onClick={onClick}>Click me</button>
    </div>
  );
};
