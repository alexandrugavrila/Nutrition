// @ts-check
import React, { useEffect, useCallback, useReducer } from "react";
import { Button, Collapse, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Box } from "@mui/material";

import { useData } from "@/contexts/DataContext";

import NameEdit from "./NameEdit";
import UnitEdit from "./UnitEdit";
import NutritionEdit from "./NutritionEdit";
import TagEdit from "./TagEdit";

import { handleFetchRequest } from "@/utils/utils";

/**
 * @typedef {import("../../../../api-types").operations["add_ingredient_api_ingredients__post"]["requestBody"]["content"]["application/json"]} IngredientRequest
 * @typedef {import("../../../../api-types").operations["add_ingredient_api_ingredients__post"]["responses"][201]["content"]["application/json"]} IngredientResponse
 */

const initialState = {
  isOpen: false,
  openConfirmationDialog: false,
  isEditMode: false,
  ingredientToEdit: {
    name: "",
    id: crypto.randomUUID(),
    units: [{ id: "0", ingredient_id: crypto.randomUUID(), name: "1g", grams: "1" }],
    nutrition: {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
    },
    tags: [],
    selectedUnitId: "0",
  },
  needsClearForm: false,
  needsFillForm: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "OPEN_FORM":
      return { ...state, isOpen: action.payload };
    case "SET_EDIT_MODE":
      return { ...state, isEditMode: action.payload };
    case "SET_INGREDIENT":
      return { ...state, ingredientToEdit: action.payload };
    case "SET_CLEAR_FORM":
      return { ...state, needsClearForm: action.payload };
    case "SET_FILL_FORM":
      return { ...state, needsFillForm: action.payload };
    case "SET_CONFIRMATION_DIALOG":
      return { ...state, openConfirmationDialog: action.payload };
    default:
      return state;
  }
};

function IngredientForm({ ingredientToEditData }) {
  //#region State and Dispatch
  const { setIngredientsNeedsRefetch, startRequest, endRequest } = useData();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { isOpen, openConfirmationDialog, isEditMode, ingredientToEdit, needsClearForm, needsFillForm } = state;

  const initializeEmptyIngredient = () => ({
    name: "",
    id: crypto.randomUUID(),
    units: [{ id: "0", ingredient_id: crypto.randomUUID(), name: "1g", grams: "1" }],
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
  //#endregion State and Dispatch

  //#region Handlers
  const handleClearForm = useCallback(() => {
    dispatch({ type: "SET_EDIT_MODE", payload: false });
    dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
    handleCloseConfirmationDialog();
  }, []);

  const handleIngredientAction = () => {
    // Prepare ingredient for API by removing temporary UUID ids
    const toDatabaseIngredient = {
      ...ingredientToEdit,
      units: ingredientToEdit.units
        .filter((unit) => unit.name !== "1g") // Remove the 1g unit from ingredientToEdit
        .map(({ id, ...unit }) =>
          typeof id === "number" ? { id, ...unit } : unit
        ),
    };

    // Remove ingredient id if it's not a number (i.e. UUID)
    if (typeof toDatabaseIngredient.id !== "number") {
      delete toDatabaseIngredient.id;
    }

    const url = isEditMode
      ? `/api/ingredients/${toDatabaseIngredient.id}`
      : "/api/ingredients";
    const method = isEditMode ? "PUT" : "POST";
    const data = /** @type {IngredientRequest} */ (toDatabaseIngredient);

    startRequest();
    handleFetchRequest(url, method, data)
      .then(() => {
        setIngredientsNeedsRefetch(true);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(endRequest);

    if (!isEditMode) {
      handleClearForm();
    }
    setIngredientsNeedsRefetch(true);
  };

  const handleIngredientDelete = () => {
    if (ingredientToEdit) {
      fetch(`/api/ingredients/${ingredientToEdit.id}`, {
        method: "DELETE",
      })
        .then((response) => {
          /** @type {Promise<IngredientResponse>} */ (response.json());
          if (response.ok) {
            setIngredientsNeedsRefetch(true);
          } else {
            console.error("Failed to remove ingredient");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      setIngredientsNeedsRefetch(true);
      handleClearForm();
    }
  };

  const handleCloseConfirmationDialog = () => {
    dispatch({ type: "SET_CONFIRMATION_DIALOG", payload: false });
  };
  //#endregion Handlers

  //#region Effects
  useEffect(() => {
    if (!ingredientToEditData) {
      dispatch({ type: "SET_INGREDIENT", payload: initializeEmptyIngredient() });
      dispatch({ type: "SET_EDIT_MODE", payload: false });
      dispatch({ type: "OPEN_FORM", payload: false });
    } else {
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredientToEditData } });
      dispatch({ type: "SET_EDIT_MODE", payload: true });
      dispatch({ type: "OPEN_FORM", payload: true });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    }
  }, [ingredientToEditData]); // Fill ingredientToEdit and set form state when ingredientToEditData changes

  useEffect(() => {
    if (!isOpen) {
      handleClearForm();
    }
  }, [isOpen, handleClearForm]); // Clear form when closing form

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_CLEAR_FORM", payload: false });
    }
  }, [needsClearForm]); // Reset needsClearForm flag after it's been used

  useEffect(() => {
    if (needsFillForm) {
      dispatch({ type: "SET_FILL_FORM", payload: false });
    }
  }, [needsFillForm]); // Reset needsFillForm flag after it's been used
  //#endregion Effects

  return (
    <div>
      <Paper>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Button onClick={() => dispatch({ type: "OPEN_FORM", payload: !isOpen })}>{isOpen ? "Close" : "Add Ingredient"}</Button>
        </Box>
        <Collapse in={isOpen}>
          <>
            <NameEdit
              ingredient={ingredientToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
            <UnitEdit
              ingredient={ingredientToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
            <NutritionEdit
              ingredient={ingredientToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
              needsFillForm={needsFillForm}
            />
            <TagEdit
              ingredient={ingredientToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />

            <Button onClick={handleClearForm}>Clear</Button>
            <Button onClick={handleIngredientAction}>{isEditMode ? "Update" : "Add"}</Button>
            {isEditMode && <Button onClick={() => dispatch({ type: "SET_CONFIRMATION_DIALOG", payload: true })}>Delete</Button>}
          </>
        </Collapse>
      </Paper>

      <Dialog
        open={openConfirmationDialog}
        onClose={handleCloseConfirmationDialog}>
        <DialogTitle>Delete Ingredient</DialogTitle>
        <DialogContent>
          <div>Are you sure you want to delete this ingredient?</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmationDialog}>Cancel</Button>
          <Button onClick={handleIngredientDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
export default IngredientForm;
