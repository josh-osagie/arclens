import { useEffect, useState } from "react";

export function BadComponent() {
  const [count, setCount] = useState(0);

  if (count > 10) {
    useEffect(() => {
      console.log("bad");
    }, [count]);
  }

  return <div>{count}</div>;
}
