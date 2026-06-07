import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renameBet } from "@/app/actions/bets";
import { RenameBetButton } from "./rename-bet-button";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace) => {
    return (key: string, _values?: Record<string, unknown>) => {
      return (
        {
          renameBetAriaLabel: "Rename bet",
          renameDialogTitle: "Rename bet",
          renameDialogDescription: "Enter a new label for this bet.",
          renameDialogInputPlaceholder: "Bet label (e.g. Spain wins it all)",
          cancel: "Cancel",
          save: "Save",
          saving: "Saving...",
          labelRequired: "Label is required",
          labelTooLong: "Label too long (max 200 chars)",
          genericError: "An error occurred",
          notAuthenticated: "Not authenticated",
          betNotFound: "Bet not found",
          notAuthorized: "Not authorized",
          betClosed: "Bet is closed",
          deadlinePassed: "Deadline passed",
        }[key] ?? key
      );
    };
  }),
}));

vi.mock("@/app/actions/bets", () => ({
  renameBet: vi.fn(),
}));

describe("RenameBetButton", () => {
  const mockRenameBet = vi.mocked(renameBet);

  beforeEach(() => {
    mockRenameBet.mockReset();
  });

  it("renders the pencil button with correct aria-label", () => {
    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Rename bet")).toBeInTheDocument();
  });

  it("opens the dialog with pre-filled input when clicked", async () => {
    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Rename bet")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("My Bet Label");
  });

  it("validates that input is not empty", async () => {
    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Label is required")).toBeInTheDocument();
    expect(mockRenameBet).not.toHaveBeenCalled();
  });

  it("validates that input is <= 200 chars", async () => {
    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel={"a".repeat(201)}
        onRenamed={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Label too long (max 200 chars)"),
    ).toBeInTheDocument();
    expect(mockRenameBet).not.toHaveBeenCalled();
  });

  it("submits the form, calls renameBet and calls onRenamed on success", async () => {
    const onRenamedMock = vi.fn();
    mockRenameBet.mockResolvedValue({ success: true });

    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={onRenamedMock}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "New Label");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockRenameBet).toHaveBeenCalledWith("bet-1", "New Label");
    expect(onRenamedMock).toHaveBeenCalledWith("New Label");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("displays error message from server if renameBet returns an error", async () => {
    mockRenameBet.mockResolvedValue({ error: "Bet is closed" });

    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "New Label");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockRenameBet).toHaveBeenCalledWith("bet-1", "New Label");
    expect(screen.getByText("Bet is closed")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("can be cancelled without making changes", async () => {
    const onRenamedMock = vi.fn();
    render(
      <RenameBetButton
        betId="bet-1"
        currentLabel="My Bet Label"
        onRenamed={onRenamedMock}
      />,
    );

    await userEvent.click(screen.getByLabelText("Rename bet"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRenamedMock).not.toHaveBeenCalled();
    expect(mockRenameBet).not.toHaveBeenCalled();
  });
});
