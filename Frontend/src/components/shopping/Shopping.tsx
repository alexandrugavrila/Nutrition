import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
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
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useData } from "@/contexts/DataContext";
import apiClient from "@/apiClient";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import type { PlanItem } from "@/utils/planningTypes";
import { aggregateShoppingList } from "@/utils/shopping";
import type { ShoppingListItem } from "@/utils/shopping";
import { formatCellNumber } from "@/utils/utils";
import IngredientModal from "@/components/common/IngredientModal";
import type { components } from "@/api-types";
import useHoverable from "@/hooks/useHoverable";

type IngredientRead = components["schemas"]["IngredientRead"];
type IngredientUpdate = components["schemas"]["IngredientUpdate"];
type IngredientWithSelection = IngredientRead & {
  shoppingUnitId?: number | string | null;
};

type HoverableEditWrapperProps = {
  onEdit: () => void;
  children: React.ReactNode;
};

const HoverableEditWrapper: React.FC<HoverableEditWrapperProps> = ({
  onEdit,
  children,
}) => {
  const { hovered, bind } = useHoverable();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} {...bind}>
      {children}
      {hovered && (
        <Tooltip title="Edit ingredient (add units, nutrition, tags)">
          <IconButton size="small" aria-label="edit ingredient" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

type ActivePlanState = {
  id: number | null;
  label: string | null;
  updatedAt: string | null;
};

const formatUnitLabel = (
  units: ShoppingListItem["unitTotals"],
  divisor = 1,
): string => {
  if (!units || units.length === 0) {
    return "-";
  }
  const safeDivisor = divisor > 0 ? divisor : 1;
  const labels = units
    .map((unit) => {
      const quantity = unit.quantity / safeDivisor;
      if (quantity <= 0) return null;
      const formatted = formatCellNumber(quantity);
      const name = unit.unitName || "units";
      return `${formatted} ${name}`;
    })
    .filter(Boolean) as string[];

  if (labels.length === 0) {
    return "-";
  }

  return labels.join(" + ");
};

const formatPreferredUnit = (
  preferred: ShoppingListItem["preferredUnitTotal"],
  divisor = 1,
): string | null => {
  if (!preferred) return null;
  const safeDivisor = divisor > 0 ? divisor : 1;
  const quantity = preferred.quantity / safeDivisor;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const label = preferred.unitName || "units";
  return `${formatCellNumber(quantity)} ${label}`;
};

const CLEAR_SELECTION_VALUE = "__CLEAR_SHOPPING_UNIT__";
const NULL_UNIT_SENTINEL = "__NULL_UNIT__";

const toOptionValue = (
  unitId: number | string | null | undefined,
): string => {
  if (unitId === NULL_UNIT_SENTINEL) {
    return NULL_UNIT_SENTINEL;
  }
  if (unitId === null || unitId === undefined) {
    return NULL_UNIT_SENTINEL;
  }
  return String(unitId);
};

const resolvePlanFallbackSelection = (
  item: ShoppingListItem,
): string => {
  const preferredUnitId = item.preferredUnitTotal?.unitId;
  if (preferredUnitId !== null && preferredUnitId !== undefined) {
    return toOptionValue(preferredUnitId);
  }

  const firstAvailableUnit =
    item.unitTotals.find((unit) => unit.unitId !== null && unit.unitId !== undefined) ??
    item.unitTotals[0];

  if (firstAvailableUnit) {
    return toOptionValue(firstAvailableUnit.unitId);
  }

  return CLEAR_SELECTION_VALUE;
};

const deriveSelectionValue = (
  selection: number | string | null | undefined,
  fallback: string,
): string => {
  if (selection === NULL_UNIT_SENTINEL) {
    return NULL_UNIT_SENTINEL;
  }
  if (
    selection === null ||
    selection === undefined ||
    selection === CLEAR_SELECTION_VALUE ||
    (typeof selection === "string" && selection.trim() === "")
  ) {
    return fallback;
  }
  return String(selection);
};

function Shopping() {
  const {
    foods,
    ingredients,
    fetching,
    setIngredients,
    setIngredientsNeedsRefetch,
    startRequest,
    endRequest,
  } = useData();
  const [modalState, setModalState] = useState<{
    open: boolean;
    ingredient: IngredientWithSelection | null;
  }>({ open: false, ingredient: null });
  const [plan] = useSessionStorageState<PlanItem[]>("planning-plan", () => []);
  const [days] = useSessionStorageState<number>("planning-days", 1);
  const [activePlan] = useSessionStorageState<ActivePlanState>(
    "planning-active-plan",
    () => ({ id: null, label: null, updatedAt: null }),
  );

  const { items, issues } = useMemo(
    () => aggregateShoppingList({ plan, foods, ingredients }),
    [plan, foods, ingredients],
  );

  const ingredientLookup = useMemo(() => {
    const map = new Map<string, IngredientWithSelection>();
    ingredients.forEach((ingredient) => {
      if (ingredient && ingredient.id !== null && ingredient.id !== undefined) {
        map.set(String(ingredient.id), ingredient as IngredientWithSelection);
      }
    });
    return map;
  }, [ingredients]);

  const parseSelectionValue = useCallback((value: unknown): number | string | null => {
    if (value === CLEAR_SELECTION_VALUE) return null;
    if (value === NULL_UNIT_SENTINEL) return NULL_UNIT_SENTINEL;
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return numeric;
      return trimmed;
    }
    return null;
  }, []);

  const buildUpdatePayload = useCallback(
    (
      ingredient: IngredientWithSelection,
      shoppingUnitId: number | string | null,
    ): IngredientUpdate => {
      const units = (ingredient.units ?? [])
        .filter((unit) => unit.name !== "g")
        .map((unit) => ({
          id:
            typeof unit.id === "number" && Number.isFinite(unit.id) ? unit.id : undefined,
          name: unit.name ?? "",
          grams: Number(unit.grams),
        }));

      const tags = (ingredient.tags ?? []).map((tag) => ({ id: tag.id ?? undefined })).filter((tag) => tag.id != null);

      const nutrition = ingredient.nutrition
        ? {
            calories: Number(ingredient.nutrition.calories ?? 0),
            protein: Number(ingredient.nutrition.protein ?? 0),
            carbohydrates: Number(ingredient.nutrition.carbohydrates ?? 0),
            fat: Number(ingredient.nutrition.fat ?? 0),
            fiber: Number(ingredient.nutrition.fiber ?? 0),
          }
        : null;

      const payload: IngredientUpdate = {
        name: ingredient.name ?? "",
        nutrition,
        units: units as IngredientUpdate["units"],
        tags: tags as IngredientUpdate["tags"],
      };

      const numericSelection =
        typeof shoppingUnitId === "number" && Number.isFinite(shoppingUnitId)
          ? shoppingUnitId
          : typeof shoppingUnitId === "string"
          ? Number(shoppingUnitId)
          : null;

      if (numericSelection !== null && !Number.isNaN(numericSelection)) {
        payload.shopping_unit_id = numericSelection;
      } else if (shoppingUnitId === null) {
        payload.shopping_unit_id = null;
      } else {
        const match = (ingredient.units ?? []).find((unit) => {
          if (unit.id == null && shoppingUnitId === NULL_UNIT_SENTINEL) {
            return true;
          }
          return String(unit.id) === String(shoppingUnitId);
        });
        if (match) {
          payload.shopping_unit = {
            unit_id:
              typeof match.id === "number" && Number.isFinite(match.id)
                ? match.id
                : undefined,
            name: match.name ?? "",
            grams: Number(match.grams),
          };
        }
      }

      return payload;
    },
    [],
  );

  const handlePreferredUnitChange = useCallback(
    async (ingredientId: number | null | undefined, value: unknown) => {
      if (ingredientId === null || ingredientId === undefined) return;
      const lookupKey = String(ingredientId);
      const ingredient = ingredientLookup.get(lookupKey);
      if (!ingredient) return;
      const parsed = parseSelectionValue(value);

      setIngredients((prev) =>
        prev.map((existing) =>
          existing.id === ingredientId
            ? ({ ...existing, shoppingUnitId: parsed } as IngredientWithSelection)
            : existing,
        ),
      );

      startRequest();
      try {
        const payload = buildUpdatePayload(ingredient, parsed);
        await apiClient
          .path(`/api/ingredients/${ingredientId}`)
          .method("put")
          .create()({ body: payload });
        setIngredientsNeedsRefetch(true);
      } catch (error) {
        console.error("Failed to update shopping unit", error);
        setIngredientsNeedsRefetch(true);
      } finally {
        endRequest();
      }
    },
    [
      ingredientLookup,
      parseSelectionValue,
      setIngredients,
      startRequest,
      buildUpdatePayload,
      setIngredientsNeedsRefetch,
      endRequest,
    ],
  );

  const openIngredientModal = useCallback((ingredient: IngredientWithSelection) => {
    setModalState({ open: true, ingredient });
  }, []);

  const closeIngredientModal = useCallback(() => {
    setModalState({ open: false, ingredient: null });
  }, []);

  const planIsEmpty = !plan || plan.length === 0;
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.totalGrams, 0),
    [items],
  );
  const normalizedDays = Number.isFinite(days) && days > 0 ? days : 1;
  const perDayWeight = totalWeight / normalizedDays;
  const planLabel = activePlan.label?.trim()
    ? `Based on plan "${activePlan.label}"`
    : "Based on current plan";

  let content: React.ReactNode;
  if (fetching) {
    content = (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 3 }}>
        <CircularProgress />
        <Typography>Loading data needed for your shopping list…</Typography>
      </Box>
    );
  } else if (planIsEmpty) {
    content = (
      <Alert severity="info" sx={{ mt: 3 }}>
        Build a plan in the Planning tab to see the combined shopping list here.
      </Alert>
    );
  } else if (items.length === 0) {
    content = (
      <Alert severity="warning" sx={{ mt: 3 }}>
        We could not build a shopping list because some ingredients or foods are
        missing required data.
        {issues.length > 0 && (
          <Box component="ul" sx={{ mt: 1, pl: 3 }}>
            {issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{issue.message}</li>
            ))}
          </Box>
        )}
      </Alert>
    );
  } else {
    content = (
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
          {items.length} unique ingredients • {normalizedDays} day
          {normalizedDays !== 1 ? "s" : ""} • {formatCellNumber(totalWeight)} g total
          {normalizedDays > 1
            ? ` (${formatCellNumber(perDayWeight)} g per day)`
            : ""}
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ingredient</TableCell>
                <TableCell>Quantity Needed</TableCell>
                <TableCell align="right">Weight (g)</TableCell>
                {normalizedDays > 1 && (
                  <TableCell align="right">Per Day (g)</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const ingredientId =
                  typeof item.ingredient.id === "number"
                    ? item.ingredient.id
                    : item.ingredient.id != null
                    ? Number(item.ingredient.id)
                    : null;
                const contextIngredient =
                  (ingredientId != null
                    ? ingredientLookup.get(String(ingredientId))
                    : null) ??
                  (item.ingredient as IngredientWithSelection);
                const fallbackSelectValue = resolvePlanFallbackSelection(item);
                const selectValue = deriveSelectionValue(
                  contextIngredient.shoppingUnitId,
                  fallbackSelectValue,
                );
                const preferredLabel = formatPreferredUnit(item.preferredUnitTotal);
                const preferredPerDay = formatPreferredUnit(
                  item.preferredUnitTotal,
                  normalizedDays,
                );

                return (
                  <TableRow key={item.ingredientId ?? item.name}>
                    <TableCell>
                      <HoverableEditWrapper
                        onEdit={() => openIngredientModal(contextIngredient)}
                      >
                        <Typography component="span">{item.name}</Typography>
                      </HoverableEditWrapper>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={1}>
                        <Select
                          size="small"
                          value={selectValue}
                          onChange={(event) =>
                            handlePreferredUnitChange(
                              ingredientId,
                              event.target.value,
                            )
                          }
                        >
                          <MenuItem value={CLEAR_SELECTION_VALUE}>No preference</MenuItem>
                          {(contextIngredient.units ?? []).map((unit) => {
                            const optionValue = toOptionValue(unit.id);
                            const grams = Number(unit.grams);
                            const gramsLabel = Number.isFinite(grams)
                              ? formatCellNumber(grams)
                              : unit.grams;
                            return (
                              <MenuItem
                                key={`${optionValue}-${unit.name}`}
                                value={optionValue}
                              >
                                {unit.name} ({gramsLabel} g)
                              </MenuItem>
                            );
                          })}
                        </Select>
                        {preferredLabel && (
                          <Typography>
                            Preferred: {preferredLabel}
                            {normalizedDays > 1 && preferredPerDay
                              ? ` • ${preferredPerDay} per day`
                              : ""}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Plan totals: {formatUnitLabel(item.unitTotals)}
                          {normalizedDays > 1
                            ? ` • ${formatUnitLabel(
                                item.unitTotals,
                                normalizedDays,
                              )} per day`
                            : ""}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {formatCellNumber(item.totalGrams)}
                    </TableCell>
                    {normalizedDays > 1 && (
                      <TableCell align="right">
                        {formatCellNumber(item.totalGrams / normalizedDays)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1">
        Shopping List
      </Typography>
      <Typography variant="subtitle1" sx={{ mt: 1 }}>
        {planLabel}
        {normalizedDays > 1 ? ` • ${normalizedDays} days` : ""}
      </Typography>
      {content}
      {!fetching && !planIsEmpty && items.length > 0 && issues.length > 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Some items could not be combined:
          <Box component="ul" sx={{ mt: 1, pl: 3, mb: 0 }}>
            {issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{issue.message}</li>
            ))}
          </Box>
        </Alert>
      )}
      <IngredientModal
        open={modalState.open}
        mode="edit"
        ingredient={modalState.ingredient ?? null}
        onClose={closeIngredientModal}
      />
    </Box>
  );
}

export default Shopping;
