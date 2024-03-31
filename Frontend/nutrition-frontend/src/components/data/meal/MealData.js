import React, { useState } from "react";

import MealTable from "./MealTable";
import MealForm from "./form/MealForm";

function MealData() {
  const [editingMeal, setEditingMeal] = useState(null);

  const handleAddMealToEdit = (mealToEdit) => {
    setEditingMeal(null);
    setEditingMeal(mealToEdit);
  };

  return (
    <div>
      <MealForm mealToEditData={editingMeal} />
      <MealTable onMealCtrlClick={handleAddMealToEdit} />
    </div>
  );
}

export default MealData;
