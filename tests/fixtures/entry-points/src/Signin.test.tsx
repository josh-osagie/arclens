import { render, screen } from "@testing-library/react";
import App from "./App";

describe("Signin", () => {
  it("renders the app", () => {
    render(<App />);
    expect(screen.getByText("App")).toBeInTheDocument();
  });
});
