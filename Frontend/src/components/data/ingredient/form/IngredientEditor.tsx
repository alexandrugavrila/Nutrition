// @ts-check
import React, { useEffect, useReducer, useCallback } from "react";
import { Box, Button, Divider } from "@mui/material";

import { useData } from "@/contexts/DataContext";
import { handleFetchRequest } from "@/utils/utils";

import NameEdit from "./NameEdit";
import UnitEdit from "./UnitEdit";
import NutritionEdit from "./NutritionEdit";
import TagEdit from "./TagEdit";

/**
 * A focused Ingredient editor meant for embedding in a Drawer/Modal.
 * Reuses the same sub-editors as the collapsible IngredientForm, but
 * leaves layout and open/close to the parent.
 */

/**
 * @typedef {import("../../../../api-types").components["schemas"]["IngredientRead"]} IngredientRead
 * @typedef {import("../../../../api-types").operations["add_ingredient_api_ingredients__post"]["requestBody"]["content"]["application/json"]} IngredientRequest
 */

const initialState = {
  ingredient: /** @type {any} */ ({
    name: "",
    id: crypto.randomUUID(),
    units: [{ id: "0", ingredient_id: crypto.randomUUID(), name: "g", grams: "1" }],
    nutrition: {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
    },
    tags: [],
    selectedUnitId: "0",
  }),
  needsClearForm: false,
  needsFillForm: false,
};

const reducer = (state, action) => {
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

/**
 * @param {{
 *  mode: 'add' | 'edit',
 *  initial?: IngredientRead | null,
 *  onSaved?: () => void,
 *  onDeleted?: () => void
 * }} props
 */
function IngredientEditor({ mode, initial = null, onSaved, onDeleted }) {
  const { setIngredientsNeedsRefetch, startRequest, endRequest } = useData();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { ingredient, needsClearForm, needsFillForm } = state;

  const initializeEmpty = () => ({
    name: "",
    id: crypto.randomUUID(),
    units: [{ id: "0", ingredient_id: crypto.randomUUID(), name: "g", grams: "1" }],
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

  const handleClear = useCallback(() => {
    dispatch({ type: "SET_INGREDIENT", payload: initializeEmpty() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, []);

  const handleSave = () => {
    // Prepare ingredient for API by removing temporary UUID ids
    const toDatabaseIngredient = {
      ...ingredient,
      units: ingredient.units
        .filter((unit) => unit.name !== "g")
        .map(({ id, ...unit }) => (typeof id === "number" ? { id, ...unit } : unit)),
    };

    if (typeof toDatabaseIngredient.id !== "number") {
      delete toDatabaseIngredient.id;
    }

    const url = mode === "edit" ? `/api/ingredients/${ingredient.id}` : "/api/ingredients/";
    const method = mode === "edit" ? "PUT" : "POST";
    const data = /** @type {IngredientRequest} */ (toDatabaseIngredient);

    startRequest();
    handleFetchRequest(url, method, data)
      .then(() => {
        setIngredientsNeedsRefetch(true);
        if (mode === "add") handleClear();
        onSaved && onSaved();
      })
      .catch((error) => console.error("Error:", error))
      .finally(endRequest);
  };

  const handleDelete = () => {
    if (mode !== "edit" || !ingredient || typeof ingredient.id !== "number") return;
    startRequest();
    fetch(`/api/ingredients/${ingredient.id}`, { method: "DELETE" })
      .then(() => {
        setIngredientsNeedsRefetch(true);
        onDeleted && onDeleted();
      })
      .catch((error) => console.error("Error:", error))
      .finally(endRequest);
  };

  // Initialize / fill state
  useEffect(() => {
    if (initial) {
      dispatch({ type: "SET_INGREDIENT", payload: { ...initial } });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    } else {
      dispatch({ type: "SET_INGREDIENT", payload: initializeEmpty() });
    }
  }, [initial]);

  useEffect(() => {
    if (needsClearForm) dispatch({ type: "SET_CLEAR_FORM", payload: false });
  }, [needsClearForm]);

  useEffect(() => {
    if (needsFillForm) dispatch({ type: "SET_FILL_FORM", payload: false });
  }, [needsFillForm]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NameEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />
      <UnitEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />
      <NutritionEdit
        ingredient={ingredient}
        dispatch={dispatch}
        needsClearForm={needsClearForm}
        needsFillForm={needsFillForm}
      />
      <TagEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />

      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button onClick={handleClear}>Clear</Button>
        <Button variant="contained" onClick={handleSave}>
          {mode === "edit" ? "Update" : "Add"}
        </Button>
        {mode === "edit" && (
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default IngredientEditor;

