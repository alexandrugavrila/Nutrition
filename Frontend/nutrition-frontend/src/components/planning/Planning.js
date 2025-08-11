import React, { useState } from "react";
import { Button, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";

import { useData } from "../../contexts/DataContext";
import PlanningTable from "./PlanningTable";
import MacrosTable from "./MacrosTable";
import { handleFetchRequest } from "../../utils/utils";

function Planning() {
  const { meals, ingredients } = useData();

  const [duration, setDuration] = useState(1);
  const [targets, setTargets] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });
  const [plan, setPlan] = useState([]);
  const [mealSelection, setMealSelection] = useState({ mealId: "", servings: 1 });
  const [planId, setPlanId] = useState("");

  const handleDurationChange = (event) => {
    const newDuration = parseInt(event.target.value, 10) || 1;
    setDuration(newDuration);
  };

  const handleTargetChange = (event) => {
    const { name, value } = event.target;
    setTargets({ ...targets, [name]: parseFloat(value) });
  };

  const handleMealSelectionChange = (field, value) => {
    setMealSelection((prev) => ({ ...prev, [field]: value }));
  };

  const calculateMealMacros = (meal) => {
    if (!meal) return { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };

    const totals = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 };
    meal.ingredients.forEach((ing) => {
      const dataIngredient = ingredients.find((i) => i.id === ing.ingredient_id);
      if (!dataIngredient) return;
      const unit = dataIngredient.units.find((u) => u.id === ing.unit_id) || dataIngredient.units[0];
      totals.calories += (dataIngredient.nutrition.calories || 0) * unit.grams * ing.amount;
      totals.protein += (dataIngredient.nutrition.protein || 0) * unit.grams * ing.amount;
      totals.carbohydrates += (dataIngredient.nutrition.carbohydrates || 0) * unit.grams * ing.amount;
      totals.fat += (dataIngredient.nutrition.fat || 0) * unit.grams * ing.amount;
      totals.fiber += (dataIngredient.nutrition.fiber || 0) * unit.grams * ing.amount;
    });
    return totals;
  };

  const handleAddMeal = () => {
    if (!mealSelection.mealId) return;
    const meal = meals.find((m) => m.id === mealSelection.mealId);
    const macros = calculateMealMacros(meal);
    const planMeal = {
      mealId: meal.id,
      name: meal.name,
      quantity: parseFloat(mealSelection.servings) || 1,
      nutrition: macros,
    };
    setPlan((prev) => {
      const updated = [...prev];
      updated[dayIndex] = [...updated[dayIndex], planMeal];
      return updated;
    });
    setMealSelections((prev) => {
      const updated = [...prev];
      updated[dayIndex] = { mealId: "", servings: 1 };
      return updated;
    });
  };

  const handleDayPlanChange = (dayIndex, updatedMeals) => {
    setPlan((prev) => {
      const updated = [...prev];
      updated[dayIndex] = updatedMeals;
      return updated;

    });
  };

  const buildPlanForApi = () => {
    return {
      duration,
      targets,
      meals: plan.map((m) => ({ meal_id: m.mealId, servings: m.quantity })),
    };
  };

  const handleSavePlan = () => {
    const url = "http://localhost:5000/planning";
    handleFetchRequest(url, "POST", buildPlanForApi());
  };

  const handleUpdatePlan = () => {
    if (!planId) return;
    const url = `http://localhost:5000/planning/${planId}`;
    handleFetchRequest(url, "PUT", buildPlanForApi());
  };

  return (
    <div>
      <h1>Planning</h1>
      <div>
        <TextField
          label="Plan Duration (days)"
          type="number"
          value={duration}
          onChange={handleDurationChange}
          InputProps={{ inputProps: { min: 1 } }}
        />
      </div>
      <div>
        <TextField name="calories" label="Calories Target" type="number" value={targets.calories} onChange={handleTargetChange} />
        <TextField name="protein" label="Protein Target" type="number" value={targets.protein} onChange={handleTargetChange} />
        <TextField name="carbohydrates" label="Carbs Target" type="number" value={targets.carbohydrates} onChange={handleTargetChange} />
        <TextField name="fat" label="Fat Target" type="number" value={targets.fat} onChange={handleTargetChange} />
        <TextField name="fiber" label="Fiber Target" type="number" value={targets.fiber} onChange={handleTargetChange} />
      </div>
      <div style={{ marginTop: "20px" }}>
        <FormControl style={{ minWidth: 200 }}>
          <InputLabel id="meal-select-label">Meal</InputLabel>
          <Select
            labelId="meal-select-label"
            value={mealSelection.mealId}
            label="Meal"
            onChange={(e) => handleMealSelectionChange("mealId", e.target.value)}>
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {meals.map((meal) => (
              <MenuItem key={meal.id} value={meal.id}>
                {meal.name}
              </MenuItem>
              {meals.map((meal) => (
                <MenuItem key={meal.id} value={meal.id}>
                  {meal.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="number"
            label="Servings"
            value={mealSelections[dayIndex].servings}
            onChange={(e) => handleMealSelectionChange(dayIndex, "servings", e.target.value)}
            InputProps={{ inputProps: { min: 1 } }}
            style={{ marginLeft: "10px" }}
          />
          <Button style={{ marginLeft: "10px" }} variant="contained" onClick={() => handleAddMeal(dayIndex)}>
            Add Meal
          </Button>
          <PlanningTable meals={dayMeals} onPlanChange={(data) => handleDayPlanChange(dayIndex, data)} />
          <MacrosTable meals={dayMeals} targets={targets} />
        </div>
      ))}
      <div style={{ marginTop: "20px" }}>
        <TextField label="Plan ID" value={planId} onChange={(e) => setPlanId(e.target.value)} />
        <Button variant="contained" style={{ marginLeft: "10px" }} onClick={handleSavePlan}>
          Save Plan
        </Button>
        <Button variant="contained" style={{ marginLeft: "10px" }} onClick={handleUpdatePlan} disabled={!planId}>
          Update Plan
        </Button>
      </div>
    </div>
  );
}

export default Planning;
