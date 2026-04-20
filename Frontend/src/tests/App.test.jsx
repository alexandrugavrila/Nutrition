import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";

let mockIngredientData;
let mockFoodData;

vi.mock("@/components/data/ingredient/IngredientData", () => ({
  __esModule: true,
  default: (...args) => mockIngredientData(...args),
}));

vi.mock("@/components/data/food/FoodData", () => ({
  __esModule: true,
  default: (...args) => mockFoodData(...args),
}));

mockIngredientData = vi.fn(() => <div>IngredientDataComponent</div>);
mockFoodData = vi.fn(() => <div>FoodDataComponent</div>);

beforeEach(() => {
  vi.clearAllMocks();
});

const getLastCallArgs = (spy) => {
  const calls = spy.mock.calls;
  return calls[calls.length - 1] ?? [];
};

test("renders tabs and switches between Foods and Ingredients views", async () => {
  render(<App />);

  const foodContent = await screen.findByText("FoodDataComponent", {}, { timeout: 10000 });
  const ingredientContent = await screen.findByText(
    "IngredientDataComponent",
    {},
    { timeout: 10000 },
  );

  const foodsTab = await screen.findByRole("tab", { name: /Foods/i }, { timeout: 10000 });
  const ingredientsTab = await screen.findByRole(
    "tab",
    { name: /Ingredients/i },
    { timeout: 10000 },
  );
  const plansTab = await screen.findByRole("tab", { name: /Plans/i }, { timeout: 10000 });

  expect(foodsTab).toBeInTheDocument();
  expect(ingredientsTab).toBeInTheDocument();
  expect(plansTab).toBeInTheDocument();

  expect(foodContent).toBeVisible();
  expect(ingredientContent).not.toBeVisible();

  await userEvent.click(ingredientsTab);
  expect(ingredientContent).toBeVisible();
  expect(foodContent).not.toBeVisible();

  await userEvent.click(plansTab);
  expect(ingredientContent).not.toBeVisible();

  await userEvent.click(foodsTab);
  expect(foodContent).toBeVisible();
}, 15000);

test("provides handleAddIngredientToPlan only to IngredientData", async () => {
  render(<App />);

  await waitFor(() => {
    expect(mockFoodData).toHaveBeenCalled();
    expect(mockIngredientData).toHaveBeenCalled();
  }, { timeout: 10000 });

  const [foodProps] = getLastCallArgs(mockFoodData);
  const [ingredientProps] = getLastCallArgs(mockIngredientData);

  expect(foodProps.handleAddIngredientToPlan).toBeUndefined();
  expect(ingredientProps.handleAddIngredientToPlan).toBeUndefined();
}, 15000);
