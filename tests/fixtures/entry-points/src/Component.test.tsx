import { render } from "@testing-library/react";
import App from "./App";

it("mounts without crashing", () => {
  render(<App />);
});
