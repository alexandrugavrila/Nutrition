import React, { useState } from "react";
import PropTypes from "prop-types";

import IngredientTable from "./IngredientTable";
import IngredientForm from "./form/IngredientForm";

function IngredientData({ handleAddIngredientToPlan }) {
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

IngredientData.propTypes = {
  handleAddIngredientToPlan: PropTypes.func.isRequired,
};
