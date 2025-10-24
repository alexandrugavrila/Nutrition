import type { components } from "@/api-types";

export type IngredientRead = components["schemas"]["IngredientRead"];
export type FoodRead = components["schemas"]["FoodRead"];
export type FoodIngredient = components["schemas"]["FoodIngredient"];

export type MacroTotals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
};

export type IngredientLookup = Map<string | number, IngredientRead>;

export type IngredientPortionInput = {
  ingredient: IngredientRead;
  unitId?: number | null | string;
  quantity?: number | null | string;
};

export type FoodOverride = {
  unitId?: number | null;
  quantity?: number | null;
};

export const ZERO_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
};

const ONE_GRAM = 1;

type IngredientUnitBase = NonNullable<IngredientRead["units"]>[number];
type NormalizedIngredientUnit = IngredientUnitBase & { grams: number };
type IngredientUnitMaybeGrams = IngredientUnitBase & { grams?: number | string | null };
type IngredientNutrition = NonNullable<IngredientRead["nutrition"]>;
type NutritionFields = {
  calories?: number | string | null;
  protein?: number | string | null;
  fat?: number | string | null;
  carbohydrates?: number | string | null;
  fiber?: number | string | null;
};

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return String(value);
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const readUnitGrams = (unit?: IngredientUnitBase | null): number => {
  if (!unit) return 0;
  const maybeUnit = unit as IngredientUnitMaybeGrams;
  return toNumber(maybeUnit.grams);
};

const normalizeUnit = (unit: IngredientUnitBase): NormalizedIngredientUnit => ({
  ...unit,
  grams: readUnitGrams(unit),
});

const resolveUnit = (
  units: IngredientRead["units"],
  targetUnitId: unknown,
): NormalizedIngredientUnit | undefined => {
  if (!units || units.length === 0) return undefined;
  const normalizedTarget = normalizeId(targetUnitId);
  if (normalizedTarget === null) {
    const nullUnit = units.find((unit) => unit.id === null || unit.id === undefined);
    if (nullUnit) return normalizeUnit(nullUnit);
  } else {
    const match = units.find((unit) => normalizeId(unit.id) === normalizedTarget);
    if (match) return normalizeUnit(match);
  }

  const gramUnit = units.find((unit) => readUnitGrams(unit) === ONE_GRAM);
  if (gramUnit) return normalizeUnit(gramUnit);

  return normalizeUnit(units[0]!);
};

const normalizeNutrition = (
  nutrition: IngredientRead["nutrition"],
): IngredientNutrition => {
  const safeNutrition = nutrition ?? ({} as IngredientNutrition);
  const fields = safeNutrition as NutritionFields;
  return {
    ...safeNutrition,
    calories: toNumber(fields.calories),
    protein: toNumber(fields.protein),
    fat: toNumber(fields.fat),
    carbohydrates: toNumber(fields.carbohydrates),
    fiber: toNumber(fields.fiber),
  } as IngredientNutrition;
};

const addMacro = (totals: MacroTotals, delta: MacroTotals): MacroTotals => ({
  calories: totals.calories + delta.calories,
  protein: totals.protein + delta.protein,
  fat: totals.fat + delta.fat,
  carbs: totals.carbs + delta.carbs,
  fiber: totals.fiber + delta.fiber,
});

export const addMacroTotals = addMacro;

export const sumMacroTotals = (
  values: MacroTotals[],
): MacroTotals => values.reduce(addMacro, { ...ZERO_MACROS });

export const macrosForIngredientPortion = (
  { ingredient, unitId, quantity }: IngredientPortionInput,
): MacroTotals => {
  if (!ingredient) return { ...ZERO_MACROS };

  const unit = resolveUnit(ingredient.units ?? [], unitId);
  const gramsPerUnit = unit?.grams ?? 0;
  const normalizedNutrition = normalizeNutrition(ingredient.nutrition);
  const normalizedQuantity = quantity === undefined || quantity === null
    ? 0
    : toNumber(quantity);

  return {
    calories: normalizedNutrition.calories * gramsPerUnit * normalizedQuantity,
    protein: normalizedNutrition.protein * gramsPerUnit * normalizedQuantity,
    fat: normalizedNutrition.fat * gramsPerUnit * normalizedQuantity,
    carbs: normalizedNutrition.carbohydrates * gramsPerUnit * normalizedQuantity,
    fiber: normalizedNutrition.fiber * gramsPerUnit * normalizedQuantity,
  };
};

export const gramsForIngredientPortion = ({
  ingredient,
  unitId,
  quantity,
}: IngredientPortionInput): number => {
  if (!ingredient) return 0;

  const unit = resolveUnit(ingredient.units ?? [], unitId);
  const gramsPerUnit = unit?.grams ?? 0;
  const normalizedQuantity = quantity === undefined || quantity === null
    ? 0
    : toNumber(quantity);

  return gramsPerUnit * normalizedQuantity;
};

export const findIngredientInLookup = (
  ingredientMap: IngredientLookup,
  ingredientId: unknown,
): IngredientRead | undefined => {
  if (!ingredientMap) return undefined;

  if (typeof ingredientId === "number" || typeof ingredientId === "string") {
    const direct = ingredientMap.get(ingredientId);
    if (direct) return direct;
  }

  const normalized = normalizeId(ingredientId);
  if (normalized === null) return undefined;

  const byString = ingredientMap.get(normalized);
  if (byString) return byString;

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) return undefined;
  return ingredientMap.get(numeric);
};

export const macrosForFood = (
  food: FoodRead | undefined,
  ingredientMap: IngredientLookup,
  overrides?: Record<string | number, FoodOverride>,
): MacroTotals => {
  if (!food || !Array.isArray(food.ingredients)) return { ...ZERO_MACROS };

  return food.ingredients.reduce((totals, foodIngredient) => {
    const ingredient = findIngredientInLookup(ingredientMap, foodIngredient.ingredient_id);
    if (!ingredient) return totals;

    const overrideKey = normalizeId(foodIngredient.ingredient_id);
    const override = overrideKey !== null ? overrides?.[overrideKey] : undefined;
    const portionMacros = macrosForIngredientPortion({
      ingredient,
      unitId: override?.unitId ?? foodIngredient.unit_id,
      quantity: override?.quantity ?? foodIngredient.unit_quantity,
    });
    return addMacro(totals, portionMacros);
  }, { ...ZERO_MACROS });
};

export const createIngredientLookup = (
  ingredients: IngredientRead[] | undefined,
): IngredientLookup => {
  const map: IngredientLookup = new Map();
  if (!ingredients) return map;
  ingredients.forEach((ingredient) => {
    const { id } = ingredient;
    if (id === null || id === undefined) return;
    map.set(id, ingredient);
    map.set(String(id), ingredient);
  });
  return map;
};
