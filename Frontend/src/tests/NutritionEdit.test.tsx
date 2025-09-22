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

  it("clears default zero values when a macro field receives focus", async () => {
    const dispatch = vi.fn();
    const zeroIngredient = {
      ...buildIngredient(),
      nutrition: {
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fiber: 0,
      },
    };

    render(
      <NutritionEdit
        ingredient={zeroIngredient}
        dispatch={dispatch}
        needsClearForm={false}
        needsFillForm={false}
      />,
    );

    const proteinInput = screen.getByLabelText(/Protein/i);
    expect(proteinInput).toHaveValue("0");

    await userEvent.click(proteinInput);

    expect(proteinInput).toHaveValue("");
  });
});
