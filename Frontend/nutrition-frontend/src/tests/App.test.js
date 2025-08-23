import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import App from "../App";

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

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders tabs and switches between Meals and Ingredients views", async () => {
  render(<App />);

  const mealsTab = screen.getByRole("tab", { name: /Meals/i });
  const ingredientsTab = screen.getByRole("tab", { name: /Ingredients/i });

  expect(mealsTab).toBeInTheDocument();
  expect(ingredientsTab).toBeInTheDocument();

  expect(mockMealData).toHaveBeenCalledTimes(1);
  expect(mockIngredientData).not.toHaveBeenCalled();

  await userEvent.click(ingredientsTab);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
  expect(mockMealData).toHaveBeenCalledTimes(1);

  await userEvent.click(mealsTab);
  expect(mockMealData).toHaveBeenCalledTimes(2);
  expect(mockIngredientData).toHaveBeenCalledTimes(1);
});

test("provides handleAddIngredientToPlan only to IngredientData", async () => {
  render(<App />);

  // initial render shows MealData without the prop
  expect(mockIngredientData).not.toHaveBeenCalled();
  expect(mockMealData).toHaveBeenCalled();
  expect(mockMealData.mock.calls[0][0].handleAddIngredientToPlan).toBeUndefined();

  await userEvent.click(screen.getByRole("tab", { name: /Ingredients/i }));

  expect(mockIngredientData).toHaveBeenCalled();
  const props = mockIngredientData.mock.calls[0][0];
  expect(props.handleAddIngredientToPlan).toBeInstanceOf(Function);
});

