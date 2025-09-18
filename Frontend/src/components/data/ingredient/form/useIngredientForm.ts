import { useCallback, useReducer } from "react";

import { useData } from "@/contexts/DataContext";
import { handleFetchRequest } from "@/utils/utils";
import type { components, operations } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];
type IngredientUnitUpdate = components["schemas"]["IngredientUnitUpdate"];
type IngredientUnitCreate = components["schemas"]["IngredientUnitCreate"];
type IngredientRequest = operations["add_ingredient_api_ingredients__post"]["requestBody"]["content"]["application/json"];

type IngredientFormState = {
  ingredient: IngredientRead & { selectedUnitId?: number | string | null };
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
  id: crypto.randomUUID(),
  units: [
    {
      id: "0",
      ingredient_id: crypto.randomUUID(),
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
  selectedUnitId: "0",
});

const initialState: IngredientFormState = {
  ingredient: initializeEmptyIngredient(),
  needsClearForm: false,
  needsFillForm: false,
};

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

  return payload;
};

export const useIngredientForm = () => {
  const { setIngredientsNeedsRefetch, startRequest, endRequest } = useData();
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadIngredient = useCallback((initial?: IngredientRead | null) => {
    if (initial) {
      dispatch({ type: "SET_INGREDIENT", payload: { ...initial } });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    } else {
      dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
    }
  }, []);

  const clearForm = useCallback(() => {
    dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, []);

  const acknowledgeClearFlag = useCallback(() => {
    dispatch({ type: "SET_CLEAR_FORM", payload: false });
  }, []);

  const acknowledgeFillFlag = useCallback(() => {
    dispatch({ type: "SET_FILL_FORM", payload: false });
  }, []);

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
  };
};



