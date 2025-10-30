import type { FoodRead, IngredientRead } from "@/utils/nutrition";
import { createIngredientLookup, findIngredientInLookup } from "@/utils/nutrition";
import type { PlanItem } from "@/utils/planningTypes";

type IngredientUnit = NonNullable<IngredientRead["units"]>[number];

export type ShoppingListUnitTotal = {
  unitId: number | string | null;
  unitName: string;
  quantity: number;
  gramsPerUnit: number;
};

export type ShoppingListItem = {
  ingredientId: number | string | null;
  ingredient: IngredientRead;
  name: string;
  totalGrams: number;
  unitTotals: ShoppingListUnitTotal[];
  preferredUnitTotal: ShoppingListUnitTotal | null;
};

export type ShoppingListIssue = {
  type:
    | "missing-food"
    | "missing-ingredient"
    | "missing-unit"
    | "missing-quantity"
    | "missing-grams";
  message: string;
};

type AggregateParams = {
  plan: PlanItem[] | null | undefined;
  foods: FoodRead[] | null | undefined;
  ingredients: IngredientRead[] | null | undefined;
};

type Accumulator = {
  ingredient: IngredientRead;
  totalGrams: number;
  unitMap: Map<string, ShoppingListUnitTotal>;
};

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return String(value);
};

const formatUnitIdentifier = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeId(value);
  return normalized;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const resolveIngredientUnit = (
  ingredient: IngredientRead,
  rawUnitId: unknown,
): (IngredientUnit & { grams: number }) | undefined => {
  const units = ingredient.units ?? [];
  if (units.length === 0) return undefined;

  const normalizedRequested = normalizeId(rawUnitId);
  const findMatch = (target: string | null) =>
    units.find((unit) => normalizeId(unit.id) === target);

  if (normalizedRequested !== null) {
    const directMatch = findMatch(normalizedRequested);
    if (directMatch) {
      return { ...directMatch, grams: toNumber(directMatch.grams) };
    }

    if (normalizedRequested === "0") {
      const nullMatch = findMatch(null);
      if (nullMatch) {
        return { ...nullMatch, grams: toNumber(nullMatch.grams) };
      }
    }

    return undefined;
  }

  const nullUnit = findMatch(null);
  if (nullUnit) {
    return { ...nullUnit, grams: toNumber(nullUnit.grams) };
  }

  return undefined;
};

const resolvePreferredUnitId = (ingredient: IngredientRead): unknown => {
  const candidate =
    (ingredient as IngredientRead & { shoppingUnitId?: unknown }).shoppingUnitId ??
    (ingredient as IngredientRead & { shopping_unit_id?: unknown }).shopping_unit_id ??
    (ingredient as IngredientRead & { shopping_unit?: { id?: unknown } }).shopping_unit?.id ??
    null;
  if (candidate === undefined) return null;
  return candidate;
};

const addContribution = (
  totals: Map<string, Accumulator>,
  ingredient: IngredientRead,
  unit: IngredientUnit & { grams: number },
  quantity: number,
) => {
  if (quantity <= 0) return;
  const gramsPerUnit = unit.grams;
  if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) {
    return;
  }
  const grams = gramsPerUnit * quantity;
  if (!Number.isFinite(grams) || grams <= 0) {
    return;
  }

  const ingredientKey = normalizeId(ingredient.id) ?? ingredient.name ?? "";
  if (!ingredientKey) {
    return;
  }

  let accumulator = totals.get(ingredientKey);
  if (!accumulator) {
    accumulator = {
      ingredient,
      totalGrams: 0,
      unitMap: new Map(),
    };
    totals.set(ingredientKey, accumulator);
  }

  accumulator.totalGrams += grams;

  const unitKey = normalizeId(unit.id) ?? "__null__";
  const existing = accumulator.unitMap.get(unitKey);
  if (existing) {
    existing.quantity += quantity;
  } else {
    accumulator.unitMap.set(unitKey, {
      unitId: (unit.id as number | string | null) ?? null,
      unitName: unit.name ?? "",
      quantity,
      gramsPerUnit,
    });
  }
};

const createIssue = (type: ShoppingListIssue["type"], message: string): ShoppingListIssue => ({
  type,
  message,
});

export const aggregateShoppingList = ({
  plan,
  foods,
  ingredients,
}: AggregateParams): { items: ShoppingListItem[]; issues: ShoppingListIssue[] } => {
  const safePlan = Array.isArray(plan) ? plan : [];
  const safeFoods = Array.isArray(foods) ? foods : [];
  const ingredientLookup = createIngredientLookup(ingredients ?? []);
  const totals: Map<string, Accumulator> = new Map();
  const issues: ShoppingListIssue[] = [];

  safePlan.forEach((item, index) => {
    if (!item || typeof item !== "object" || !("type" in item)) {
      return;
    }

    if (item.type === "ingredient") {
      const ingredient = findIngredientInLookup(ingredientLookup, item.ingredientId);
      if (!ingredient) {
        issues.push(
          createIssue(
            "missing-ingredient",
            `Ingredient ${item.ingredientId ?? ""} could not be found for plan row ${index + 1}.`,
          ),
        );
        return;
      }

      const unit = resolveIngredientUnit(ingredient, item.unitId);
      if (!unit) {
        issues.push(
          createIssue(
            "missing-unit",
            `Ingredient "${ingredient.name}" is missing unit ${item.unitId ?? ""} required by the plan.`,
          ),
        );
        return;
      }

      if (!unit.grams || unit.grams <= 0) {
        issues.push(
          createIssue(
            "missing-grams",
            `Ingredient "${ingredient.name}" unit "${unit.name}" has no gram conversion.`,
          ),
        );
        return;
      }

      const amount = toNumber((item as typeof item).amount);
      if (amount <= 0) {
        issues.push(
          createIssue(
            "missing-quantity",
            `Ingredient "${ingredient.name}" has no valid quantity in the plan.`,
          ),
        );
        return;
      }

      const portions = toNumber((item as typeof item).portions ?? 1);
      if (portions <= 0) {
        issues.push(
          createIssue(
            "missing-quantity",
            `Ingredient "${ingredient.name}" has no valid portion count in the plan.`,
          ),
        );
        return;
      }

      addContribution(totals, ingredient, unit, amount * portions);
      return;
    }

    if (item.type === "food") {
      const food = safeFoods.find((candidate) => normalizeId(candidate.id) === normalizeId(item.foodId));
      if (!food) {
        issues.push(
          createIssue(
            "missing-food",
            `Food ${item.foodId ?? ""} referenced by the plan is unavailable.`,
          ),
        );
        return;
      }

      const portions = toNumber(item.portions);
      if (portions <= 0) {
        issues.push(
          createIssue(
            "missing-quantity",
            `Food "${food.name}" has no valid portion quantity in the plan.`,
          ),
        );
        return;
      }

      if (!Array.isArray(food.ingredients) || food.ingredients.length === 0) {
        issues.push(
          createIssue(
            "missing-ingredient",
            `Food "${food.name}" has no ingredient details and was skipped.`,
          ),
        );
        return;
      }

      food.ingredients.forEach((foodIngredient) => {
        const ingredient = findIngredientInLookup(
          ingredientLookup,
          foodIngredient.ingredient_id,
        );
        if (!ingredient) {
          issues.push(
            createIssue(
              "missing-ingredient",
              `Ingredient ${foodIngredient.ingredient_id ?? ""} from food "${food.name}" is unavailable.`,
            ),
          );
          return;
        }

        const overrideKey = foodIngredient.ingredient_id == null
          ? null
          : normalizeId(foodIngredient.ingredient_id);
        const override = overrideKey ? item.overrides?.[overrideKey] : undefined;

        const unit = resolveIngredientUnit(
          ingredient,
          override?.unitId ?? foodIngredient.unit_id,
        );

        if (!unit) {
          issues.push(
            createIssue(
              "missing-unit",
              `Ingredient "${ingredient.name}" in food "${food.name}" is missing unit ${(override?.unitId ?? foodIngredient.unit_id) ?? ""}.`,
            ),
          );
          return;
        }

        if (!unit.grams || unit.grams <= 0) {
          issues.push(
            createIssue(
              "missing-grams",
              `Ingredient "${ingredient.name}" unit "${unit.name}" in food "${food.name}" has no gram conversion.`,
            ),
          );
          return;
        }

        const perPortionQuantity = toNumber(
          override?.quantity ?? foodIngredient.unit_quantity,
        );
        if (perPortionQuantity <= 0) {
          issues.push(
            createIssue(
              "missing-quantity",
              `Ingredient "${ingredient.name}" in food "${food.name}" has no valid quantity.`,
            ),
          );
          return;
        }

        const totalQuantity = perPortionQuantity * portions;
        if (totalQuantity <= 0) {
          issues.push(
            createIssue(
              "missing-quantity",
              `Ingredient "${ingredient.name}" in food "${food.name}" results in zero quantity after scaling portions.`,
            ),
          );
          return;
        }

        addContribution(totals, ingredient, unit, totalQuantity);
      });
    }
  });

  const items: ShoppingListItem[] = Array.from(totals.values()).map((entry) => {
    const preferredUnitId = resolvePreferredUnitId(entry.ingredient);
    const preferredUnit =
      preferredUnitId !== null && preferredUnitId !== undefined
        ? resolveIngredientUnit(entry.ingredient, preferredUnitId)
        : undefined;
    const preferredUnitTotal =
      preferredUnit && preferredUnit.grams > 0
        ? {
            unitId: formatUnitIdentifier(
              preferredUnit.id ?? preferredUnitId ?? null,
            ),
            unitName: preferredUnit.name ?? "",
            quantity: entry.totalGrams / preferredUnit.grams,
            gramsPerUnit: preferredUnit.grams,
          }
        : null;

    return {
      ingredientId: (entry.ingredient.id as number | string | null) ?? null,
      ingredient: entry.ingredient,
      name: entry.ingredient.name ?? "Unnamed ingredient",
      totalGrams: entry.totalGrams,
      preferredUnitTotal:
        preferredUnitTotal &&
        Number.isFinite(preferredUnitTotal.quantity) &&
        preferredUnitTotal.quantity > 0
          ? preferredUnitTotal
          : null,
      unitTotals: Array.from(entry.unitMap.values())
        .filter((unit) => unit.quantity > 0 && unit.gramsPerUnit > 0)
        .sort((a, b) => {
          if (a.gramsPerUnit === b.gramsPerUnit) {
            return a.unitName.localeCompare(b.unitName);
          }
          return a.gramsPerUnit - b.gramsPerUnit;
        }),
    };
  });

  items.sort((a, b) => a.name.localeCompare(b.name));

  return { items, issues };
};

export type { AggregateParams };
