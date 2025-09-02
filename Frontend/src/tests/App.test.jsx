import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../App";

var mockIngredientData;
var mockFoodData;

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

test("renders tabs and switches between Foods and Ingredients views", async () => {
  render(<App />);

  const foodsTab = screen.getByRole("tab", { name: /Foods/i });
  const ingredientsTab = screen.getByRole("tab", { name: /Ingredients/i });

  expect(foodsTab).toBeInTheDocument();
  expect(ingredientsTab).toBeInTheDocument();

  expect(mockFoodData).toHaveBeenCalledTimes(1);
  expect(mockIngredientData).not.toHaveBeenCalled();

  await userEvent.click(ingredientsTab);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
  expect(mockFoodData).toHaveBeenCalledTimes(1);

  await userEvent.click(foodsTab);
  expect(mockFoodData).toHaveBeenCalledTimes(2);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
});

test("provides handleAddIngredientToPlan only to IngredientData", async () => {
  render(<App />);

  // initial render shows FoodData without the prop
  expect(mockIngredientData).not.toHaveBeenCalled();
  expect(mockFoodData).toHaveBeenCalled();
  expect(mockFoodData.mock.calls[0][0].handleAddIngredientToPlan).toBeUndefined();

  await userEvent.click(screen.getByRole("tab", { name: /Ingredients/i }));

  expect(mockIngredientData).toHaveBeenCalled();
  const props = mockIngredientData.mock.calls[0][0];
  expect(props.handleAddIngredientToPlan).toBeInstanceOf(Function);
});

