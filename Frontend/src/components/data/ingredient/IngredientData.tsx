import React, { useState } from "react";

import IngredientTable from "./IngredientTable";
import IngredientForm from "./form/IngredientForm";
import type { IngredientRead } from "@/utils/nutrition";

type IngredientDataProps = {
  handleAddIngredientToPlan?: (ingredient: IngredientRead) => void;
};

function IngredientData({ handleAddIngredientToPlan }: IngredientDataProps) {
  const [editingIngredient, setEditingIngredient] = useState(null);

  const handleAddIngredientToEdit = (ingredientToEdit) => {
    setEditingIngredient(null);
    setEditingIngredient(ingredientToEdit);
  };

  return (
    <div>
      <IngredientForm ingredientToEditData={editingIngredient} />
      <IngredientTable
        onIngredientDoubleClick={handleAddIngredientToPlan}
        onIngredientCtrlClick={handleAddIngredientToEdit}
      />
    </div>
  );
}

export default IngredientData;
