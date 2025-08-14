import React, { useEffect, useCallback, useReducer } from "react";
import { Button, Collapse, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

import { useData } from "../../../../contexts/DataContext";

import MealNameForm from "./MealNameForm";
import MealIngredientsForm from "./MealIngredientsForm";

const intitalState = {
  isOpen: false,
  openConfirmationDialog: false,
  isEditMode: false,
  mealToEdit: {
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
    case "SET_MEAL":
      return { ...state, mealToEdit: action.payload };
    case "SET_CLEAR_FORM":
      return { ...state, needsClearForm: action.payload };
    case "SET_FILL_FORM":
      return { ...state, needsFillForm: action.payload };
    case "SET_CONFIRMATION_DIALOG":
      return { ...state, openConfirmationDialog: action.payload };
    case "UPDATE_AMOUNT":
      const updatedIngredients = [...state.mealToEdit.ingredients];
      updatedIngredients[action.payload.index].amount = action.payload.amount;
      return { ...state, mealToEdit: { ...state.mealToEdit, ingredients: updatedIngredients } };
    default:
      return state;
  }
};

function MealForm({ mealToEditData }) {
  //#region States
  const { setMealsNeedsRefetch } = useData();
  const [state, dispatch] = useReducer(reducer, intitalState);

  const { isOpen, openConfirmationDialog, isEditMode, mealToEdit, needsClearForm, needsFillForm } = state;

  const initializeEmptyMeal = () => ({
    name: "",
    id: crypto.randomUUID(),
    ingredients: [],
    tags: [],
  });
  //#endregion States

  //#region Handlers
  const handleClearForm = useCallback(() => {
    dispatch({ type: "SET_EDIT_MODE", payload: false });
    dispatch({ type: "SET_MEAL", payload: initializeEmptyMeal() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, []);

  const handleMealAction = () => {
    dispatch({ type: "SET_FILL_FORM", payload: true });
    setMealsNeedsRefetch(true);
    handleClearForm();
  };

  const handleMealDelete = () => {
    if (mealToEdit) {
    }
    setMealsNeedsRefetch(true);
    handleClearForm();
  };

  const handleCloseConfirmationDialog = () => {
    dispatch({ type: "SET_CONFIRMATION_DIALOG", payload: false });
  };
  //#endregion Handlers

  //#region Effects
  useEffect(() => {
    if (!mealToEditData) {
      dispatch({ type: "SET_MEAL", payload: initializeEmptyMeal() });
      dispatch({ type: "SET_EDIT_MODE", payload: false });
      dispatch({ type: "OPEN_FORM", payload: false });
    } else {
      dispatch({ type: "SET_MEAL", payload: { ...mealToEditData } });
      dispatch({ type: "SET_EDIT_MODE", payload: true });
      dispatch({ type: "OPEN_FORM", payload: true });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    }
  }, [mealToEditData]); // Fill mealToEdit and set form state when mealToEditData changes

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
      dispatch({ type: "SET_Fill_FORM", payload: false });
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
          {isOpen ? "Close" : "Add Meal"}
        </Button>
        <Collapse in={isOpen}>
          <>
            <MealNameForm
              meal={mealToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
            <MealIngredientsForm
              meal={mealToEdit}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
            />
          </>

          <Button onClick={handleClearForm}>Clear</Button>
          <Button onClick={handleMealAction}>{isEditMode ? "Update" : "Add"}</Button>
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
          <Button onClick={handleMealDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default MealForm;
