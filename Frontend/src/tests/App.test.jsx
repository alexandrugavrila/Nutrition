import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, test, vi } from "vitest";

import App from "../App";

vi.mock("@/components/data/DataPage", () => ({
  __esModule: true,
  default: () => <div>DataPageComponent</div>,
}));

vi.mock("@/components/planning/Planning", () => ({
  __esModule: true,
  default: () => <div>PlanningComponent</div>,
}));

vi.mock("@/components/shopping/Shopping", () => ({
  __esModule: true,
  default: () => <div>ShoppingComponent</div>,
}));

vi.mock("@/components/cooking/Cooking", () => ({
  __esModule: true,
  default: () => <div>CookingComponent</div>,
}));

vi.mock("@/components/logging/Logging", () => ({
  __esModule: true,
  default: () => <div>LoggingComponent</div>,
}));

beforeEach(() => {
  window.history.pushState({}, "", "/");
});

test("renders the data page on the default route", async () => {
  render(<App />);

  expect(await screen.findByText("DataPageComponent")).toBeVisible();
  expect(screen.getByRole("button", { name: /open drawer/i })).toBeInTheDocument();
});

test("switches routes from the navigation drawer", async () => {
  render(<App />);

  expect(await screen.findByText("DataPageComponent")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: /open drawer/i }));
  await userEvent.click(screen.getByRole("link", { name: /^Planning$/i }));
  expect(await screen.findByText("PlanningComponent")).toBeVisible();

  await userEvent.click(screen.getByRole("link", { name: /^Logging$/i }));
  expect(await screen.findByText("LoggingComponent")).toBeVisible();
});

test("renders the current route on initial load", async () => {
  window.history.pushState({}, "", "/cooking");

  render(<App />);

  expect(await screen.findByText("CookingComponent")).toBeVisible();
});
