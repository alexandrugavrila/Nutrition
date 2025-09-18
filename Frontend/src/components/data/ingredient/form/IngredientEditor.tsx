import React, { useEffect } from "react";
import { Box, Button, Divider } from "@mui/material";

import NameEdit from "./NameEdit";
import UnitEdit from "./UnitEdit";
import NutritionEdit from "./NutritionEdit";
import TagEdit from "./TagEdit";
import { useIngredientForm } from "./useIngredientForm";
import type { components } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];

type IngredientEditorProps = {
  mode: "add" | "edit";
  initial?: IngredientRead | null;
  onSaved?: () => void;
  onDeleted?: () => void;
};

/**
 * A focused Ingredient editor meant for embedding in a Drawer/Modal.
 * Reuses the same sub-editors as the collapsible IngredientForm, but
 * leaves layout and open/close to the parent.
 */
function IngredientEditor({ mode, initial = null, onSaved, onDeleted }: IngredientEditorProps) {
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

  useEffect(() => {
    loadIngredient(initial ?? null);
  }, [initial, loadIngredient]);

  useEffect(() => {
    if (needsClearForm) acknowledgeClearFlag();
  }, [needsClearForm, acknowledgeClearFlag]);

  useEffect(() => {
    if (needsFillForm) acknowledgeFillFlag();
  }, [needsFillForm, acknowledgeFillFlag]);

  const handleSave = () => {
    save({ mode, onSaved });
  };

  const handleDelete = () => {
    if (mode !== "edit") return;
    remove({ onDeleted });
  };

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
        <Button onClick={clearForm}>Clear</Button>
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
