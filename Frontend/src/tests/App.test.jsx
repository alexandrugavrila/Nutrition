import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";

let mockIngredientData;
let mockFoodData;

vi.mock("../components/data/ingredient/IngredientData", () => ({
  __esModule: true,
  default: (...args) => mockIngredientData(...args),
}));

vi.mock("../components/data/food/FoodData", () => ({
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

  const foodsTab = screen.getByRole("tab", { name: /Foods/i });
  const ingredientsTab = screen.getByRole("tab", { name: /Ingredients/i });
  const plansTab = screen.getByRole("tab", { name: /Plans/i });

  expect(foodsTab).toBeInTheDocument();
  expect(ingredientsTab).toBeInTheDocument();
  expect(plansTab).toBeInTheDocument();

  const foodContent = screen.getByText("FoodDataComponent");
  const ingredientContent = screen.getByText("IngredientDataComponent");

  expect(foodContent).toBeVisible();
  expect(ingredientContent).not.toBeVisible();

  await userEvent.click(ingredientsTab);
  expect(ingredientContent).toBeVisible();
  expect(foodContent).not.toBeVisible();

  await userEvent.click(plansTab);
  expect(ingredientContent).not.toBeVisible();

  await userEvent.click(foodsTab);
  expect(foodContent).toBeVisible();
});

test("provides handleAddIngredientToPlan only to IngredientData", () => {
  render(<App />);

  expect(mockFoodData).toHaveBeenCalled();
  expect(mockIngredientData).toHaveBeenCalled();

  const [foodProps] = getLastCallArgs(mockFoodData);
  const [ingredientProps] = getLastCallArgs(mockIngredientData);

  expect(foodProps.handleAddIngredientToPlan).toBeUndefined();
  expect(ingredientProps.handleAddIngredientToPlan).toBeInstanceOf(Function);
});
