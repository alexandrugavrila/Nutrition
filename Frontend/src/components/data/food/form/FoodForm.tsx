// @ts-check
import React, { useEffect, useCallback, useReducer } from "react";
import { Button, Collapse, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

import { useData } from "@/contexts/DataContext";
import { handleFetchRequest } from "@/utils/utils";

import FoodNameForm from "./FoodNameForm";
import FoodIngredientsForm from "./FoodIngredientsForm";

/**
 * @typedef {import("../../../../api-types").operations["add_food_api_foods_post"]["requestBody"]["content"]["application/json"]} FoodRequest
 * @typedef {import("../../../../api-types").operations["add_food_api_foods_post"]["responses"][201]["content"]["application/json"]} FoodResponse
 */

const intitalState = {
  isOpen: false,
  openConfirmationDialog: false,
  isEditMode: false,
  foodToEdit: {
    name: "",
    id: crypto.randomUUID(),
    ingredients: [],
    tags: [],
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
    case "SET_FOOD":
      return { ...state, foodToEdit: action.payload };
    case "SET_CLEAR_FORM":
      return { ...state, needsClearForm: action.payload };
    case "SET_FILL_FORM":
      return { ...state, needsFillForm: action.payload };
    case "SET_CONFIRMATION_DIALOG":
      return { ...state, openConfirmationDialog: action.payload };
    case "UPDATE_UNIT_QUANTITY": {
      const updatedIngredients = [...state.foodToEdit.ingredients];
      updatedIngredients[action.payload.index].unit_quantity = action.payload.unit_quantity;
      return { ...state, foodToEdit: { ...state.foodToEdit, ingredients: updatedIngredients } };
    }
    default:
      return state;
  }
};

function FoodForm({ foodToEditData }) {
  //#region States
  const { setFoodsNeedsRefetch, startRequest, endRequest } = useData();
  const [state, dispatch] = useReducer(reducer, intitalState);

  const { isOpen, openConfirmationDialog, isEditMode, foodToEdit, needsClearForm, needsFillForm } = state;

  const initializeEmptyFood = () => ({
    name: "",
    id: crypto.randomUUID(),
    ingredients: [],
    tags: [],
  });
  //#endregion States

  //#region Handlers
  const handleClearForm = useCallback(() => {
    dispatch({ type: "SET_EDIT_MODE", payload: false });
    dispatch({ type: "SET_FOOD", payload: initializeEmptyFood() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, []);

  const handleFoodAction = () => {
    startRequest();

    const toDatabaseFood = {
      name: foodToEdit.name,
      ingredients: foodToEdit.ingredients
        .filter(
          ({ ingredient_id, unit_id }) =>
            typeof ingredient_id === "number" &&
            (unit_id === null || typeof unit_id === "number")
        )
        .map(({ ingredient_id, unit_id, amount }) => ({
          ingredient_id,
          unit_id,
          unit_quantity: amount,
        })),
      tags: foodToEdit.tags
        .filter((tag) => typeof tag.id === "number")
        .map((tag) => ({ id: tag.id })),
    };

    const url = isEditMode ? `/api/foods/${foodToEdit.id}` : "/api/foods/";
    const method = isEditMode ? "PUT" : "POST";

    handleFetchRequest(url, method, /** @type {FoodRequest} */ (toDatabaseFood))
      .then(() => {
        setFoodsNeedsRefetch(true);
        if (!isEditMode) {
          handleClearForm();
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(endRequest);
  };

  const handleFoodDelete = () => {
    if (foodToEdit) {
      startRequest();
      fetch(`/api/foods/${foodToEdit.id}`, {
        method: "DELETE",
      })
        .then((response) => {
          /** @type {Promise<FoodResponse>} */ (response.json());
          if (response.ok) {
            setFoodsNeedsRefetch(true);
            handleClearForm();
          } else {
            console.error("Failed to remove food");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        })
        .finally(() => {
          endRequest();
          handleCloseConfirmationDialog();
        });
    }
  };

  const handleCloseConfirmationDialog = () => {
    dispatch({ type: "SET_CONFIRMATION_DIALOG", payload: false });
  };
  //#endregion Handlers

  //#region Effects
  useEffect(() => {
    if (!foodToEditData) {
      dispatch({ type: "SET_FOOD", payload: initializeEmptyFood() });
      dispatch({ type: "SET_EDIT_MODE", payload: false });
      dispatch({ type: "OPEN_FORM", payload: false });
    } else {
      dispatch({ type: "SET_FOOD", payload: { ...foodToEditData } });
      dispatch({ type: "SET_EDIT_MODE", payload: true });
      dispatch({ type: "OPEN_FORM", payload: true });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    }
  }, [foodToEditData]); // Fill foodToEdit and set form state when foodToEditData changes

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
        <Button
          sx={{ display: "block", mx: "auto" }}
          onClick={() => dispatch({ type: "OPEN_FORM", payload: !isOpen })}
        >
          {isOpen ? "Close" : "Add Food"}
        </Button>
        <Collapse in={isOpen}>
          <>
            <FoodNameForm
              food={foodToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
            <FoodIngredientsForm
              food={foodToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
          </>

          <Button onClick={handleClearForm}>Clear</Button>
          <Button onClick={handleFoodAction}>{isEditMode ? "Update" : "Add"}</Button>
          {isEditMode && <Button onClick={() => dispatch({ type: "SET_CONFIRMATION_DIALOG", payload: true })}>Delete</Button>}
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
          <Button onClick={handleFoodDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default FoodForm;
