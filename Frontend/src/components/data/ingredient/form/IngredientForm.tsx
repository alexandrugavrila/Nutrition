import React, { useEffect, useCallback, useRef, useState } from "react";
import { Button, Collapse, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Box } from "@mui/material";

import NameEdit from "./NameEdit";
import UnitEdit from "./UnitEdit";
import NutritionEdit from "./NutritionEdit";
import TagEdit from "./TagEdit";
import { useIngredientForm } from "./useIngredientForm";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import type { components } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];

type IngredientFormProps = {
  ingredientToEditData?: IngredientRead | null;
};

function IngredientForm({ ingredientToEditData }: IngredientFormProps) {
  const [isOpen, setIsOpen] = useSessionStorageState("ingredient-form-open", false);
  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);
  const isInitialRenderRef = useRef(true);
  const previousIsOpenRef = useRef(isOpen);
  const [isEditMode, setIsEditMode] = useSessionStorageState("ingredient-form-edit-mode", false);

  const {
    ingredient,
    dispatch,
    needsClearForm,
    needsFillForm,
    loadIngredient,
    clearForm,
    acknowledgeClearFlag,
    acknowledgeFillFlag,
    save,
    remove,
  } = useIngredientForm();

  const handleClearForm = useCallback(() => {
    clearForm();
    setIsEditMode(false);
    setOpenConfirmationDialog(false);
  }, [clearForm, setIsEditMode, setOpenConfirmationDialog]);

  const handleIngredientAction = useCallback(() => {
    save({
      mode: isEditMode ? "edit" : "add",
      onSaved: () => {
        if (!isEditMode) {
          setIsEditMode(false);
        }
      },
    });
  }, [isEditMode, save]);

  const handleIngredientDelete = useCallback(() => {
    remove({
      onDeleted: () => {
        handleClearForm();
        setOpenConfirmationDialog(false);
      },
    });
  }, [remove, handleClearForm]);

  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      if (!ingredientToEditData) {
        return;
      }
    }

    if (!ingredientToEditData) {
      loadIngredient(null);
      setIsEditMode(false);
      setIsOpen(false);
    } else {
      loadIngredient(ingredientToEditData);
      setIsEditMode(true);
      setIsOpen(true);
    }
  }, [ingredientToEditData, loadIngredient, setIsOpen, setIsEditMode]);

  useEffect(() => {
    if (previousIsOpenRef.current && !isOpen) {
      handleClearForm();
    }
    previousIsOpenRef.current = isOpen;
  }, [isOpen, handleClearForm]);

  useEffect(() => {
    if (needsClearForm) acknowledgeClearFlag();
  }, [needsClearForm, acknowledgeClearFlag]);

  useEffect(() => {
    if (needsFillForm) acknowledgeFillFlag();
  }, [needsFillForm, acknowledgeFillFlag]);

  return (
    <div>
      <Paper>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Button onClick={() => setIsOpen((prev) => !prev)}>{isOpen ? "Close" : "Add Ingredient"}</Button>
        </Box>
        <Collapse in={isOpen}>
          <>
            <NameEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />
            <UnitEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />
            <NutritionEdit
              ingredient={ingredient}
              dispatch={dispatch}
              needsClearForm={needsClearForm}
              needsFillForm={needsFillForm}
            />
            <TagEdit ingredient={ingredient} dispatch={dispatch} needsClearForm={needsClearForm} />

            <Button onClick={handleClearForm}>Clear</Button>
            <Button onClick={handleIngredientAction}>
              {isEditMode ? "Update" : "Add"}
            </Button>
            {isEditMode && (
              <Button onClick={() => setOpenConfirmationDialog(true)}>Delete</Button>
            )}
          </>
        </Collapse>
      </Paper>

      <Dialog
        open={openConfirmationDialog}
        onClose={() => setOpenConfirmationDialog(false)}>
        <DialogTitle>Delete Ingredient</DialogTitle>
        <DialogContent>
          <div>Are you sure you want to delete this ingredient?</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmationDialog(false)}>Cancel</Button>
          <Button onClick={handleIngredientDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
export default IngredientForm;

