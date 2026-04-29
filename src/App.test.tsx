import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the milestone 0 public dashboard placeholder", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "IPL Jatiloka Residence" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard publik")).toBeInTheDocument();
  });
});
