// @ts-check
import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { Button, Collapse, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import SaveStatusChip from "@/components/common/SaveStatusChip";
import { useSessionStorageReducer } from "@/hooks/useSessionStorageState";

import { useData } from "@/contexts/DataContext";
import { handleFetchRequest } from "@/utils/utils";
import apiClient from "@/apiClient";

import FoodNameForm from "./FoodNameForm";
import FoodIngredientsForm from "./FoodIngredientsForm";

/**
 * @typedef {import("../../../../api-types").operations["add_food_api_foods_post"]["requestBody"]["content"]["application/json"]} FoodRequest
 * @typedef {import("../../../../api-types").operations["add_food_api_foods_post"]["responses"][201]["content"]["application/json"]} FoodResponse
 */

const createEmptyFood = () => ({
  name: "",
  id: crypto.randomUUID(),
  ingredients: [],
  tags: [],
});

const createInitialState = () => ({
  isOpen: false,
  openConfirmationDialog: false,
  isEditMode: false,
  foodToEdit: createEmptyFood(),
  needsClearForm: false,
  needsFillForm: false,
});

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
  const [state, dispatch] = useSessionStorageReducer(reducer, createInitialState, "food-form-state-v1");

  const { isOpen, openConfirmationDialog, isEditMode, foodToEdit, needsClearForm, needsFillForm } = state;
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef(/** @type {any} */ (null));
  const isInitialRenderRef = useRef(true);
  const previousIsOpenRef = useRef(isOpen);

  const hasContent = useMemo(() => {
    const hasName = (foodToEdit?.name || "").trim().length > 0;
    const hasIngredients = Array.isArray(foodToEdit?.ingredients) && foodToEdit.ingredients.length > 0;
    return hasName || hasIngredients;
  }, [foodToEdit]);

  //#endregion States

  //#region Handlers
  const handleClearForm = useCallback(() => {
    dispatch({ type: "SET_EDIT_MODE", payload: false });
    dispatch({ type: "SET_FOOD", payload: createEmptyFood() });
    dispatch({ type: "SET_CLEAR_FORM", payload: true });
  }, [dispatch]);

  const handleFoodAction = () => {
    startRequest();

    const toDatabaseFood = buildFoodPayload(foodToEdit);

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

  const buildFoodPayload = (food) => ({
    name: food.name,
    ingredients: food.ingredients
      .filter(({ ingredient_id, unit_id }) => typeof ingredient_id === "number" && (unit_id === null || typeof unit_id === "number"))
      .map(({ ingredient_id, unit_id, unit_quantity }) => ({
        ingredient_id,
        // Normalize synthetic 1g selection (id 0) to null for DB
        unit_id: unit_id === 0 ? null : unit_id,
        unit_quantity,
      })),
    tags: (food.tags || [])
      .filter((tag) => typeof tag.id === "number")
      .map((tag) => ({ id: tag.id })),
  });

  // Debounced autosave for edit mode only
  useEffect(() => {
    if (!isOpen) return;
    if (!isEditMode) return; // avoid creating drafts implicitly for new foods
    if (!hasContent) return; // nothing meaningful to save
    if (typeof foodToEdit.id !== "number") return; // need a persisted id

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      startRequest();
      try {
        const payload = buildFoodPayload(foodToEdit);
        await apiClient
          .path("/api/foods/{food_id}")
          .method("put")
          .create()({ path: { food_id: foodToEdit.id }, body: payload });
        setFoodsNeedsRefetch(true);
      } catch (e) {
        console.error("Autosave error:", e);
      } finally {
        endRequest();
        setIsSaving(false);
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    foodToEdit,
    isOpen,
    isEditMode,
    hasContent,
    startRequest,
    endRequest,
    setFoodsNeedsRefetch,
  ]);

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
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      if (!foodToEditData) {
        return;
      }
    }

    if (!foodToEditData) {
      dispatch({ type: "SET_FOOD", payload: createEmptyFood() });
      dispatch({ type: "SET_EDIT_MODE", payload: false });
      dispatch({ type: "OPEN_FORM", payload: false });
    } else {
      dispatch({ type: "SET_FOOD", payload: { ...foodToEditData } });
      dispatch({ type: "SET_EDIT_MODE", payload: true });
      dispatch({ type: "OPEN_FORM", payload: true });
      dispatch({ type: "SET_FILL_FORM", payload: true });
    }
  }, [foodToEditData, dispatch]); // Fill foodToEdit and set form state when foodToEditData changes

  useEffect(() => {
    if (previousIsOpenRef.current && !isOpen) {
      handleClearForm();
    }
    previousIsOpenRef.current = isOpen;
  }, [isOpen, handleClearForm]); // Clear form when closing form

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_CLEAR_FORM", payload: false });
    }
  }, [needsClearForm, dispatch]); // Reset needsClearForm flag after it's been used

  useEffect(() => {
    if (needsFillForm) {
      dispatch({ type: "SET_FILL_FORM", payload: false });
    }
  }, [needsFillForm, dispatch]); // Reset needsFillForm flag after it's been used
  //#endregion Effects

  return (
    <div>
      <Paper sx={{ position: "relative" }}>
        <SaveStatusChip show={isOpen && isEditMode && hasContent} saving={isSaving} />
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

