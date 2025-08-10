import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

var mockIngredientData;
var mockMealData;

jest.mock("../components/data/ingredient/IngredientData", () => ({
  __esModule: true,
  default: (...args) => mockIngredientData(...args),
}));

jest.mock("../components/data/meal/MealData", () => ({
  __esModule: true,
  default: (...args) => mockMealData(...args),
}));

mockIngredientData = jest.fn(() => <div>IngredientDataComponent</div>);
mockMealData = jest.fn(() => <div>MealDataComponent</div>);

import App from "../App";

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders tabs and switches between Meals and Ingredients views", () => {
  render(<App />);

  const mealsTab = screen.getByRole("tab", { name: /Meals/i });
  const ingredientsTab = screen.getByRole("tab", { name: /Ingredients/i });

  expect(mealsTab).toBeInTheDocument();
  expect(ingredientsTab).toBeInTheDocument();

  expect(mockMealData).toHaveBeenCalledTimes(1);
  expect(mockIngredientData).not.toHaveBeenCalled();

  fireEvent.click(ingredientsTab);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
  expect(mockMealData).toHaveBeenCalledTimes(1);

  fireEvent.click(mealsTab);
  expect(mockMealData).toHaveBeenCalledTimes(2);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
});

test("provides handleAddIngredientToPlan only to IngredientData", () => {
  render(<App />);

  // initial render shows MealData without the prop
  expect(mockIngredientData).not.toHaveBeenCalled();
  expect(mockMealData).toHaveBeenCalled();
  expect(mockMealData.mock.calls[0][0].handleAddIngredientToPlan).toBeUndefined();

  fireEvent.click(screen.getByRole("tab", { name: /Ingredients/i }));

  expect(mockIngredientData).toHaveBeenCalled();
  const props = mockIngredientData.mock.calls[0][0];
  expect(props.handleAddIngredientToPlan).toBeInstanceOf(Function);
});

