import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import NutritionEdit from "./NutritionEdit";

describe("NutritionEdit", () => {
  const baseIngredient = {
    id: 1,
    name: "Test Ingredient",
    units: [
      {
        id: "unit-1",
        ingredient_id: 1,
        name: "g",
        grams: "1",
      },
    ],
    shoppingUnitId: "unit-1",
    nutrition: {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
    },
    tags: [],
  };

  it("allows users to type into the macro fields", async () => {
    render(
      <NutritionEdit
        ingredient={baseIngredient as never}
        dispatch={vi.fn()}
        needsClearForm={false}
        needsFillForm={false}
      />,
    );

    const caloriesInput = screen.getByLabelText(/calories/i) as HTMLInputElement;

    await userEvent.clear(caloriesInput);
    await userEvent.type(caloriesInput, "1");
    expect(caloriesInput).toHaveValue("1");

    await userEvent.type(caloriesInput, "2");
    expect(caloriesInput).toHaveValue("12");

    await userEvent.type(caloriesInput, "3");
    expect(caloriesInput).toHaveValue("123");
  });
});
