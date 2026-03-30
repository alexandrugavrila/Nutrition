import React, { useState } from "react";
import { Box, Button } from "@mui/material";

import IngredientTable from "./IngredientTable";
import IngredientModal from "@/components/common/IngredientModal";
import type { IngredientRead } from "@/utils/nutrition";

type IngredientDataProps = {
  handleAddIngredientToPlan?: (ingredient: IngredientRead) => void;
};

function IngredientData({ handleAddIngredientToPlan }: IngredientDataProps) {
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editorIngredient, setEditorIngredient] = useState<IngredientRead | null>(null);
  const [ingredientModalMode, setIngredientModalMode] = useState<"add" | "edit">("add");

  const handleOpenAddIngredient = () => {
    setIngredientModalMode("add");
    setEditorIngredient(null);
    setIngredientModalOpen(true);
  };

  const handleOpenIngredientToEdit = (ingredientToEdit: IngredientRead) => {
    setIngredientModalMode("edit");
    setEditorIngredient(ingredientToEdit);
    setIngredientModalOpen(true);
  };

  const handleCloseIngredientModal = () => {
    setIngredientModalOpen(false);
    setEditorIngredient(null);
  };

  return (
    <div>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <Button variant="contained" onClick={handleOpenAddIngredient}>
          Add Ingredient
        </Button>
      </Box>
      <IngredientTable
        onIngredientDoubleClick={handleAddIngredientToPlan}
        onIngredientCtrlClick={handleOpenIngredientToEdit}
      />
      <IngredientModal
        open={ingredientModalOpen}
        mode={ingredientModalMode}
        ingredient={editorIngredient}
        onClose={handleCloseIngredientModal}
      />
    </div>
  );
}

export default IngredientData;
