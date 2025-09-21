import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import NutritionEdit from "@/components/data/ingredient/form/NutritionEdit";

const buildIngredient = () => ({
  id: 1,
  name: "Test Ingredient",
  nutrition: {
    calories: 1,
    protein: 2,
    carbohydrates: 3,
    fat: 4,
    fiber: 5,
  },
  units: [
    {
      id: 1,
      ingredient_id: 1,
      name: "g",
      grams: 1,
    },
  ],
  shoppingUnitId: 1,
});

describe("NutritionEdit", () => {
  it("allows typing free-form macro values before blur", async () => {
    const dispatch = vi.fn();
    render(
      <NutritionEdit
        ingredient={buildIngredient()}
        dispatch={dispatch}
        needsClearForm={false}
        needsFillForm={false}
      />,
    );

    const caloriesInput = screen.getByLabelText(/Calories/i);
    await userEvent.clear(caloriesInput);
    await userEvent.type(caloriesInput, "123");

    expect(caloriesInput).toHaveValue("123");
  });
});
