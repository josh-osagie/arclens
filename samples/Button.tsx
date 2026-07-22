export const Button = ({ onClick }: { onClick: () => void }) => {
  return (
    <div>
      <button onClick={onClick}>Click me</button>
    </div>
  );
};
