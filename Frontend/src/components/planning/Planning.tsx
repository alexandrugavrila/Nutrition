import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowRight,
  Add,
  Remove,
  Edit as EditIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  ListAlt as ManageIcon,
} from "@mui/icons-material";

import { useLocation, useNavigate } from "react-router-dom";
import TagFilter from "@/components/common/TagFilter";
import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";
import {
  createIngredientLookup,
  macrosForFood,
  macrosForIngredientPortion,
  ZERO_MACROS,
  findIngredientInLookup,
} from "@/utils/nutrition";
import type { IngredientRead } from "@/utils/nutrition";
import IngredientModal from "@/components/common/IngredientModal";
import useHoverable from "@/hooks/useHoverable";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import type { components } from "@/api-types";
import type { PlanRead } from "@/utils/planApi";
import { createPlan, updatePlan } from "@/utils/planApi";
import type {
  FoodOverride,
  FoodPlanItem,
  IngredientPlanItem,
  PlanItem,
  PlanPayload,
} from "@/utils/planningTypes";

const GRAM_UNIT_SENTINEL = 0;

type IngredientReadFromApi = components["schemas"]["IngredientRead"];
type FoodReadFromApi = components["schemas"]["FoodRead"];
type PossibleIngredientTag = components["schemas"]["PossibleIngredientTag"];
type PossibleFoodTag = components["schemas"]["PossibleFoodTag"];
type IngredientOption = IngredientReadFromApi & { shoppingUnitId?: number | string | null };
type FoodOption = FoodReadFromApi;
type IngredientTagOption = PossibleIngredientTag & { group?: string };
type FoodTagOption = PossibleFoodTag & { group?: string };

const buildTagKey = (tag: { id?: number | string | null; name?: string | null }): string => {
  if (tag?.id !== undefined && tag?.id !== null) {
    return `id:${tag.id}`;
  }
  return `name:${(tag?.name ?? "").toLowerCase()}`;
};

const matchesSelectedTags = (
  itemTags: { id?: number | string | null; name?: string | null }[] | null | undefined,
  selected: { id?: number | string | null; name?: string | null }[],
): boolean => {
  if (selected.length === 0) return true;
  if (!Array.isArray(itemTags) || itemTags.length === 0) {
    return false;
  }
  const keys = new Set(itemTags.map(buildTagKey));
  return selected.some((tag) => keys.has(buildTagKey(tag)));
};

const sortByName = <T extends { name?: string | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aName = (a.name ?? "").toString();
    const bName = (b.name ?? "").toString();
    return aName.localeCompare(bName, undefined, { sensitivity: "base" });
  });

const rehydrateTags = <T extends { id?: number | string | null; name?: string | null }>(
  selected: T[],
  options: T[],
): T[] => {
  if (selected.length === 0) return selected;
  const optionMap = new Map(options.map((option) => [buildTagKey(option), option]));
  const next: T[] = [];
  selected.forEach((tag) => {
    const match = optionMap.get(buildTagKey(tag));
    if (match) {
      next.push(match);
    }
  });
  if (next.length === selected.length && next.every((tag, index) => tag === selected[index])) {
    return selected;
  }
  return next;
};

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

const getUnitOptionValue = (unitId: number | null | undefined): string =>
  unitId === null || unitId === undefined
    ? String(GRAM_UNIT_SENTINEL)
    : String(unitId);

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ingredientSupportsUnit = (
  ingredient: IngredientRead | undefined,
  unitId: number,
): boolean => {
  if (!ingredient || !Array.isArray(ingredient.units) || ingredient.units.length === 0) {
    return true;
  }
  return ingredient.units.some(
    (unit) => normalizePlanUnitId(unit.id) === unitId,
  );
};

const fallbackUnitIdForIngredient = (ingredient: IngredientRead | undefined): number => {
  if (!ingredient || !Array.isArray(ingredient.units) || ingredient.units.length === 0) {
    return GRAM_UNIT_SENTINEL;
  }
  const gramUnit = ingredient.units.find(
    (unit) => toFiniteNumber(unit.grams) === 1,
  );
  if (gramUnit) {
    return normalizePlanUnitId(gramUnit.id);
  }
  const firstUnit = ingredient.units[0];
  return normalizePlanUnitId(firstUnit?.id ?? null);
};

const formatPlanTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

type NameWithEditProps = {
  name: string;
  onEdit: () => void;
};

type MacroKey = keyof PlanPayload["targetMacros"];

const NameWithEdit: React.FC<NameWithEditProps> = ({ name, onEdit }) => {
  const { hovered, bind } = useHoverable();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }} {...bind}>
      <span>{name}</span>
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

function Planning() {
  const {
    foods,
    ingredients,
    ingredientProcessingTags,
    ingredientGroupTags,
    ingredientOtherTags,
    foodDietTags,
    foodTypeTags,
    foodOtherTags,
  } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
  const allIngredientTags = useMemo<IngredientTagOption[]>(
    () => [
      ...ingredientProcessingTags.map((tag) => ({ ...tag, group: "Processing" as const })),
      ...ingredientGroupTags.map((tag) => ({ ...tag, group: "Group" as const })),
      ...ingredientOtherTags.map((tag) => ({ ...tag, group: "Other" as const })),
    ],
    [ingredientProcessingTags, ingredientGroupTags, ingredientOtherTags],
  );
  const allFoodTags = useMemo<FoodTagOption[]>(
    () => [
      ...foodDietTags.map((tag) => ({ ...tag, group: "Diet" as const })),
      ...foodTypeTags.map((tag) => ({ ...tag, group: "Type" as const })),
      ...foodOtherTags.map((tag) => ({ ...tag, group: "Other" as const })),
    ],
    [foodDietTags, foodTypeTags, foodOtherTags],
  );
  const ingredientFilter = useMemo(
    () =>
      createFilterOptions<IngredientOption>({
        stringify: (option) =>
          `${option?.name ?? ""} ${(option?.tags ?? [])
            .map((tag) => tag?.name ?? "")
            .join(" ")}`,
      }),
    [],
  );
  const foodFilter = useMemo(
    () =>
      createFilterOptions<FoodOption>({
        stringify: (option) =>
          `${option?.name ?? ""} ${(option?.tags ?? [])
            .map((tag) => tag?.name ?? "")
            .join(" ")}`,
      }),
    [],
  );

  const [days, setDays] = useSessionStorageState<number>("planning-days", 1);
  const [daysError, setDaysError] = useState(false);
  const [targetMacros, setTargetMacros] = useSessionStorageState<PlanPayload["targetMacros"]>("planning-target-macros", () => ({
    ...ZERO_MACROS,
  }));
  const macroKeys = useMemo(() => Object.keys(targetMacros) as MacroKey[], [targetMacros]);
  const [macroInputs, setMacroInputs] = useState<Record<MacroKey, string>>(() =>
    macroKeys.reduce((acc, macro) => {
      acc[macro] = targetMacros[macro].toString();
      return acc;
    }, {} as Record<MacroKey, string>),
  );
  const [activeMacro, setActiveMacro] = useState<MacroKey | null>(null);
  const [plan, setPlan] = useSessionStorageState<PlanItem[]>("planning-plan", () => []); // FoodPlanItem or IngredientPlanItem

  const [activePlan, setActivePlan] = useSessionStorageState<{
    id: number | null;
    label: string | null;
    updatedAt: string | null;
  }>("planning-active-plan", () => ({
    id: null,
    label: null,
    updatedAt: null,
  }));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useSessionStorageState("planning-save-label", "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"create" | "update" | null>(null);
  const lastSavedPayloadRef = useRef<PlanPayload | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [selectedType, setSelectedType] = useSessionStorageState("planning-selected-type", "food");
  const [selectedFoodId, setSelectedFoodId] = useSessionStorageState(
    "planning-selected-food-id",
    "",
  );
  const [selectedPortions, setSelectedPortions] = useSessionStorageState<number>("planning-selected-portions", 1);
  const [selectedIngredientId, setSelectedIngredientId] = useSessionStorageState("planning-selected-ingredient-id", "");
  const [selectedIngredientUnitId, setSelectedIngredientUnitId] = useSessionStorageState("planning-selected-ingredient-unit-id", "");
  const [selectedIngredientAmount, setSelectedIngredientAmount] = useSessionStorageState<number>("planning-selected-ingredient-amount", 1);
  const [foodTagFilters, setFoodTagFilters] = useSessionStorageState<FoodTagOption[]>(
    "planning-selected-food-tag-filters",
    () => [],
  );
  const [ingredientTagFilters, setIngredientTagFilters] = useSessionStorageState<IngredientTagOption[]>(
    "planning-selected-ingredient-tag-filters",
    () => [],
  );
  const [foodSearchInput, setFoodSearchInput] = useSessionStorageState<string>(
    "planning-food-search",
    "",
  );
  const [ingredientSearchInput, setIngredientSearchInput] = useSessionStorageState<string>(
    "planning-ingredient-search",
    "",
  );
  const [open, setOpen] = useSessionStorageState<Record<number, boolean>>("planning-open-state", () => ({}));
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editorIngredient, setEditorIngredient] = useState<IngredientRead | null>(null);

  useEffect(() => {
    setFoodTagFilters((prev) => rehydrateTags(prev, allFoodTags));
  }, [allFoodTags, setFoodTagFilters]);

  useEffect(() => {
    setIngredientTagFilters((prev) => rehydrateTags(prev, allIngredientTags));
  }, [allIngredientTags, setIngredientTagFilters]);

  const hasContent = useMemo(
    () =>
      plan.length > 0 ||
      days !== 1 ||
      Object.values(targetMacros).some((value) => value !== 0),
    [plan, days, targetMacros]
  );
  const canResetPlan = hasContent || activePlan.id !== null;

  const selectedFood = useMemo(
    () =>
      foods.find((food) => String(food.id ?? "") === String(selectedFoodId ?? "")) ?? null,
    [foods, selectedFoodId],
  );
  const tagFilteredFoods = useMemo(
    () =>
      sortByName(
        foods.filter((food) => matchesSelectedTags(food.tags ?? [], foodTagFilters)),
      ),
    [foods, foodTagFilters],
  );
  const foodOptions = useMemo(() => {
    if (!selectedFood) return tagFilteredFoods;
    const selectedKey = String(selectedFood.id ?? selectedFood.name ?? "");
    const hasSelected = tagFilteredFoods.some(
      (food) => String(food.id ?? food.name ?? "") === selectedKey,
    );
    if (hasSelected) return tagFilteredFoods;
    return sortByName([...tagFilteredFoods, selectedFood]);
  }, [selectedFood, tagFilteredFoods]);

  const selectedIngredient = useMemo(
    () =>
      ingredients.find(
        (ingredient) => String(ingredient.id ?? "") === String(selectedIngredientId ?? ""),
      ) ?? null,
    [ingredients, selectedIngredientId],
  );
  const tagFilteredIngredients = useMemo(
    () =>
      sortByName(
        ingredients.filter((ingredient) =>
          matchesSelectedTags(ingredient.tags ?? [], ingredientTagFilters),
        ),
      ),
    [ingredients, ingredientTagFilters],
  );
  const ingredientOptions = useMemo(() => {
    if (!selectedIngredient) return tagFilteredIngredients;
    const selectedKey = String(selectedIngredient.id ?? selectedIngredient.name ?? "");
    const hasSelected = tagFilteredIngredients.some(
      (ingredient) => String(ingredient.id ?? ingredient.name ?? "") === selectedKey,
    );
    if (hasSelected) return tagFilteredIngredients;
    return sortByName([...tagFilteredIngredients, selectedIngredient]);
  }, [selectedIngredient, tagFilteredIngredients]);

  useEffect(() => {
    setMacroInputs((prev) => {
      let changed = false;
      const next = { ...prev } as Record<MacroKey, string>;

      macroKeys.forEach((macro) => {
        if (activeMacro === macro) {
          if (!(macro in next)) {
            next[macro] = targetMacros[macro].toString();
            changed = true;
          }
          return;
        }

        const newValue = targetMacros[macro].toString();
        if (next[macro] !== newValue) {
          next[macro] = newValue;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [targetMacros, macroKeys, activeMacro]);


  useEffect(() => {
    if (!selectedIngredientId) {
      if (selectedIngredientUnitId !== "") {
        setSelectedIngredientUnitId("");
      }
      return;
    }

    const ingredient = ingredients.find((ing) => String(ing.id) === String(selectedIngredientId));
    if (!ingredient) {
      if (selectedIngredientUnitId !== "") {
        setSelectedIngredientUnitId("");
      }
      return;
    }

    const units = ingredient.units ?? [];
    if (units.length === 0) {
      if (selectedIngredientUnitId !== "") {
        setSelectedIngredientUnitId("");
      }
      return;
    }

    const hasMatch = units.some(
      (unit) => getUnitOptionValue(unit.id) === selectedIngredientUnitId,
    );
    if (!hasMatch) {
      const fallback = units.find((unit) => Number(unit.grams) === 1) ?? units[0];
      const fallbackValue = fallback ? getUnitOptionValue(fallback.id) : "";
      if (fallbackValue !== selectedIngredientUnitId) {
        setSelectedIngredientUnitId(fallbackValue);
      }
    }
  }, [
    ingredients,
    selectedIngredientId,
    selectedIngredientUnitId,
    setSelectedIngredientUnitId,
  ]);

  const handleOpenIngredientEditor = (ingredientId: string) => {
    const dataIngredient = findIngredientInLookup(ingredientLookup, ingredientId) ?? null;
    setEditorIngredient(dataIngredient);
    setIngredientModalOpen(Boolean(dataIngredient));
  };

  const sanitizePlanItems = useCallback((): PlanItem[] => {
    return plan.map((item) => {
      if (item.type === "food") {
        const overrides: Record<string, FoodOverride> = {};
        Object.entries(item.overrides ?? {}).forEach(([key, value]) => {
          if (!value) {
            overrides[key] = { unitId: GRAM_UNIT_SENTINEL, quantity: 0 };
            return;
          }
          overrides[key] = {
            unitId: normalizePlanUnitId(value.unitId),
            quantity: typeof value.quantity === "number" ? value.quantity : Number(value.quantity ?? 0),
          };
        });
        return {
          type: "food",
          foodId: item.foodId,
          portions: item.portions,
          overrides,
        } as FoodPlanItem;
      }
      return {
        type: "ingredient",
        ingredientId: item.ingredientId,
        unitId: normalizePlanUnitId(item.unitId),
        amount: item.amount,
      } as IngredientPlanItem;
    });
  }, [plan]);

  const buildPayload = useCallback((): PlanPayload => ({
    days,
    targetMacros: { ...targetMacros },
    plan: sanitizePlanItems(),
  }), [days, targetMacros, sanitizePlanItems]);

  const applySavedPlan = useCallback(
    (saved: PlanRead, message?: string) => {
      const rawPayload = (saved.payload ?? {}) as Partial<PlanPayload>;
      const normalizedDays =
        typeof rawPayload.days === "number" && rawPayload.days > 0 ? Math.floor(rawPayload.days) : 1;
      const normalizedTarget: PlanPayload["targetMacros"] = {
        calories: Number(rawPayload.targetMacros?.calories ?? 0),
        protein: Number(rawPayload.targetMacros?.protein ?? 0),
        carbs: Number(rawPayload.targetMacros?.carbs ?? 0),
        fat: Number(rawPayload.targetMacros?.fat ?? 0),
        fiber: Number(rawPayload.targetMacros?.fiber ?? 0),
      };
      const normalizedPlan: PlanItem[] = Array.isArray(rawPayload.plan)
        ? rawPayload.plan
            .map((item) => {
              if (!item || typeof item !== "object" || !("type" in item)) {
                return null;
              }
              if ((item as PlanItem).type === "food") {
                const overrides: Record<string, FoodOverride> = {};
                const rawOverrides = (item as FoodPlanItem).overrides ?? {};
                Object.entries(rawOverrides).forEach(([key, override]) => {
                  if (!override) return;
                  overrides[key] = {
                    unitId: normalizePlanUnitId((override as FoodOverride).unitId),
                    quantity: Number((override as FoodOverride).quantity ?? 0),
                  };
                });
                return {
                  type: "food" as const,
                  foodId: String((item as FoodPlanItem).foodId ?? ""),
                  portions: Number((item as FoodPlanItem).portions ?? 0) || 0,
                  overrides,
                } as FoodPlanItem;
              }
              if ((item as PlanItem).type === "ingredient") {
                return {
                  type: "ingredient" as const,
                  ingredientId: String((item as IngredientPlanItem).ingredientId ?? ""),
                  unitId: normalizePlanUnitId((item as IngredientPlanItem).unitId),
                  amount: Number((item as IngredientPlanItem).amount ?? 0) || 0,
                } as IngredientPlanItem;
              }
              return null;
            })
            .filter(Boolean) as PlanItem[]
        : [];

      setDays(normalizedDays);
      setDaysError(false);
      setTargetMacros(normalizedTarget);
      setPlan(normalizedPlan);
      setOpen({});
      setActivePlan({
        id: saved.id ?? null,
        label: saved.label ?? null,
        updatedAt: saved.updated_at ?? saved.created_at ?? null,
      });
      setSaveLabel(saved.label ?? "");
      lastSavedPayloadRef.current = {
        days: normalizedDays,
        targetMacros: normalizedTarget,
        plan: normalizedPlan.map((item) =>
          item.type === "food" ? { ...item, overrides: { ...item.overrides } } : { ...item }
        ),
      };
      setIsDirty(false);
      setStatusMessage(message ?? `Loaded plan "${saved.label}"`);
      setSaveError(null);
  }, [
    lastSavedPayloadRef,
    setActivePlan,
    setDays,
    setDaysError,
    setIsDirty,
    setOpen,
    setPlan,
    setSaveError,
    setSaveLabel,
    setStatusMessage,
    setTargetMacros,
  ]);

  useEffect(() => {
    const current = buildPayload();
    const last = lastSavedPayloadRef.current;
    if (!last) {
      lastSavedPayloadRef.current = current;
      setIsDirty(hasContent);
      return;
    }
    const dirty =
      last.days !== current.days ||
      JSON.stringify(last.targetMacros) !== JSON.stringify(current.targetMacros) ||
      JSON.stringify(last.plan) !== JSON.stringify(current.plan);
    setIsDirty(dirty);
  }, [buildPayload, hasContent]);

  useEffect(() => {
    const state = location.state as { savedPlan?: PlanRead } | null;
    if (state?.savedPlan) {
      applySavedPlan(state.savedPlan, `Loaded plan "${state.savedPlan.label}"`);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [applySavedPlan, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (isDirty) {
      setStatusMessage(null);
    }
  }, [isDirty]);

  useEffect(() => {
    if (plan.length === 0) {
      return;
    }

    let changed = false;
    const adjustedPlan = plan.map((item) => {
      if (item.type === "ingredient") {
        const ingredient = findIngredientInLookup(
          ingredientLookup,
          (item as IngredientPlanItem).ingredientId,
        );
        const normalizedUnitId = normalizePlanUnitId((item as IngredientPlanItem).unitId);
        if (!ingredientSupportsUnit(ingredient, normalizedUnitId)) {
          const fallbackUnitId = fallbackUnitIdForIngredient(ingredient);
          if (fallbackUnitId !== normalizedUnitId) {
            changed = true;
            return {
              ...(item as IngredientPlanItem),
              unitId: fallbackUnitId,
            } as IngredientPlanItem;
          }
        }
        return item;
      }

      if (item.type === "food") {
        const foodItem = item as FoodPlanItem;
        const overrides: Record<string, FoodOverride> = { ...foodItem.overrides };
        let overridesChanged = false;

        Object.entries(overrides).forEach(([key, override]) => {
          if (!override) return;
          const dataIngredient = findIngredientInLookup(ingredientLookup, key);
          if (!dataIngredient) return;
          const normalizedOverrideUnitId = normalizePlanUnitId(override.unitId);
          if (ingredientSupportsUnit(dataIngredient, normalizedOverrideUnitId)) {
            const normalizedQuantity = toFiniteNumber(override.quantity);
            if (normalizedQuantity !== override.quantity) {
              overridesChanged = true;
              overrides[key] = {
                ...override,
                quantity: normalizedQuantity,
              };
            }
            return;
          }
          const fallbackUnitId = fallbackUnitIdForIngredient(dataIngredient);
          const normalizedQuantity = toFiniteNumber(override.quantity);
          if (
            fallbackUnitId !== normalizedOverrideUnitId ||
            normalizedQuantity !== override.quantity
          ) {
            overridesChanged = true;
            overrides[key] = {
              unitId: fallbackUnitId,
              quantity: normalizedQuantity,
            };
          }
        });

        const food = foods.find(
          (f) => String(f.id ?? "") === String(foodItem.foodId ?? ""),
        );
        food?.ingredients?.forEach((foodIngredient) => {
          const ingredientId = foodIngredient.ingredient_id;
          if (ingredientId === null || ingredientId === undefined) return;
          const dataIngredient = findIngredientInLookup(ingredientLookup, ingredientId);
          if (!dataIngredient) return;
          const normalizedDefaultUnitId = normalizePlanUnitId(foodIngredient.unit_id);
          if (ingredientSupportsUnit(dataIngredient, normalizedDefaultUnitId)) {
            return;
          }

          const key = String(ingredientId);
          const existingOverride = overrides[key];
          if (existingOverride) {
            const normalizedExistingUnitId = normalizePlanUnitId(existingOverride.unitId);
            if (ingredientSupportsUnit(dataIngredient, normalizedExistingUnitId)) {
              const normalizedQuantity = toFiniteNumber(existingOverride.quantity);
              if (normalizedQuantity !== existingOverride.quantity) {
                overridesChanged = true;
                overrides[key] = {
                  ...existingOverride,
                  quantity: normalizedQuantity,
                };
              }
              return;
            }
          }

          const fallbackUnitId = fallbackUnitIdForIngredient(dataIngredient);
          const normalizedQuantity = toFiniteNumber(
            existingOverride?.quantity ?? foodIngredient.unit_quantity,
          );
          overridesChanged = true;
          overrides[key] = {
            unitId: fallbackUnitId,
            quantity: normalizedQuantity,
          };
        });

        if (overridesChanged) {
          changed = true;
          return {
            ...foodItem,
            overrides,
          } as FoodPlanItem;
        }
      }

      return item;
    });

    if (changed) {
      setPlan(adjustedPlan);
    }
  }, [plan, foods, ingredientLookup, setPlan]);

  // Change unit while preserving total grams
  const handleUnitChange = (
    index: number,
    newUnitId: number,
    opts?: { ingredientId?: string }
  ) => {
    const updated = [...plan];
    const item = updated[index];
    if (!item) return;

    // Helper to get grams for a unit of an ingredient
    const getUnitGrams = (ingredientId: string, unitId: number) => {
      const ing = ingredients.find((i) => i.id === ingredientId);
      const units = ing?.units ?? [];
      const unit =
        units.find((u) => {
          if (u.id === null || u.id === undefined) {
            return unitId === GRAM_UNIT_SENTINEL;
          }
          return u.id === unitId;
        }) ||
        units.find((u) => Number(u.grams) === 1) ||
        units.find((u) => u.name === "1g") ||
        units[0];
      return unit?.grams ?? 0;
    };

    if (item.type === "food" && opts?.ingredientId) {
      const foodItem = item as FoodPlanItem;
      const ingredientId = opts.ingredientId;
      const dataIng = ingredients.find((i) => i.id === ingredientId);
      if (!dataIng) return;

      const currentOverride = foodItem.overrides[ingredientId];
      const currentUnitId = currentOverride?.unitId ?? 0;
      const currentQuantity = currentOverride?.quantity ?? 0;

      const currentGrams = getUnitGrams(ingredientId, currentUnitId) * currentQuantity;
      const newUnitGrams = getUnitGrams(ingredientId, newUnitId);

      // Avoid division by zero
      const newQuantity = newUnitGrams > 0 ? currentGrams / newUnitGrams : currentQuantity;

      foodItem.overrides = {
        ...foodItem.overrides,
        [ingredientId]: {
          unitId: newUnitId,
          quantity: newQuantity,
        },
      };
      updated[index] = { ...foodItem };
      setPlan(updated);
      return;
    }

    if (item.type === "ingredient") {
      const ingredientId = (item as IngredientPlanItem).ingredientId;
      const currentUnitId = (item as IngredientPlanItem).unitId;
      const currentAmount = (item as IngredientPlanItem).amount;

      const currentGrams = getUnitGrams(ingredientId, currentUnitId) * currentAmount;
      const newUnitGrams = getUnitGrams(ingredientId, newUnitId);
      const newAmount = newUnitGrams > 0 ? currentGrams / newUnitGrams : currentAmount;

      updated[index] = {
        ...(item as IngredientPlanItem),
        unitId: newUnitId,
        amount: newAmount,
      } as IngredientPlanItem;
      setPlan(updated);
      return;
    }
  };

  const handleAddItem = () => {
    if (selectedType === "food") {
      if (!selectedFoodId || selectedPortions <= 0) return;
      const existingIndex = plan.findIndex(
        (p) =>
          p.type === "food" &&
          String(p.foodId ?? "") === String(selectedFoodId ?? ""),
      );
      if (existingIndex >= 0) {
        const updated = [...plan];
        const existing = updated[existingIndex] as FoodPlanItem;
        updated[existingIndex] = {
          ...existing,
          portions: existing.portions + selectedPortions,
        };
        setPlan(updated);
      } else {
        // Build default overrides from the selected food's ingredients
        const food = foods.find(
          (f) => String(f.id ?? "") === String(selectedFoodId ?? ""),
        );
        const overrides: Record<string, FoodOverride> = {};
        food?.ingredients.forEach((ing) => {
          overrides[ing.ingredient_id] = {
            unitId: normalizePlanUnitId(ing.unit_id),
            quantity: ing.unit_quantity ?? 0,
          };
        });
        const newItem: FoodPlanItem = {
          type: "food",
          foodId: selectedFoodId,
          portions: selectedPortions,
          overrides,
        };
        setPlan([...plan, newItem]);
      }
      setSelectedFoodId("");
      setSelectedPortions(1);
    } else {
      if (!selectedIngredientId || selectedIngredientAmount <= 0) return;
      setPlan([
        ...plan,
        {
          type: "ingredient",
          ingredientId: selectedIngredientId,
          unitId: normalizePlanUnitId(selectedIngredientUnitId),
          amount: selectedIngredientAmount,
        },
      ]);
      setSelectedIngredientId("");
      setSelectedIngredientUnitId("");
      setSelectedIngredientAmount(1);
    }
  };

  const handleQuantityChange = (
    index: number,
    value: number,
    opts?: { ingredientId?: string }
  ) => {
    if (value <= 0) return;
    const updated = [...plan];
    const item = updated[index];
    if (!item) return;
    if (item.type === "food") {
      if (opts?.ingredientId) {
        const ingredientId = opts.ingredientId;
        const foodItem = item as FoodPlanItem;
        const current = foodItem.overrides[ingredientId];
        // Only update quantity for the specific ingredient override
        foodItem.overrides = {
          ...foodItem.overrides,
          [ingredientId]: {
            unitId: normalizePlanUnitId(current?.unitId),
            quantity: value,
          },
        };
        updated[index] = { ...foodItem };
      } else {
        updated[index] = { ...item, portions: value } as FoodPlanItem;
      }
    } else {
      updated[index] = { ...(item as IngredientPlanItem), amount: value };
    }
    setPlan(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = plan.filter((_, i) => i !== index);
    setPlan(updated);
  };

  const calculateIngredientMacros = useCallback(
    (ingredient, override?: FoodOverride) => {
      if (!ingredient) return { ...ZERO_MACROS };
      const ingredientId = ingredient.ingredient_id;
      if (ingredientId === null || ingredientId === undefined) {
        return { ...ZERO_MACROS };
      }
      const dataIngredient = findIngredientInLookup(ingredientLookup, ingredientId);
      if (!dataIngredient) {
        return { ...ZERO_MACROS };
      }
      return macrosForIngredientPortion({
        ingredient: dataIngredient,
        unitId: normalizePlanUnitId(override?.unitId ?? ingredient.unit_id),
        quantity: override?.quantity ?? ingredient.unit_quantity,
      });
    },
    [ingredientLookup]
  );

  const calculateFoodMacros = useCallback(
    (food, overrides?: Record<string, FoodOverride>) =>
      macrosForFood(food, ingredientLookup, overrides),
    [ingredientLookup]
  );

  const calculateItemMacros = useCallback(
    (item: PlanItem) => {
      if (item.type === "food") {
        const food = foods.find(
          (m) => String(m.id ?? "") === String(item.foodId ?? ""),
        );
        const macros = calculateFoodMacros(food, item.overrides);
        return {
          calories: macros.calories * item.portions,
          protein: macros.protein * item.portions,
          fat: macros.fat * item.portions,
          carbs: macros.carbs * item.portions,
          fiber: macros.fiber * item.portions,
        };
      }
      return calculateIngredientMacros({
        ingredient_id: item.ingredientId,
        unit_id: normalizePlanUnitId(item.unitId),
        unit_quantity: item.amount,
      });
    },
    [foods, calculateFoodMacros, calculateIngredientMacros]
  );

  const totalMacros = useMemo(() => {
    return plan.reduce(
      (totals, item) => {
        const macros = calculateItemMacros(item);
        totals.calories += macros.calories;
        totals.protein += macros.protein;
        totals.fat += macros.fat;
        totals.carbs += macros.carbs;
        totals.fiber += macros.fiber;
        return totals;
      },
      { ...ZERO_MACROS }
    );
  }, [plan, calculateItemMacros]);

  const perDayMacros = useMemo(() => {
    if (days <= 0) {
      return { ...ZERO_MACROS };
    }
    return {
      calories: totalMacros.calories / days,
      protein: totalMacros.protein / days,
      fat: totalMacros.fat / days,
      carbs: totalMacros.carbs / days,
      fiber: totalMacros.fiber / days,
    };
  }, [totalMacros, days]);

  const handleDaysChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!value || value < 1) {
      setDays(1);
      setDaysError(true);
    } else {
      setDays(value);
      setDaysError(false);
    }
  };

  const handleOpenSaveDialog = () => {
    setSaveError(null);
    setSaveLabel(activePlan.label ?? "");
    setSaveDialogOpen(true);
  };

  const handleCloseSaveDialog = () => {
    if (saving) {
      return;
    }
    setSaveDialogOpen(false);
    setSaveError(null);
  };

  const handleSaveAsNewPlan = async () => {
    const trimmed = saveLabel.trim();
    if (!trimmed) {
      setSaveError("Plan name is required");
      return;
    }
    setSaving("create");
    try {
      const payload = buildPayload();
      const saved = await createPlan(trimmed, payload);
      applySavedPlan(saved, `Saved plan "${saved.label}"`);
      setSaveDialogOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save plan");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateExistingPlan = async () => {
    if (activePlan.id === null) {
      await handleSaveAsNewPlan();
      return;
    }
    const trimmed = saveLabel.trim();
    if (!trimmed) {
      setSaveError("Plan name is required");
      return;
    }
    setSaving("update");
    try {
      const payload = buildPayload();
      const updated = await updatePlan(activePlan.id, { label: trimmed, payload });
      applySavedPlan(updated, `Updated plan "${updated.label}"`);
      setSaveDialogOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update plan");
    } finally {
      setSaving(null);
    }
  };

  const handleResetPlan = () => {
    if ((isDirty || activePlan.id !== null) &&
      !window.confirm("Discard the current plan? Unsaved changes will be lost.")) {
      return;
    }
    setDays(1);
    setDaysError(false);
    setTargetMacros({ ...ZERO_MACROS });
    setPlan([]);
    setOpen({});
    setActivePlan({ id: null, label: null, updatedAt: null });
    lastSavedPayloadRef.current = null;
    setIsDirty(false);
    setStatusMessage(null);
    setSaveLabel("");
  };

  const handleManagePlans = () => {
    navigate("/data", { state: { tab: "plans" } });
  };

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" component="h1">Planning</Typography>
          {activePlan.label ? (
            <Typography variant="body2" color="text.secondary">
              {`Editing saved plan "${activePlan.label}"`}
              {isDirty
                ? " (unsaved changes)"
                : activePlan.updatedAt
                ? ` (last saved ${formatPlanTimestamp(activePlan.updatedAt)})`
                : ""}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Build a plan and save it for later.
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={handleResetPlan}
            disabled={!canResetPlan}
          >
            New Empty Plan
          </Button>
          <Button
            variant="outlined"
            startIcon={<ManageIcon />}
            onClick={handleManagePlans}
          >
            Load or Manage Saved Plans
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleOpenSaveDialog}
          >
            Save Plan
          </Button>
        </Stack>
      </Stack>

      {statusMessage && <Alert severity="success">{statusMessage}</Alert>}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <TextField
          type="number"
          label="Days"
          value={days}
          onChange={handleDaysChange}
          sx={{ width: 100 }}
          error={daysError}
          helperText={daysError ? "Days must be at least 1" : ""}
        />
        {macroKeys.map((macro) => (
          <TextField
            key={macro}
            type="number"
            label={`Target ${macro}`}
            value={macroInputs[macro] ?? "0"}
            onFocus={() => {
              setActiveMacro(macro);
              setMacroInputs((prev) => {
                const current = prev[macro];
                if (current === "0") {
                  return { ...prev, [macro]: "" };
                }
                return prev;
              });
            }}
            onChange={(e) => {
              const { value } = e.target;
              setMacroInputs((prev) => ({
                ...prev,
                [macro]: value,
              }));
              setTargetMacros((prev) => ({
                ...prev,
                [macro]: value === "" ? 0 : Number.parseFloat(value) || 0,
              }));
            }}
            onBlur={() => {
              setActiveMacro(null);
              const currentValue = macroInputs[macro]?.trim() ?? "";
              if (currentValue === "" || Number.isNaN(Number.parseFloat(currentValue))) {
                setMacroInputs((prev) => ({
                  ...prev,
                  [macro]: "0",
                }));
                setTargetMacros((prev) => ({
                  ...prev,
                  [macro]: 0,
                }));
              }
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField
          select
          label="Type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="food">Food</MenuItem>
          <MenuItem value="ingredient">Ingredient</MenuItem>
        </TextField>
        {selectedType === "food" ? (
          <>
            <Box sx={{ minWidth: 260, flexGrow: 1 }}>
              <Autocomplete
                value={selectedFood}
                onChange={(_, newValue) => {
                  const id =
                    newValue && newValue.id !== undefined && newValue.id !== null
                      ? String(newValue.id)
                      : "";
                  setSelectedFoodId(id);
                }}
                inputValue={foodSearchInput}
                onInputChange={(_, newInputValue) => setFoodSearchInput(newInputValue)}
                options={foodOptions}
                filterOptions={foodFilter}
                getOptionLabel={(option) => option?.name ?? ""}
                isOptionEqualToValue={(option, value) =>
                  String(option?.id ?? option?.name ?? "") ===
                  String(value?.id ?? value?.name ?? "")
                }
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Typography variant="body2">{option.name}</Typography>
                      {Array.isArray(option.tags) && option.tags.length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {option.tags.map((tag) => (
                            <Chip
                              key={`${option.id ?? option.name}-tag-${tag.id ?? tag.name}`}
                              size="small"
                              label={tag.name}
                            />
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Food" placeholder="Search foods" />
                )}
                ListboxProps={{ sx: { maxHeight: 360 } }}
              />
              <Box sx={{ mt: 1 }}>
                <TagFilter
                  tags={allFoodTags}
                  selectedTags={foodTagFilters}
                  onChange={setFoodTagFilters}
                  label="Filter food tags"
                />
              </Box>
            </Box>
            <TextField
              type="number"
              label="Portions"
              value={selectedPortions}
              onChange={(e) =>
                setSelectedPortions(parseFloat(e.target.value) || 0)
              }
              sx={{ width: 100 }}
              error={selectedPortions <= 0}
              helperText={
                selectedPortions <= 0 ? "Portions must be greater than 0" : ""
              }
            />
          </>
        ) : (
          <>
            <Box sx={{ minWidth: 260, flexGrow: 1 }}>
              <Autocomplete
                value={selectedIngredient}
                onChange={(_, newValue) => {
                  if (!newValue) {
                    setSelectedIngredientId("");
                    setSelectedIngredientUnitId("");
                    return;
                  }
                  const id =
                    newValue.id !== undefined && newValue.id !== null
                      ? String(newValue.id)
                      : "";
                  setSelectedIngredientId(id);
                  const fallbackUnit =
                    newValue.units?.find((unit) => Number(unit.grams) === 1) ??
                    newValue.units?.[0];
                  setSelectedIngredientUnitId(
                    fallbackUnit ? getUnitOptionValue(fallbackUnit.id) : "",
                  );
                }}
                inputValue={ingredientSearchInput}
                onInputChange={(_, newInputValue) =>
                  setIngredientSearchInput(newInputValue)
                }
                options={ingredientOptions}
                filterOptions={ingredientFilter}
                getOptionLabel={(option) => option?.name ?? ""}
                isOptionEqualToValue={(option, value) =>
                  String(option?.id ?? option?.name ?? "") ===
                  String(value?.id ?? value?.name ?? "")
                }
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Typography variant="body2">{option.name}</Typography>
                      {Array.isArray(option.tags) && option.tags.length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {option.tags.map((tag) => (
                            <Chip
                              key={`${option.id ?? option.name}-tag-${tag.id ?? tag.name}`}
                              size="small"
                              label={tag.name}
                            />
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ingredient"
                    placeholder="Search ingredients"
                  />
                )}
                ListboxProps={{ sx: { maxHeight: 360 } }}
              />
              <Box sx={{ mt: 1 }}>
                <TagFilter
                  tags={allIngredientTags}
                  selectedTags={ingredientTagFilters}
                  onChange={setIngredientTagFilters}
                  label="Filter ingredient tags"
                />
              </Box>
            </Box>
            <TextField
              select
              label="Unit"
              value={selectedIngredientUnitId}
              onChange={(e) => setSelectedIngredientUnitId(e.target.value)}
              sx={{ minWidth: 140 }}
              disabled={!selectedIngredient || (selectedIngredient.units?.length ?? 0) === 0}
            >
              {(selectedIngredient?.units ?? []).map((unit) => {
                const optionValue = getUnitOptionValue(unit.id);
                return (
                  <MenuItem
                    key={unit.id ?? `${selectedIngredient?.id ?? "ingredient"}-${unit.name}`}
                    value={optionValue}
                  >
                    {unit.name}
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              type="number"
              label="Amount"
              value={selectedIngredientAmount}
              onChange={(e) =>
                setSelectedIngredientAmount(
                  parseFloat(e.target.value) || 0
                )
              }
              sx={{ width: 100 }}
              error={selectedIngredientAmount <= 0}
              helperText={
                selectedIngredientAmount <= 0
                  ? "Amount must be greater than 0"
                  : ""
              }
            />
          </>
        )}
        <Button
          variant="contained"
          onClick={handleAddItem}
          disabled={
            selectedType === "food"
              ? !selectedFoodId || selectedPortions <= 0
              : !selectedIngredientId || selectedIngredientAmount <= 0
          }
        >
          Add
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plan.map((item, index) => {
            if (item.type === "food") {
              const food = foods.find(
                (m) => String(m.id ?? "") === String(item.foodId ?? ""),
              );
              const macros = calculateFoodMacros(food, item.overrides);
              return (
                <React.Fragment key={`food-${item.foodId}`}>
                  <TableRow>
                    <TableCell onClick={() => setOpen({ ...open, [index]: !open[index] })}>
                      {open[index] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                    </TableCell>
                    <TableCell>{food ? food.name : ""}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton
                          size="small"
                          aria-label="decrement portions"
                          onClick={() =>
                            handleQuantityChange(index, Math.max(1, item.portions - 1))
                          }
                        >
                          <Remove fontSize="small" />
                        </IconButton>
                        <TextField
                          type="number"
                          value={item.portions}
                          onChange={(e) =>
                            handleQuantityChange(index, parseFloat(e.target.value) || 0)
                          }
                          sx={{ width: 80 }}
                        />
                        <IconButton
                          size="small"
                          aria-label="increment portions"
                          onClick={() => handleQuantityChange(index, item.portions + 1)}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(macros.calories * item.portions)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(macros.protein * item.portions)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(macros.carbs * item.portions)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(macros.fat * item.portions)}
                    </TableCell>
                    <TableCell>
                      {formatCellNumber(macros.fiber * item.portions)}
                    </TableCell>
                    <TableCell>
                      <Button color="error" onClick={() => handleRemoveItem(index)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                      <Collapse in={open[index]} timeout="auto" unmountOnExit>
                        <Typography variant="h6" gutterBottom component="div">
                          Ingredients
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Unit</TableCell>
                              <TableCell>Amount</TableCell>
                              <TableCell>Calories</TableCell>
                              <TableCell>Protein</TableCell>
                              <TableCell>Carbs</TableCell>
                              <TableCell>Fat</TableCell>
                              <TableCell>Fiber</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {food?.ingredients.map((ingredient) => {
                              const dataIngredient = findIngredientInLookup(ingredientLookup, ingredient.ingredient_id);
                              const override = item.overrides[ingredient.ingredient_id];
                              const unitId = normalizePlanUnitId(
                                override?.unitId ?? ingredient.unit_id,
                              );
                              const quantity = override?.quantity ?? ingredient.unit_quantity;
                              const ingMacros = calculateIngredientMacros(
                                ingredient,
                                { unitId, quantity },
                              );
                              return (
                                <TableRow key={ingredient.ingredient_id}>
                                  <TableCell>
                                    <NameWithEdit
                                      name={dataIngredient ? dataIngredient.name : ""}
                                      onEdit={() => handleOpenIngredientEditor(ingredient.ingredient_id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                  <TextField
                                    select
                                    value={unitId}
                                    onChange={(e) =>
                                      handleUnitChange(
                                        index,
                                          normalizePlanUnitId(e.target.value),
                                          { ingredientId: ingredient.ingredient_id }
                                        )
                                      }
                                      sx={{ minWidth: 120 }}
                                      key={`food-item-unit-${ingredient.ingredient_id}-${
                                        (dataIngredient?.units?.length) ?? 0
                                      }`}
                                    >
                                      {(dataIngredient?.units || []).map((u) => (
                                        <MenuItem
                                          key={u.id ?? `${ingredient.ingredient_id}-${u.name}`}
                                          value={normalizePlanUnitId(u.id)}
                                        >
                                          {u.name}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  </TableCell>
                                  <TableCell>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <IconButton
                                        size="small"
                                        aria-label="decrement quantity"
                                        onClick={() =>
                                          handleQuantityChange(
                                            index,
                                            Math.max(1, (quantity || 0) - 1),
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                      >
                                        <Remove fontSize="small" />
                                      </IconButton>
                                      <TextField
                                        type="number"
                                        value={quantity}
                                        onChange={(e) =>
                                          handleQuantityChange(
                                            index,
                                            parseFloat(e.target.value) || 0,
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                        sx={{ width: 80 }}
                                      />
                                      <IconButton
                                        size="small"
                                        aria-label="increment quantity"
                                        onClick={() =>
                                          handleQuantityChange(
                                            index,
                                            (quantity || 0) + 1,
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                      >
                                        <Add fontSize="small" />
                                      </IconButton>
                                      <Box component="span">x {item.portions}</Box>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.calories * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.protein * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.carbs * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.fat * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.fiber * item.portions)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            } else {
              const ingredient = findIngredientInLookup(ingredientLookup, item.ingredientId);
              const normalizedUnitId = normalizePlanUnitId(item.unitId);
              const macros = calculateIngredientMacros({
                ingredient_id: item.ingredientId,
                unit_id: normalizedUnitId,
                unit_quantity: item.amount,
              });
              return (
                <TableRow key={`ingredient-${index}`}>
                  <TableCell />
                  <TableCell>
                    <NameWithEdit
                      name={ingredient ? ingredient.name : ""}
                      onEdit={() => ingredient && handleOpenIngredientEditor(ingredient.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <IconButton
                        size="small"
                        aria-label="decrement amount"
                        onClick={() =>
                          handleQuantityChange(index, Math.max(1, item.amount - 1))
                        }
                      >
                        <Remove fontSize="small" />
                      </IconButton>
                      <TextField
                        type="number"
                        value={item.amount}
                        onChange={(e) =>
                          handleQuantityChange(index, parseFloat(e.target.value) || 0)
                        }
                        sx={{ width: 80 }}
                      />
                      <IconButton
                        size="small"
                        aria-label="increment amount"
                        onClick={() => handleQuantityChange(index, item.amount + 1)}
                      >
                        <Add fontSize="small" />
                      </IconButton>
                      <TextField
                        select
                        value={normalizedUnitId}
                        onChange={(e) =>
                          handleUnitChange(index, normalizePlanUnitId(e.target.value))
                        }
                        sx={{ minWidth: 120 }}
                        key={`single-item-unit-${item.ingredientId}-${
                          (ingredient?.units?.length) ?? 0
                        }`}
                      >
                        {(ingredient?.units || []).map((u) => (
                          <MenuItem
                            key={u.id ?? `${item.ingredientId}-${u.name}`}
                            value={normalizePlanUnitId(u.id)}
                          >
                            {u.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </TableCell>
                  <TableCell>{formatCellNumber(macros.calories)}</TableCell>
                  <TableCell>{formatCellNumber(macros.protein)}</TableCell>
                  <TableCell>{formatCellNumber(macros.carbs)}</TableCell>
                  <TableCell>{formatCellNumber(macros.fat)}</TableCell>
                  <TableCell>{formatCellNumber(macros.fiber)}</TableCell>
                  <TableCell>
                    <Button color="error" onClick={() => handleRemoveItem(index)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }
          })}
        </TableBody>
        </Table>
      </TableContainer>

      <Box>
        <h2>Summary</h2>
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
              <TableCell>{formatCellNumber(totalMacros.calories)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.protein)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.carbs)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fat)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fiber)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per Day</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.calories)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.protein)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.carbs)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.fat)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.fiber)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>{targetMacros.calories}</TableCell>
              <TableCell>{targetMacros.protein}</TableCell>
              <TableCell>{targetMacros.carbs}</TableCell>
              <TableCell>{targetMacros.fat}</TableCell>
              <TableCell>{targetMacros.fiber}</TableCell>
            </TableRow>
          </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Dialog open={saveDialogOpen} onClose={handleCloseSaveDialog} fullWidth maxWidth="xs">
        <DialogTitle>Save Plan</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Plan name"
            value={saveLabel}
            onChange={(event) => setSaveLabel(event.target.value)}
            autoFocus
          />
          {activePlan.label && (
            <Typography variant="body2" color="text.secondary">
              {`Currently editing "${activePlan.label}". Choose whether to update it or save as new.`}
            </Typography>
          )}
          {saveError && <Alert severity="error">{saveError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Button onClick={handleCloseSaveDialog} disabled={saving !== null}>
            Cancel
          </Button>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {activePlan.id !== null && (
              <Button
                variant="contained"
                color="secondary"
                onClick={() => void handleUpdateExistingPlan()}
                disabled={saving === "create"}
              >
                Update Plan
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => void handleSaveAsNewPlan()}
              disabled={saving === "update"}
            >
              Save as New
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <IngredientModal
        open={ingredientModalOpen}
        mode="edit"
        ingredient={editorIngredient}
        onClose={() => {
          setIngredientModalOpen(false);
          setEditorIngredient(null);
        }}
      />
    </Box>
  );
}

export default Planning;


























