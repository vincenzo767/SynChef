import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Modal } from "./Modal";
import { TextField } from "./Field";
import { renderApp, testUser } from "@/test/utils";
import { RecipeCard } from "@/features/recipes/RecipeCard";
import type { RecipeSummary } from "@/lib/api/types";

describe("Modal", () => {
  it("is an accessible dialog that closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Delete dish?" description="This cannot be undone." onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>
    );
    const dialog = screen.getByRole("dialog", { name: "Delete dish?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close while busy", async () => {
    const onClose = vi.fn();
    render(<Modal open busy title="Saving" onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("TextField", () => {
  it("links errors to the input for screen readers", () => {
    render(<TextField label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email");
  });

  it("can reveal a password", async () => {
    render(<TextField label="Password" type="password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
  });
});

const recipe: RecipeSummary = {
  id: 2,
  name: "Italian Carbonara",
  description: "A rich Roman pasta.",
  imageUrl: null,
  cuisine: "Italian",
  region: "Europe",
  countryCode: "IT",
  countryName: "Italy",
  flagEmoji: "🇮🇹",
  totalTimeMinutes: 30,
  difficulty: "MEDIUM",
  defaultServings: 4,
  stepCount: 6,
  timerCount: 3
};

describe("RecipeCard", () => {
  it("renders recipe facts and links to the detail page", () => {
    renderApp(<RecipeCard recipe={recipe} />, { anonymous: true });
    expect(screen.getByRole("link", { name: "Italian Carbonara" })).toHaveAttribute("href", "/recipes/2");
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("3 timers")).toBeInTheDocument();
  });

  it("sends signed-out visitors to sign in when saving", async () => {
    renderApp(<RecipeCard recipe={recipe} />, { anonymous: true, extraRoutes: [{ path: "/login", element: <p>sign in page</p> }] });
    await userEvent.click(screen.getByRole("button", { name: "Save Italian Carbonara" }));
    expect(await screen.findByText("sign in page")).toBeInTheDocument();
  });

  it("shows saved state for favorites", () => {
    renderApp(<RecipeCard recipe={recipe} />, { user: { ...testUser, favoriteRecipeIds: [2] } });
    expect(screen.getByRole("button", { name: "Remove Italian Carbonara from saved recipes" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("router smoke", () => {
  it("renders inside a router", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
