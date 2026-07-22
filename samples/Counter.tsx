import React, { useEffect, useState } from "react";
import { Button } from "./Button";


export const counter = () => {
  const [count, setCount] = useState(0);
  if (count > 10) {
    useEffect(() => {
      console.log("count is greater than 10");
    }, [count]);
  }

  return (
    <div>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)} />
      <Button onClick={() => setCount(count - 1)} />
    </div>
  );
};
