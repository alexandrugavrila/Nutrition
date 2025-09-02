import React, { useState } from "react";

import FoodTable from "./FoodTable";
import FoodForm from "./form/FoodForm";

function FoodData() {
  const [editingFood, setEditingFood] = useState(null);

  const handleAddFoodToEdit = (foodToEdit) => {
    setEditingFood(null);
    setEditingFood(foodToEdit);
  };

  return (
    <div>
      <FoodForm foodToEditData={editingFood} />
      <FoodTable onFoodCtrlClick={handleAddFoodToEdit} />
    </div>
  );
}

export default FoodData;
