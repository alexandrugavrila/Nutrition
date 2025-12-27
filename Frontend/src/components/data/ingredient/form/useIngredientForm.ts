import { useCallback } from "react";

import { useData } from "@/contexts/DataContext";
import { useSessionStorageReducer } from "@/hooks/useSessionStorageState";
import { generateUUID, handleFetchRequest } from "@/utils/utils";
import type { components, operations } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];
type IngredientUnitUpdate = components["schemas"]["IngredientUnitUpdate"];
type IngredientUnitCreate = components["schemas"]["IngredientUnitCreate"];
type IngredientShoppingUnitSelection = components["schemas"]["IngredientShoppingUnitSelection"];
type IngredientRequest = operations["add_ingredient_api_ingredients__post"]["requestBody"]["content"]["application/json"];

export type IngredientSource = "manual" | "usda";

export type UsdaIngredientResult = {
  id: string;
  name: string;
  nutrition: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
  };
};

type IngredientFormIngredient = IngredientRead & {
  shoppingUnitId?: number | string | null;
  source?: IngredientSource;
  source_id?: string | null;
  sourceName?: string | null;
};

type IngredientFormState = {
  ingredient: IngredientFormIngredient;
  needsClearForm: boolean;
  needsFillForm: boolean;
};

type IngredientFormAction =
  | { type: "SET_INGREDIENT"; payload: IngredientFormState["ingredient"] }
  | { type: "SET_CLEAR_FORM"; payload: boolean }
  | { type: "SET_FILL_FORM"; payload: boolean };

type SaveOptions = {
  mode: "add" | "edit";
  onSaved?: () => void;
  autoClearOnAdd?: boolean;
};

type DeleteOptions = {
  onDeleted?: () => void;
};

const initializeEmptyIngredient = (): IngredientFormState["ingredient"] => ({
  name: "",
  id: generateUUID(),
  units: [
    {
      id: "0",
      ingredient_id: generateUUID(),
      name: "g",
      grams: "1",
    } as IngredientUnitCreate & { id: string },
  ],
  nutrition: {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  },
  tags: [],
  shoppingUnitId: "0",
  source: "manual",
  source_id: null,
  sourceName: null,
});

const createInitialState = (): IngredientFormState => ({
  ingredient: initializeEmptyIngredient(),
  needsClearForm: false,
  needsFillForm: false,
});

const reducer = (state: IngredientFormState, action: IngredientFormAction): IngredientFormState => {
  switch (action.type) {
    case "SET_INGREDIENT":
      return { ...state, ingredient: action.payload };
    case "SET_CLEAR_FORM":
      return { ...state, needsClearForm: action.payload };
    case "SET_FILL_FORM":
      return { ...state, needsFillForm: action.payload };
    default:
      return state;
  }
};

const sanitizeUnits = (units: IngredientRead["units"]): (IngredientUnitCreate | IngredientUnitUpdate)[] =>
  (units ?? [])
    .filter((unit) => unit.name !== "g")
    .map(({ id, ...rest }) => (typeof id === "number" ? { id, ...rest } : rest));

const buildRequestPayload = (ingredient: IngredientFormState["ingredient"]): IngredientRequest => {
  const payload: IngredientRequest = {
    ...ingredient,
    units: sanitizeUnits(ingredient.units),
  } as IngredientRequest;

  if (typeof payload.id !== "number") {
    delete (payload as { id?: number }).id;
  }

  // Remove local-only helper property
  delete (payload as { shoppingUnitId?: unknown }).shoppingUnitId;
  delete (payload as { sourceName?: unknown }).sourceName;

  const normalizeShoppingUnitId = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const normalizedId = normalizeShoppingUnitId(ingredient.shoppingUnitId);
  if ("shopping_unit_id" in payload) {
    delete (payload as { shopping_unit_id?: number | null }).shopping_unit_id;
  }
  if ("shopping_unit" in payload) {
    delete (payload as { shopping_unit?: IngredientShoppingUnitSelection | null }).shopping_unit;
  }

  if (normalizedId !== null) {
    (payload as { shopping_unit_id?: number | null }).shopping_unit_id = normalizedId;
  } else {
    const match = (ingredient.units ?? []).find((unit) => {
      if (unit.id === ingredient.shoppingUnitId) return true;
      if (
        typeof ingredient.shoppingUnitId === "string" &&
        unit.id !== null &&
        unit.id !== undefined &&
        String(unit.id) === ingredient.shoppingUnitId
      ) {
        return true;
      }
      return false;
    });

    if (ingredient.shoppingUnitId === null) {
      (payload as { shopping_unit_id?: number | null }).shopping_unit_id = null;
    } else if (match) {
      const selection: IngredientShoppingUnitSelection = {
        unit_id:
          typeof match.id === "number" && Number.isFinite(match.id)
            ? match.id
            : undefined,
        name: match.name,
        grams: Number(match.grams),
      };
      (payload as { shopping_unit?: IngredientShoppingUnitSelection }).shopping_unit = selection;
    }
  }

  return payload;
};

export const useIngredientForm = () => {
  const { setIngredientsNeedsRefetch, startRequest, endRequest } = useData();
  const [state, dispatch] = useSessionStorageReducer(reducer, createInitialState, "ingredient-form-state-v1");

  const applyIngredientDefaults = useCallback((ingredient: IngredientRead): IngredientFormState["ingredient"] => {
    const maybeIngredient = ingredient as IngredientFormState["ingredient"];
    return {
      ...ingredient,
      source: maybeIngredient.source ?? "manual",
      source_id: maybeIngredient.source_id ?? null,
      sourceName: maybeIngredient.sourceName ?? null,
    };
  }, []);

  const loadIngredient = useCallback(
    (initial?: IngredientRead | null) => {
      if (initial) {
        dispatch({ type: "SET_INGREDIENT", payload: applyIngredientDefaults(initial) });
        dispatch({ type: "SET_FILL_FORM", payload: true });
      } else {
        dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
      }
    },
    [dispatch, applyIngredientDefaults],
  );

  const clearForm = useCallback(() => {
    dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, [dispatch]);

  const acknowledgeClearFlag = useCallback(() => {
    dispatch({ type: "SET_CLEAR_FORM", payload: false });
  }, [dispatch]);

  const acknowledgeFillFlag = useCallback(() => {
    dispatch({ type: "SET_FILL_FORM", payload: false });
  }, [dispatch]);

  const save = useCallback(
    async ({ mode, onSaved, autoClearOnAdd = true }: SaveOptions) => {
      const payload = buildRequestPayload(state.ingredient);
      const targetId = state.ingredient.id;
      const isEdit = mode === "edit" && typeof targetId === "number";
      const url = isEdit ? `/api/ingredients/${targetId}` : "/api/ingredients/";
      const method = isEdit ? "PUT" : "POST";

      startRequest();
      try {
        await handleFetchRequest(url, method, payload);
        setIngredientsNeedsRefetch(true);
        if (mode === "add" && autoClearOnAdd) {
          clearForm();
        }
        onSaved?.();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error saving ingredient:", error);
      } finally {
        endRequest();
      }
    },
    [state.ingredient, startRequest, endRequest, setIngredientsNeedsRefetch, clearForm],
  );

  const remove = useCallback(
    async ({ onDeleted }: DeleteOptions = {}) => {
      const ingredientId = state.ingredient.id;
      if (typeof ingredientId !== "number") return;

      startRequest();
      try {
        const response = await fetch(`/api/ingredients/${ingredientId}`, { method: "DELETE" });
        if (!response.ok) {
          // eslint-disable-next-line no-console
          console.error("Failed to remove ingredient");
        } else {
          setIngredientsNeedsRefetch(true);
          onDeleted?.();
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error deleting ingredient:", error);
      } finally {
        endRequest();
      }
    },
    [state.ingredient.id, startRequest, endRequest, setIngredientsNeedsRefetch],
  );

  const applyUsdaResult = useCallback(
    (result: UsdaIngredientResult) => {
      const updatedNutrition = {
        calories: result.nutrition.calories ?? 0,
        protein: result.nutrition.protein ?? 0,
        carbohydrates: result.nutrition.carbohydrates ?? 0,
        fat: result.nutrition.fat ?? 0,
        fiber: result.nutrition.fiber ?? 0,
      };

      dispatch({
        type: "SET_INGREDIENT",
        payload: {
          ...state.ingredient,
          name: result.name,
          nutrition: updatedNutrition,
          source: "usda",
          source_id: result.id,
          sourceName: result.name,
        },
      });
    },
    [dispatch, state.ingredient],
  );

  return {
    ingredient: state.ingredient,
    needsClearForm: state.needsClearForm,
    needsFillForm: state.needsFillForm,
    dispatch,
    loadIngredient,
    clearForm,
    acknowledgeClearFlag,
    acknowledgeFillFlag,
    save,
    remove,
    applyUsdaResult,
  };
};
