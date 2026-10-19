import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusRow } from "@/components/health/status-row";

describe("StatusRow", () => {
  it("shows the label, value and hint as text (not colour alone)", () => {
    render(
      <ul>
        <StatusRow label="Claude AI" value="Off" status="off" hint="Add a key" testId="row" />
      </ul>,
    );
    expect(screen.getByText("Claude AI")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getByText("Add a key")).toBeInTheDocument();
    expect(screen.getByTestId("row")).toHaveAttribute("data-status", "off");
  });
});
