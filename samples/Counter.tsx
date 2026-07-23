import React, { useEffect, useState } from "react";
import { Button } from "./Button";


export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)} />
      <Button onClick={() => setCount(count - 1)} />
    </div>
  );
};
