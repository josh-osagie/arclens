import React, { useState } from "react";
import { Button } from "./Button";

const arr = [1, 2, 3, 4, 5];

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>

      <Button onClick={() => setCount(count + 1)} />
      <Button onClick={() => setCount(count - 1)} />

      {arr.map((item) => (
        <div key={"item"}>{item}</div>
      ))}
    </div>
  );
};
