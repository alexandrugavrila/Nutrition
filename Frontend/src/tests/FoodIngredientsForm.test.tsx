import React from "react";
import { render, screen, within } from "@testing-library/react";
import { vi, type Mock } from "vitest";

import FoodIngredientsForm from "@/components/data/food/form/FoodIngredientsForm";
import { useData } from "@/contexts/DataContext";

vi.mock("@/contexts/DataContext");
vi.mock("@/components/data/ingredient/IngredientTable", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("@/components/common/IngredientModal", () => ({
  __esModule: true,
  default: () => null,
}));

const mockIngredient = {
  id: 1,
  name: "Test Ingredient",
  nutrition: {
    calories: 1,
    protein: 2,
    fat: 3,
    carbohydrates: 4,
    fiber: 5,
  },
  units: [
    { id: 10, ingredient_id: 1, name: "g", grams: 1 },
  ],
  tags: [],
  shoppingUnitId: 10,
};

const buildFood = () => ({
  id: null,
  name: "New food",
  ingredients: [
    {
      ingredient_id: 1,
      food_id: null,
      unit_id: 10,
      unit_quantity: 100,
    },
  ],
});

describe("FoodIngredientsForm macro summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useData as unknown as Mock).mockReturnValue({
      ingredients: [mockIngredient],
    });
  });

  it("shows a per-portion summary row while creating a food", async () => {
    render(
      <FoodIngredientsForm
        food={buildFood()}
        dispatch={vi.fn()}
        needsClearForm={false}
        recipeYield="4"
        onRecipeYieldChange={vi.fn()}
        isEditMode={false}
      />,
    );

    const perPortionHeader = await screen.findByRole("columnheader", { name: /^Per portion$/i });
    const row = perPortionHeader.closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row!).getAllByRole("columnheader");
    const numericCells = cells
      .slice(3)
      .map((cell) => (cell.textContent ?? "").trim());

    expect(numericCells).toEqual(["25", "50", "75", "100", "125"]);
  });

  it("hides the per-portion summary while editing a food", () => {
    render(
      <FoodIngredientsForm
        food={buildFood()}
        dispatch={vi.fn()}
        needsClearForm={false}
        recipeYield="1"
        onRecipeYieldChange={vi.fn()}
        isEditMode
      />,
    );

    expect(screen.queryByRole("columnheader", { name: /^Per portion$/i })).toBeNull();
  });
});

