import { useState } from "react";

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  return { count, setCount };
}
