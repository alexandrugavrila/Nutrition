import React, { useCallback, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Remove,
  KeyboardArrowDown,
  KeyboardArrowRight,
} from "@mui/icons-material";

import { useData } from "@/contexts/DataContext";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import type {
  FoodPlanItem,
  IngredientPlanItem,
  PlanItem,
} from "@/utils/planningTypes";
import {
  ZERO_MACROS,
  addMacroTotals,
  createIngredientLookup,
  findIngredientInLookup,
  macrosForIngredientPortion,
} from "@/utils/nutrition";
import type { FoodRead, MacroTotals } from "@/utils/nutrition";
import { formatCellNumber } from "@/utils/utils";

const GRAM_UNIT_SENTINEL = 0;

const normalizePlanUnitId = (value: unknown): number => {
  if (value === null || value === undefined || value === "") {
    return GRAM_UNIT_SENTINEL;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return GRAM_UNIT_SENTINEL;
};

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampNonNegative = (value: number): number => (value < 0 ? 0 : value);

const planItemKey = (item: PlanItem, index: number): string => {
  if (item.type === "food") {
    return `food:${index}:${String(item.foodId ?? "")}`;
  }
  return `ingredient:${index}:${String(item.ingredientId ?? "")}`;
};

const foodIngredientKey = (
  planIndex: number,
  ingredientId: unknown,
): string => `foodIngredient:${planIndex}:${String(ingredientId ?? "")}`;

type CookingActualState = {
  portions: Record<string, number>;
  ingredientTotals: Record<string, number>;
};

type ActivePlanState = {
  id: number | null;
  label: string | null;
  updatedAt: string | null;
};

const initialActualState: CookingActualState = {
  portions: {},
  ingredientTotals: {},
};

const shallowEqualRecords = (
  a: Record<string, number>,
  b: Record<string, number>,
): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

const cookingStatesEqual = (
  a: CookingActualState,
  b: CookingActualState,
): boolean =>
  shallowEqualRecords(a.portions, b.portions) &&
  shallowEqualRecords(a.ingredientTotals, b.ingredientTotals);

const pluralize = (value: number, noun: string): string => {
  const rounded = Math.abs(value - 1) < 1e-6 ? 1 : value;
  if (Math.abs(rounded - 1) < 1e-6) {
    return `${formatCellNumber(value)} ${noun}`;
  }
  return `${formatCellNumber(value)} ${noun}s`;
};

const formatAmountWithUnit = (amount: number, unitName?: string | null): string => {
  if (!unitName || unitName.trim() === "") {
    return formatCellNumber(amount);
  }
  return `${formatCellNumber(amount)} ${unitName}`;
};

function Cooking() {
  const { foods, ingredients } = useData();
  const foodLookup = useMemo(() => {
    const map = new Map<string, FoodRead>();
    foods.forEach((food) => {
      const id = food?.id;
      if (id === null || id === undefined) return;
      map.set(String(id), food);
    });
    return map;
  }, [foods]);
  const ingredientLookup = useMemo(
    () => createIngredientLookup(ingredients),
    [ingredients],
  );

  const [plan] = useSessionStorageState<PlanItem[]>("planning-plan", () => []);
  const [days] = useSessionStorageState<number>("planning-days", 1);
  const [activePlan] = useSessionStorageState<ActivePlanState>(
    "planning-active-plan",
    () => ({ id: null, label: null, updatedAt: null }),
  );

  const [open, setOpen] = useSessionStorageState<Record<number, boolean>>(
    "cooking-open-state",
    () => ({}),
  );
  const [actualState, setActualState] =
    useSessionStorageState<CookingActualState>(
      "cooking-actuals",
      () => ({ ...initialActualState }),
    );

  const sanitizeActualState = useCallback(
    (prev: CookingActualState): CookingActualState => {
      const nextPortions: Record<string, number> = {};
      const nextIngredientTotals: Record<string, number> = {};

      plan.forEach((item, index) => {
        const itemKey = planItemKey(item, index);
        if (item.type === "food") {
          const plannedPortions = clampNonNegative(toFiniteNumber(item.portions));
          const storedPortion = prev.portions[itemKey];
          const normalizedPortion = isFiniteNumber(storedPortion)
            ? clampNonNegative(storedPortion)
            : plannedPortions;
          nextPortions[itemKey] = normalizedPortion;

          const food = foodLookup.get(String(item.foodId ?? ""));
          if (food && Array.isArray(food.ingredients)) {
            food.ingredients.forEach((ingredient) => {
              const override = item.overrides[String(ingredient.ingredient_id)];
              const perPortionQuantity = clampNonNegative(
                toFiniteNumber(override?.quantity ?? ingredient.unit_quantity),
              );
              const key = foodIngredientKey(index, ingredient.ingredient_id);
              const storedTotal = prev.ingredientTotals[key];
              const defaultTotal = perPortionQuantity * normalizedPortion;
              nextIngredientTotals[key] = isFiniteNumber(storedTotal)
                ? clampNonNegative(storedTotal)
                : defaultTotal;
            });
          }
        } else {
          const amount = clampNonNegative(toFiniteNumber(item.amount));
          const storedAmount = prev.ingredientTotals[itemKey];
          nextIngredientTotals[itemKey] = isFiniteNumber(storedAmount)
            ? clampNonNegative(storedAmount)
            : amount;
        }
      });

      return { portions: nextPortions, ingredientTotals: nextIngredientTotals };
    },
    [plan, foodLookup],
  );

  useEffect(() => {
    setActualState((prev) => {
      const sanitized = sanitizeActualState(prev);
      if (cookingStatesEqual(prev, sanitized)) {
        return prev;
      }
      return sanitized;
    });
  }, [sanitizeActualState, setActualState]);

  const toggleOpen = useCallback(
    (index: number) => {
      setOpen((prev) => ({ ...prev, [index]: !prev[index] }));
    },
    [setOpen],
  );

  const updateFoodPortion = useCallback(
    (item: FoodPlanItem, index: number, value: number) => {
      const key = planItemKey(item, index);
      const sanitizedValue = clampNonNegative(value);
      setActualState((prev) => {
        const previousValue = isFiniteNumber(prev.portions[key])
          ? clampNonNegative(prev.portions[key])
          : clampNonNegative(toFiniteNumber(item.portions));
        if (Object.is(previousValue, sanitizedValue)) {
          return prev;
        }

        const nextPortions = { ...prev.portions, [key]: sanitizedValue };
        const nextTotals = { ...prev.ingredientTotals };
        const food = foodLookup.get(String(item.foodId ?? ""));
        if (food && Array.isArray(food.ingredients)) {
          food.ingredients.forEach((ingredient) => {
            const ingredientKey = foodIngredientKey(index, ingredient.ingredient_id);
            const override = item.overrides[String(ingredient.ingredient_id)];
            const quantityPerPortion = clampNonNegative(
              toFiniteNumber(override?.quantity ?? ingredient.unit_quantity),
            );
            const previousExpected = quantityPerPortion * previousValue;
            const storedAmount = prev.ingredientTotals[ingredientKey];
            if (
              !isFiniteNumber(storedAmount) ||
              Math.abs(storedAmount - previousExpected) < 1e-6
            ) {
              nextTotals[ingredientKey] = quantityPerPortion * sanitizedValue;
            }
          });
        }

        return { portions: nextPortions, ingredientTotals: nextTotals };
      });
    },
    [foodLookup, setActualState],
  );

  const updateIngredientAmount = useCallback(
    (key: string, value: number) => {
      const sanitizedValue = clampNonNegative(value);
      setActualState((prev) => {
        const current = clampNonNegative(toFiniteNumber(prev.ingredientTotals[key]));
        if (Object.is(current, sanitizedValue)) {
          if (prev.ingredientTotals[key] !== undefined) {
            return prev;
          }
          if (sanitizedValue === 0) {
            return prev;
          }
        }
        return {
          portions: prev.portions,
          ingredientTotals: { ...prev.ingredientTotals, [key]: sanitizedValue },
        };
      });
    },
    [setActualState],
  );

  const adjustIngredientAmount = useCallback(
    (key: string, delta: number) => {
      setActualState((prev) => {
        const current = clampNonNegative(toFiniteNumber(prev.ingredientTotals[key]));
        const nextValue = clampNonNegative(current + delta);
        if (Object.is(current, nextValue)) {
          return prev;
        }
        return {
          portions: prev.portions,
          ingredientTotals: { ...prev.ingredientTotals, [key]: nextValue },
        };
      });
    },
    [setActualState],
  );

  const computeFoodActualMacros = useCallback(
    (item: FoodPlanItem, index: number): MacroTotals => {
      const food = foodLookup.get(String(item.foodId ?? ""));
      if (!food || !Array.isArray(food.ingredients)) {
        return { ...ZERO_MACROS };
      }

      return food.ingredients.reduce((totals, ingredient) => {
        const dataIngredient = findIngredientInLookup(
          ingredientLookup,
          ingredient.ingredient_id,
        );
        if (!dataIngredient) {
          return totals;
        }
        const key = foodIngredientKey(index, ingredient.ingredient_id);
        const actualAmount = clampNonNegative(
          toFiniteNumber(actualState.ingredientTotals[key]),
        );
        const override = item.overrides[String(ingredient.ingredient_id)];
        const unitId = normalizePlanUnitId(override?.unitId ?? ingredient.unit_id);
        const ingredientMacros = macrosForIngredientPortion({
          ingredient: dataIngredient,
          unitId,
          quantity: actualAmount,
        });
        return addMacroTotals(totals, ingredientMacros);
      }, { ...ZERO_MACROS });
    },
    [actualState.ingredientTotals, foodLookup, ingredientLookup],
  );

  const totalActualMacros = useMemo(
    () =>
      plan.reduce((totals, item, index) => {
        if (item.type === "food") {
          const foodMacros = computeFoodActualMacros(item, index);
          return addMacroTotals(totals, foodMacros);
        }
        const ingredient = findIngredientInLookup(
          ingredientLookup,
          (item as IngredientPlanItem).ingredientId,
        );
        const key = planItemKey(item, index);
        const actualAmount = clampNonNegative(
          toFiniteNumber(actualState.ingredientTotals[key]),
        );
        const unitId = normalizePlanUnitId((item as IngredientPlanItem).unitId);
        const macros = macrosForIngredientPortion({
          ingredient,
          unitId,
          quantity: actualAmount,
        });
        return addMacroTotals(totals, macros);
      }, { ...ZERO_MACROS }),
    [
      actualState.ingredientTotals,
      computeFoodActualMacros,
      ingredientLookup,
      plan,
    ],
  );

  const normalizedDays = Number.isFinite(days) && days > 0 ? days : 1;
  const perDayActualMacros = useMemo<MacroTotals>(
    () => ({
      calories: totalActualMacros.calories / normalizedDays,
      protein: totalActualMacros.protein / normalizedDays,
      carbs: totalActualMacros.carbs / normalizedDays,
      fat: totalActualMacros.fat / normalizedDays,
      fiber: totalActualMacros.fiber / normalizedDays,
    }),
    [normalizedDays, totalActualMacros],
  );

  const planIsEmpty = !plan || plan.length === 0;
  const planLabel = activePlan.label?.trim()
    ? `Based on plan "${activePlan.label}"`
    : "Based on current plan";

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Cooking
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {planLabel}
        </Typography>
      </Box>

      {planIsEmpty ? (
        <Alert severity="info">
          Build a plan in the Planning tab to capture your actual cooking amounts.
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Item</TableCell>
                  <TableCell>Planned Amount</TableCell>
                  <TableCell>Actual Amount</TableCell>
                  <TableCell>Calories</TableCell>
                  <TableCell>Protein</TableCell>
                  <TableCell>Carbs</TableCell>
                  <TableCell>Fat</TableCell>
                  <TableCell>Fiber</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plan.map((item, index) => {
                  if (item.type === "food") {
                    const foodItem = item as FoodPlanItem;
                    const food = foodLookup.get(String(foodItem.foodId ?? ""));
                    const portionKey = planItemKey(foodItem, index);
                    const actualPortions = clampNonNegative(
                      toFiniteNumber(actualState.portions[portionKey] ?? foodItem.portions),
                    );
                    const foodMacros = computeFoodActualMacros(foodItem, index);

                    return (
                      <React.Fragment key={`food-${index}-${foodItem.foodId}`}>
                        <TableRow>
                          <TableCell>
                            <IconButton
                              size="small"
                              aria-label={open[index] ? "collapse" : "expand"}
                              onClick={() => toggleOpen(index)}
                            >
                              {open[index] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{food?.name ?? "Unnamed food"}</TableCell>
                          <TableCell>{pluralize(foodItem.portions, "portion")}</TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <IconButton
                                size="small"
                                aria-label="decrement actual portions"
                                onClick={() =>
                                  updateFoodPortion(
                                    foodItem,
                                    index,
                                    Math.max(0, actualPortions - 1),
                                  )
                                }
                                disabled={actualPortions <= 0}
                              >
                                <Remove fontSize="small" />
                              </IconButton>
                              <TextField
                                type="number"
                                value={actualPortions}
                                onChange={(event) =>
                                  updateFoodPortion(
                                    foodItem,
                                    index,
                                    clampNonNegative(
                                      Number.parseFloat(event.target.value) || 0,
                                    ),
                                  )
                                }
                                sx={{ width: 100 }}
                                inputProps={{ min: 0, step: "any" }}
                              />
                              <IconButton
                                size="small"
                                aria-label="increment actual portions"
                                onClick={() =>
                                  updateFoodPortion(foodItem, index, actualPortions + 1)
                                }
                              >
                                <Add fontSize="small" />
                              </IconButton>
                              <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                                portions
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{formatCellNumber(foodMacros.calories)}</TableCell>
                          <TableCell>{formatCellNumber(foodMacros.protein)}</TableCell>
                          <TableCell>{formatCellNumber(foodMacros.carbs)}</TableCell>
                          <TableCell>{formatCellNumber(foodMacros.fat)}</TableCell>
                          <TableCell>{formatCellNumber(foodMacros.fiber)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                            <Collapse in={open[index]} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1 }}>
                                <Typography variant="h6" gutterBottom component="div">
                                  Ingredients
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Unit</TableCell>
                                      <TableCell>Planned Amount</TableCell>
                                      <TableCell>Actual Amount</TableCell>
                                      <TableCell>Calories</TableCell>
                                      <TableCell>Protein</TableCell>
                                      <TableCell>Carbs</TableCell>
                                      <TableCell>Fat</TableCell>
                                      <TableCell>Fiber</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {(food?.ingredients ?? []).map((ingredient) => {
                                      const dataIngredient = findIngredientInLookup(
                                        ingredientLookup,
                                        ingredient.ingredient_id,
                                      );
                                      const override =
                                        foodItem.overrides[String(ingredient.ingredient_id)];
                                      const unitId = normalizePlanUnitId(
                                        override?.unitId ?? ingredient.unit_id,
                                      );
                                      const unitName = (dataIngredient?.units ?? []).find(
                                        (unit) => normalizePlanUnitId(unit.id) === unitId,
                                      )?.name;
                                      const plannedQuantity = clampNonNegative(
                                        toFiniteNumber(
                                          override?.quantity ?? ingredient.unit_quantity,
                                        ),
                                      );
                                      const plannedTotal = plannedQuantity * foodItem.portions;
                                      const ingredientKey = foodIngredientKey(
                                        index,
                                        ingredient.ingredient_id,
                                      );
                                      const actualAmount = clampNonNegative(
                                        toFiniteNumber(
                                          actualState.ingredientTotals[ingredientKey],
                                        ),
                                      );
                                      const ingredientMacros = macrosForIngredientPortion({
                                        ingredient: dataIngredient,
                                        unitId,
                                        quantity: actualAmount,
                                      });

                                      return (
                                        <TableRow
                                          key={`food-${index}-ingredient-${ingredient.ingredient_id}`}
                                        >
                                          <TableCell>
                                            {dataIngredient?.name ?? "Ingredient"}
                                          </TableCell>
                                          <TableCell>{unitName ?? ""}</TableCell>
                                          <TableCell>
                                            {formatAmountWithUnit(plannedTotal, unitName)}
                                          </TableCell>
                                          <TableCell>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <IconButton
                                                size="small"
                                                aria-label="decrement actual amount"
                                                onClick={() =>
                                                  adjustIngredientAmount(
                                                    ingredientKey,
                                                    -1,
                                                  )
                                                }
                                                disabled={actualAmount <= 0}
                                              >
                                                <Remove fontSize="small" />
                                              </IconButton>
                                              <TextField
                                                type="number"
                                                value={actualAmount}
                                                onChange={(event) =>
                                                  updateIngredientAmount(
                                                    ingredientKey,
                                                    clampNonNegative(
                                                      Number.parseFloat(event.target.value) || 0,
                                                    ),
                                                  )
                                                }
                                                sx={{ width: 100 }}
                                                inputProps={{ min: 0, step: "any" }}
                                              />
                                              <IconButton
                                                size="small"
                                                aria-label="increment actual amount"
                                                onClick={() =>
                                                  adjustIngredientAmount(
                                                    ingredientKey,
                                                    1,
                                                  )
                                                }
                                              >
                                                <Add fontSize="small" />
                                              </IconButton>
                                              {unitName && (
                                                <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                                                  {unitName}
                                                </Box>
                                              )}
                                            </Box>
                                          </TableCell>
                                          <TableCell>
                                            {formatCellNumber(ingredientMacros.calories)}
                                          </TableCell>
                                          <TableCell>
                                            {formatCellNumber(ingredientMacros.protein)}
                                          </TableCell>
                                          <TableCell>
                                            {formatCellNumber(ingredientMacros.carbs)}
                                          </TableCell>
                                          <TableCell>
                                            {formatCellNumber(ingredientMacros.fat)}
                                          </TableCell>
                                          <TableCell>
                                            {formatCellNumber(ingredientMacros.fiber)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  }

                  const ingredientItem = item as IngredientPlanItem;
                  const ingredient = findIngredientInLookup(
                    ingredientLookup,
                    ingredientItem.ingredientId,
                  );
                  const unitId = normalizePlanUnitId(ingredientItem.unitId);
                  const unitName = (ingredient?.units ?? []).find(
                    (unit) => normalizePlanUnitId(unit.id) === unitId,
                  )?.name;
                  const ingredientKey = planItemKey(item, index);
                  const actualAmount = clampNonNegative(
                    toFiniteNumber(actualState.ingredientTotals[ingredientKey]),
                  );
                  const ingredientMacros = macrosForIngredientPortion({
                    ingredient,
                    unitId,
                    quantity: actualAmount,
                  });

                  return (
                    <TableRow key={`ingredient-${index}-${ingredientItem.ingredientId}`}>
                      <TableCell />
                      <TableCell>{ingredient?.name ?? "Ingredient"}</TableCell>
                      <TableCell>
                        {formatAmountWithUnit(ingredientItem.amount, unitName)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <IconButton
                            size="small"
                            aria-label="decrement actual amount"
                            onClick={() => adjustIngredientAmount(ingredientKey, -1)}
                            disabled={actualAmount <= 0}
                          >
                            <Remove fontSize="small" />
                          </IconButton>
                          <TextField
                            type="number"
                            value={actualAmount}
                            onChange={(event) =>
                              updateIngredientAmount(
                                ingredientKey,
                                clampNonNegative(
                                  Number.parseFloat(event.target.value) || 0,
                                ),
                              )
                            }
                            sx={{ width: 100 }}
                            inputProps={{ min: 0, step: "any" }}
                          />
                          <IconButton
                            size="small"
                            aria-label="increment actual amount"
                            onClick={() => adjustIngredientAmount(ingredientKey, 1)}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                          {unitName && (
                            <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                              {unitName}
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {formatCellNumber(ingredientMacros.calories)}
                      </TableCell>
                      <TableCell>
                        {formatCellNumber(ingredientMacros.protein)}
                      </TableCell>
                      <TableCell>
                        {formatCellNumber(ingredientMacros.carbs)}
                      </TableCell>
                      <TableCell>
                        {formatCellNumber(ingredientMacros.fat)}
                      </TableCell>
                      <TableCell>
                        {formatCellNumber(ingredientMacros.fiber)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Actual Nutrition Summary
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Calories</TableCell>
                    <TableCell>Protein</TableCell>
                    <TableCell>Carbs</TableCell>
                    <TableCell>Fat</TableCell>
                    <TableCell>Fiber</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell>
                      {formatCellNumber(totalActualMacros.calories)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(totalActualMacros.protein)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(totalActualMacros.carbs)}
                    </TableCell>
                    <TableCell>{formatCellNumber(totalActualMacros.fat)}</TableCell>
                    <TableCell>
                      {formatCellNumber(totalActualMacros.fiber)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Per Day</TableCell>
                    <TableCell>
                      {formatCellNumber(perDayActualMacros.calories)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(perDayActualMacros.protein)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(perDayActualMacros.carbs)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(perDayActualMacros.fat)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(perDayActualMacros.fiber)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}
    </Stack>
  );
}

export default Cooking;
