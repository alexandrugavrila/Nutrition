import React, { useCallback, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
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
import { Add, Remove } from "@mui/icons-material";

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
  gramsForIngredientPortion,
  macrosForIngredientPortion,
} from "@/utils/nutrition";
import type { FoodRead, IngredientRead, MacroTotals } from "@/utils/nutrition";
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

const divideMacroTotals = (totals: MacroTotals, divisor: number): MacroTotals => {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return { ...ZERO_MACROS };
  }

  return {
    calories: totals.calories / divisor,
    protein: totals.protein / divisor,
    carbs: totals.carbs / divisor,
    fat: totals.fat / divisor,
    fiber: totals.fiber / divisor,
  };
};

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
  ingredientTotals: Record<string, IngredientMeasurement>;
};

type ActivePlanState = {
  id: number | null;
  label: string | null;
  updatedAt: string | null;
};

type IngredientMeasurement = {
  quantity: number;
  unitId: number;
};

const initialActualState: CookingActualState = {
  portions: {},
  ingredientTotals: {},
};

const measurementsEqual = (
  a: IngredientMeasurement,
  b: IngredientMeasurement,
): boolean => Object.is(a.quantity, b.quantity) && Object.is(a.unitId, b.unitId);

const normalizeMeasurement = (
  value: unknown,
  fallbackQuantity: number,
  fallbackUnitId: number,
): IngredientMeasurement => {
  const normalizedFallbackUnit = normalizePlanUnitId(fallbackUnitId);

  if (value && typeof value === "object") {
    const record = value as { quantity?: unknown; unitId?: unknown };
    const quantity = clampNonNegative(toFiniteNumber(record.quantity));
    const unitId = normalizePlanUnitId(
      record.unitId !== undefined ? record.unitId : normalizedFallbackUnit,
    );
    return { quantity, unitId };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      quantity: clampNonNegative(value),
      unitId: normalizedFallbackUnit,
    };
  }

  return {
    quantity: clampNonNegative(fallbackQuantity),
    unitId: normalizedFallbackUnit,
  };
};

const readMeasurementWithFallback = (
  totals: CookingActualState["ingredientTotals"],
  key: string,
  fallbackQuantity: number,
  fallbackUnitId: number,
): IngredientMeasurement =>
  normalizeMeasurement(totals[key], fallbackQuantity, fallbackUnitId);

const resolveIngredientUnitName = (
  ingredient: FoodRead | IngredientRead | undefined,
  unitId: number,
): string => {
  if (!ingredient) {
    return unitId === GRAM_UNIT_SENTINEL ? "g" : "";
  }

  const candidateUnits = (ingredient as IngredientRead).units ?? [];
  const match = candidateUnits.find(
    (unit) => normalizePlanUnitId(unit?.id) === unitId,
  );
  if (match?.name && match.name.trim() !== "") {
    return match.name;
  }

  return unitId === GRAM_UNIT_SENTINEL ? "g" : "";
};

const shallowEqualNumberRecords = (
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

const shallowEqualMeasurementRecords = (
  a: Record<string, IngredientMeasurement>,
  b: Record<string, IngredientMeasurement>,
): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    const valueA = a[key];
    const valueB = b[key];
    if (!valueB || !measurementsEqual(valueA, valueB)) {
      return false;
    }
  }
  return true;
};

const cookingStatesEqual = (
  a: CookingActualState,
  b: CookingActualState,
): boolean =>
  shallowEqualNumberRecords(a.portions, b.portions) &&
  shallowEqualMeasurementRecords(a.ingredientTotals, b.ingredientTotals);

const pluralize = (value: number, noun: string): string => {
  const rounded = Math.abs(value - 1) < 1e-6 ? 1 : value;
  if (Math.abs(rounded - 1) < 1e-6) {
    return `${formatCellNumber(value)} ${noun}`;
  }
  return `${formatCellNumber(value)} ${noun}s`;
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

  const [actualState, setActualState] =
    useSessionStorageState<CookingActualState>(
      "cooking-actuals",
      () => ({ ...initialActualState }),
    );

  const sanitizeActualState = useCallback(
    (prev: CookingActualState): CookingActualState => {
      const nextPortions: Record<string, number> = {};
      const nextIngredientTotals: Record<string, IngredientMeasurement> = {};

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
              const defaultTotal = perPortionQuantity * normalizedPortion;
              const defaultUnitId = normalizePlanUnitId(
                override?.unitId ?? ingredient.unit_id,
              );
              nextIngredientTotals[key] = normalizeMeasurement(
                prev.ingredientTotals[key],
                defaultTotal,
                defaultUnitId,
              );
            });
          }
        } else {
          const amount = clampNonNegative(toFiniteNumber(item.amount));
          const defaultUnitId = normalizePlanUnitId(item.unitId);
          nextIngredientTotals[itemKey] = normalizeMeasurement(
            prev.ingredientTotals[itemKey],
            amount,
            defaultUnitId,
          );
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

        return { portions: nextPortions, ingredientTotals: prev.ingredientTotals };
      });
    },
    [setActualState],
  );

  const updateIngredientMeasurement = useCallback(
    (
      key: string,
      fallback: IngredientMeasurement,
      updates: Partial<IngredientMeasurement>,
    ) => {
      setActualState((prev) => {
        const current = normalizeMeasurement(
          prev.ingredientTotals[key],
          fallback.quantity,
          fallback.unitId,
        );
        const nextMeasurement: IngredientMeasurement = {
          quantity:
            updates.quantity !== undefined
              ? clampNonNegative(updates.quantity)
              : current.quantity,
          unitId:
            updates.unitId !== undefined
              ? normalizePlanUnitId(updates.unitId)
              : current.unitId,
        };
        if (measurementsEqual(current, nextMeasurement)) {
          if (prev.ingredientTotals[key]) {
            return prev;
          }
        }
        return {
          portions: prev.portions,
          ingredientTotals: {
            ...prev.ingredientTotals,
            [key]: nextMeasurement,
          },
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

      const portionKey = planItemKey(item, index);
      const actualPortions = clampNonNegative(
        toFiniteNumber(actualState.portions[portionKey] ?? item.portions),
      );

      return food.ingredients.reduce((totals, ingredient) => {
        const dataIngredient = findIngredientInLookup(
          ingredientLookup,
          ingredient.ingredient_id,
        );
        if (!dataIngredient) {
          return totals;
        }
        const key = foodIngredientKey(index, ingredient.ingredient_id);
        const override = item.overrides[String(ingredient.ingredient_id)];
        const defaultUnitId = normalizePlanUnitId(
          override?.unitId ?? ingredient.unit_id,
        );
        const quantityPerPortion = clampNonNegative(
          toFiniteNumber(override?.quantity ?? ingredient.unit_quantity),
        );
        const fallbackQuantity = quantityPerPortion * actualPortions;
        const measurement = readMeasurementWithFallback(
          actualState.ingredientTotals,
          key,
          fallbackQuantity,
          defaultUnitId,
        );
        const ingredientMacros = macrosForIngredientPortion({
          ingredient: dataIngredient,
          unitId: measurement.unitId,
          quantity: measurement.quantity,
        });
        return addMacroTotals(totals, ingredientMacros);
      }, { ...ZERO_MACROS });
    },
    [
      actualState.ingredientTotals,
      actualState.portions,
      foodLookup,
      ingredientLookup,
    ],
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
        const ingredientPlan = item as IngredientPlanItem;
        const defaultUnitId = normalizePlanUnitId(ingredientPlan.unitId);
        const defaultQuantity = clampNonNegative(
          toFiniteNumber(ingredientPlan.amount),
        );
        const measurement = readMeasurementWithFallback(
          actualState.ingredientTotals,
          key,
          defaultQuantity,
          defaultUnitId,
        );
        const macros = macrosForIngredientPortion({
          ingredient,
          unitId: measurement.unitId,
          quantity: measurement.quantity,
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
                  <TableCell>Item</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>Actual</TableCell>
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
                    const foodTotalMacros = computeFoodActualMacros(foodItem, index);
                    const foodMacros =
                      actualPortions > 0
                        ? divideMacroTotals(foodTotalMacros, actualPortions)
                        : { ...ZERO_MACROS };
                    const plannedPortionsLabel = pluralize(foodItem.portions, "portion");

                    return (
                      <React.Fragment key={`food-${index}-${foodItem.foodId}`}>
                        <TableRow sx={{ backgroundColor: "action.hover" }}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {food?.name ?? "Unnamed food"}
                          </TableCell>
                          <TableCell>{plannedPortionsLabel}</TableCell>
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
                        {(food?.ingredients ?? []).map((ingredient) => {
                          const dataIngredient = findIngredientInLookup(
                            ingredientLookup,
                            ingredient.ingredient_id,
                          );
                          const override =
                            foodItem.overrides[String(ingredient.ingredient_id)];
                          const defaultUnitId = normalizePlanUnitId(
                            override?.unitId ?? ingredient.unit_id,
                          );
                          const quantityPerPortion = clampNonNegative(
                            toFiniteNumber(override?.quantity ?? ingredient.unit_quantity),
                          );
                          const plannedTotal = quantityPerPortion * foodItem.portions;
                          const plannedUnitName = resolveIngredientUnitName(
                            dataIngredient,
                            defaultUnitId,
                          );
                          const plannedGrams = gramsForIngredientPortion({
                            ingredient: dataIngredient,
                            unitId: defaultUnitId,
                            quantity: plannedTotal,
                          });
                          const ingredientKey = foodIngredientKey(
                            index,
                            ingredient.ingredient_id,
                          );
                          const fallbackMeasurement: IngredientMeasurement = {
                            quantity: quantityPerPortion * actualPortions,
                            unitId: defaultUnitId,
                          };
                          const measurement = readMeasurementWithFallback(
                            actualState.ingredientTotals,
                            ingredientKey,
                            fallbackMeasurement.quantity,
                            fallbackMeasurement.unitId,
                          );
                          const ingredientMacros = macrosForIngredientPortion({
                            ingredient: dataIngredient,
                            unitId: measurement.unitId,
                            quantity: measurement.quantity,
                          });
                          const actualGrams = gramsForIngredientPortion({
                            ingredient: dataIngredient,
                            unitId: measurement.unitId,
                            quantity: measurement.quantity,
                          });
                          const rawUnitOptions = (dataIngredient?.units ?? []).map((unit) => ({
                            id: normalizePlanUnitId(unit.id),
                            name: unit.name ?? "",
                          }));
                          const seenUnitIds = new Set<number>();
                          const unitOptions = rawUnitOptions.filter((option) => {
                            if (seenUnitIds.has(option.id)) {
                              return false;
                            }
                            seenUnitIds.add(option.id);
                            return true;
                          });
                          if (unitOptions.length === 0) {
                            unitOptions.push({ id: GRAM_UNIT_SENTINEL, name: "g" });
                          }
                          if (!unitOptions.some((option) => option.id === measurement.unitId)) {
                            unitOptions.push({
                              id: measurement.unitId,
                              name:
                                resolveIngredientUnitName(
                                  dataIngredient,
                                  measurement.unitId,
                                ) || "g",
                            });
                          }

                          return (
                            <TableRow
                              key={`food-${index}-ingredient-${ingredient.ingredient_id}`}
                            >
                              <TableCell sx={{ pl: 4 }}>
                                {dataIngredient?.name ?? "Ingredient"}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: "flex", flexDirection: "column" }}>
                                  <Typography component="span">
                                    {`${formatCellNumber(plannedTotal)}${
                                      plannedUnitName ? ` ${plannedUnitName}` : ""
                                    }`}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {`${formatCellNumber(plannedGrams)} g`}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <TextField
                                    type="number"
                                    value={measurement.quantity}
                                    onChange={(event) => {
                                      const parsed = Number.parseFloat(event.target.value);
                                      updateIngredientMeasurement(
                                        ingredientKey,
                                        fallbackMeasurement,
                                        {
                                          quantity: Number.isFinite(parsed) ? parsed : 0,
                                        },
                                      );
                                    }}
                                    sx={{ width: 120 }}
                                    inputProps={{ min: 0, step: "any" }}
                                  />
                                  <Select
                                    size="small"
                                    value={measurement.unitId}
                                    onChange={(event) => {
                                      const selectedUnit = normalizePlanUnitId(
                                        event.target.value,
                                      );
                                      updateIngredientMeasurement(
                                        ingredientKey,
                                        fallbackMeasurement,
                                        { unitId: selectedUnit },
                                      );
                                    }}
                                  >
                                    {unitOptions.map((option) => (
                                      <MenuItem
                                        key={`${ingredientKey}-${option.id}`}
                                        value={option.id}
                                      >
                                        {option.name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ whiteSpace: "nowrap" }}
                                  >
                                    {`${formatCellNumber(actualGrams)} g`}
                                  </Typography>
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
                      </React.Fragment>
                    );
                  }

                  const ingredientItem = item as IngredientPlanItem;
                  const ingredient = findIngredientInLookup(
                    ingredientLookup,
                    ingredientItem.ingredientId,
                  );
                  const defaultUnitId = normalizePlanUnitId(ingredientItem.unitId);
                  const plannedQuantity = clampNonNegative(
                    toFiniteNumber(ingredientItem.amount),
                  );
                  const plannedUnitName = resolveIngredientUnitName(
                    ingredient,
                    defaultUnitId,
                  );
                  const plannedGrams = gramsForIngredientPortion({
                    ingredient,
                    unitId: defaultUnitId,
                    quantity: plannedQuantity,
                  });
                  const ingredientKey = planItemKey(item, index);
                  const fallbackMeasurement: IngredientMeasurement = {
                    quantity: plannedQuantity,
                    unitId: defaultUnitId,
                  };
                  const measurement = readMeasurementWithFallback(
                    actualState.ingredientTotals,
                    ingredientKey,
                    fallbackMeasurement.quantity,
                    fallbackMeasurement.unitId,
                  );
                  const ingredientMacros = macrosForIngredientPortion({
                    ingredient,
                    unitId: measurement.unitId,
                    quantity: measurement.quantity,
                  });
                  const actualGrams = gramsForIngredientPortion({
                    ingredient,
                    unitId: measurement.unitId,
                    quantity: measurement.quantity,
                  });
                  const rawUnitOptions = (ingredient?.units ?? []).map((unit) => ({
                    id: normalizePlanUnitId(unit.id),
                    name: unit.name ?? "",
                  }));
                  const seenUnitIds = new Set<number>();
                  const unitOptions = rawUnitOptions.filter((option) => {
                    if (seenUnitIds.has(option.id)) {
                      return false;
                    }
                    seenUnitIds.add(option.id);
                    return true;
                  });
                  if (unitOptions.length === 0) {
                    unitOptions.push({ id: GRAM_UNIT_SENTINEL, name: "g" });
                  }
                  if (!unitOptions.some((option) => option.id === measurement.unitId)) {
                    unitOptions.push({
                      id: measurement.unitId,
                      name:
                        resolveIngredientUnitName(ingredient, measurement.unitId) || "g",
                    });
                  }

                  return (
                    <TableRow key={`ingredient-${index}-${ingredientItem.ingredientId}`}>
                      <TableCell>{ingredient?.name ?? "Ingredient"}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          <Typography component="span">
                            {`${formatCellNumber(plannedQuantity)}${
                              plannedUnitName ? ` ${plannedUnitName}` : ""
                            }`}
                          </Typography>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            {`${formatCellNumber(plannedGrams)} g`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <TextField
                            type="number"
                            value={measurement.quantity}
                            onChange={(event) => {
                              const parsed = Number.parseFloat(event.target.value);
                              updateIngredientMeasurement(
                                ingredientKey,
                                fallbackMeasurement,
                                {
                                  quantity: Number.isFinite(parsed) ? parsed : 0,
                                },
                              );
                            }}
                            sx={{ width: 120 }}
                            inputProps={{ min: 0, step: "any" }}
                          />
                          <Select
                            size="small"
                            value={measurement.unitId}
                            onChange={(event) => {
                              const selectedUnit = normalizePlanUnitId(event.target.value);
                              updateIngredientMeasurement(
                                ingredientKey,
                                fallbackMeasurement,
                                { unitId: selectedUnit },
                              );
                            }}
                          >
                            {unitOptions.map((option) => (
                              <MenuItem
                                key={`${ingredientKey}-${option.id}`}
                                value={option.id}
                              >
                                {option.name}
                              </MenuItem>
                            ))}
                          </Select>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {`${formatCellNumber(actualGrams)} g`}
                          </Typography>
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
