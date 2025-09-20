import { describe, expect, it } from "vitest";

import {
  createIngredientLookup,
  findIngredientInLookup,
  macrosForFood,
  macrosForIngredientPortion,
  ZERO_MACROS,
} from "@/utils/nutrition";
import type { FoodRead, IngredientRead } from "@/utils/nutrition";

type IngredientOverrides = Record<string, unknown>;

type IngredientFixtureOptions = IngredientOverrides & {
  id?: number;
};

const makeIngredient = (overrides: IngredientFixtureOptions = {}): IngredientRead => ({
  id: overrides.id ?? 1,
  name: "Fixture Ingredient",
  nutrition: {
    calories: 1,
    protein: 1,
    fat: 1,
    carbohydrates: 1,
    fiber: 1,
    ...(overrides.nutrition as Record<string, unknown> | undefined),
  } as unknown as IngredientRead["nutrition"],
  units: (overrides.units as IngredientRead["units"]) ?? ([
    { id: 1, name: "gram", grams: 1 },
  ] as unknown as IngredientRead["units"]),
  tags: [],
  ...overrides,
} as unknown as IngredientRead);

describe("macrosForIngredientPortion", () => {
  it("uses null units and parses string fields", () => {
    const ingredient = makeIngredient({
      units: [
        { id: null, name: "serving", grams: 2 },
        { id: 10, name: "cup", grams: 3 },
      ] as unknown as IngredientRead["units"],
      nutrition: {
        calories: "0.5",
        protein: "1.25",
        fat: "2",
        carbohydrates: "3",
        fiber: "0.4",
      } as unknown as IngredientRead["nutrition"],
    });

    const result = macrosForIngredientPortion({
      ingredient,
      unitId: null,
      quantity: "1.5",
    });

    expect(result.calories).toBeCloseTo(1.5);
    expect(result.protein).toBeCloseTo(3.75);
    expect(result.fat).toBeCloseTo(6);
    expect(result.carbs).toBeCloseTo(9);
    expect(result.fiber).toBeCloseTo(1.2);
  });

  it("falls back to 1g units when the target is missing", () => {
    const ingredient = makeIngredient({
      nutrition: {
        calories: 4,
        protein: 5,
        fat: 6,
        carbohydrates: 7,
        fiber: 8,
      } as unknown as IngredientRead["nutrition"],
      units: [
        { id: 20, name: "large", grams: 50 },
        { id: 21, name: "gram", grams: 1 },
      ] as unknown as IngredientRead["units"],
    });

    const result = macrosForIngredientPortion({
      ingredient,
      unitId: "missing",
      quantity: 3,
    });

    expect(result).toEqual({
      calories: 12,
      protein: 15,
      fat: 18,
      carbs: 21,
      fiber: 24,
    });
  });

  it("returns zero macros for malformed input values", () => {
    const ingredient = makeIngredient({
      units: [
        { id: 30, name: "mystery", grams: "invalid" },
      ] as unknown as IngredientRead["units"],
      nutrition: {
        calories: "bad",
        protein: null,
        fat: undefined,
        carbohydrates: "",
        fiber: "NaN",
      } as unknown as IngredientRead["nutrition"],
    });

    const result = macrosForIngredientPortion({
      ingredient,
      unitId: 30,
      quantity: "not-a-number",
    });

    expect(result).toEqual(ZERO_MACROS);
  });
});

describe("createIngredientLookup and findIngredientInLookup", () => {
  it("stores ingredients under numeric and string ids", () => {
    const ingredient = makeIngredient({ id: 42 });
    const lookup = createIngredientLookup([ingredient]);

    expect(lookup.get(42)).toBe(ingredient);
    expect(lookup.get("42")).toBe(ingredient);
    expect(findIngredientInLookup(lookup, 42)).toBe(ingredient);
    expect(findIngredientInLookup(lookup, "42")).toBe(ingredient);
  });

  it("normalizes lookup ids and handles missing values", () => {
    const ingredient = makeIngredient({ id: 7 });
    const lookup = createIngredientLookup([ingredient]);

    expect(findIngredientInLookup(lookup, "  ")).toBeUndefined();
    expect(findIngredientInLookup(lookup, "not-a-number")).toBeUndefined();
    expect(findIngredientInLookup(lookup, 999)).toBeUndefined();
  });
});

describe("macrosForFood", () => {
  const ingredientA = makeIngredient({
    id: 101,
    nutrition: {
      calories: 2,
      protein: 3,
      fat: 4,
      carbohydrates: 5,
      fiber: 6,
    } as unknown as IngredientRead["nutrition"],
    units: [
      { id: 11, name: "half", grams: 0.5 },
      { id: 12, name: "gram", grams: 1 },
    ] as unknown as IngredientRead["units"],
  });

  const ingredientB = makeIngredient({
    id: 202,
    nutrition: {
      calories: 10,
      protein: 0,
      fat: 1,
      carbohydrates: 2,
      fiber: 0,
    } as unknown as IngredientRead["nutrition"],
    units: [
      { id: 21, name: "double", grams: 2 },
    ] as unknown as IngredientRead["units"],
  });

  const lookup = createIngredientLookup([ingredientA, ingredientB]);

  it("sums macros, applies overrides, and ignores missing ingredients", () => {
    const food = {
      id: 1,
      name: "Fixture Food",
      ingredients: [
        { ingredient_id: ingredientA.id, unit_id: 11, unit_quantity: 2 },
        { ingredient_id: ingredientB.id, unit_id: 21, unit_quantity: 1.5 },
        { ingredient_id: 999, unit_id: 99, unit_quantity: 10 },
      ],
    } as unknown as FoodRead;

    const overrides = {
      [String(ingredientA.id)]: { unitId: 12, quantity: 3 },
    };

    const result = macrosForFood(food, lookup, overrides);

    expect(result).toEqual({
      calories: 36,
      protein: 9,
      fat: 15,
      carbs: 21,
      fiber: 18,
    });
  });

  it("returns zero macros when food has no ingredients", () => {
    expect(macrosForFood(undefined, lookup)).toEqual(ZERO_MACROS);
    expect(macrosForFood({ id: 2, name: "Empty" } as FoodRead, lookup)).toEqual(
      ZERO_MACROS,
    );
  });
});
