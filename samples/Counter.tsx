import React, { useEffect, useState } from "react";
import { Button } from "./Button";
import { fetchUser } from "./api";

const arr = [1, 2, 3, 4, 5];

export const Counter = () => {
  const [count, setCount] = useState(0);

  fetchUser("123")
    .then((user) => {
      console.log(user);
    })
    .catch((error) => {
      console.error(error);
    });

  return (
    <div>
      <p>Count: {count}</p>

      {/* <Button onClick={() => setCount(count + 1)} />
      <Button onClick={() => setCount(count - 1)} /> */}

      {arr.map((item) => (
        <div key={"item"}>{item}</div>
      ))}
    </div>
  );
};
