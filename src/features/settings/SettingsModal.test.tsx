import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

const { deleteSlackbuilder } = vi.hoisted(() => ({
  deleteSlackbuilder: vi.fn(),
}));

vi.mock("./deleteSlackbuilder", () => ({ deleteSlackbuilder }));

describe("SettingsModal delete Slackbuilder", () => {
  beforeEach(() => {
    deleteSlackbuilder.mockReset();
  });

  it("requires confirmation before deleting Slackbuilder", () => {
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /delete slackbuilder/i }));

    expect(
      screen.getByText(/This removes Slackbuilder and all local app data/i),
    ).toBeInTheDocument();
    expect(deleteSlackbuilder).not.toHaveBeenCalled();
  });

  it("runs deletion after the confirmation button is clicked", async () => {
    deleteSlackbuilder.mockResolvedValueOnce({ native: true });
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /delete slackbuilder/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => expect(deleteSlackbuilder).toHaveBeenCalledOnce());
  });

  it("shows an error when native deletion fails", async () => {
    deleteSlackbuilder.mockRejectedValueOnce(new Error("permission denied"));
    render(<SettingsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /delete slackbuilder/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    expect(await screen.findByText("permission denied")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete permanently/i }),
    ).not.toBeDisabled();
  });
});
