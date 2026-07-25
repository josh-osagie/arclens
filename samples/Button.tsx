import { ThemeContext } from "./ThemeContext";

export const Button = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) => {
  return (
    <ThemeContext.Provider value="light">
      <div>
        <button onClick={onClick}>Click me</button>
      </div>
    </ThemeContext.Provider>
  );
};
