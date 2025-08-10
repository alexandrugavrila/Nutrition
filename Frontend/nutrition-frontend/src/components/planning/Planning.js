import React, { useState } from "react";
import { Button, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";

import { useData } from "../../contexts/DataContext";
import PlanningTable from "./PlanningTable";
import MacrosTable from "./MacrosTable";
import { handleFetchRequest } from "../../utils/utils";

function Planning() {
  const { meals, ingredients } = useData();

  const [duration, setDuration] = useState(1);
  const [goals, setGoals] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });
  const [plan, setPlan] = useState([[]]);
  const [mealSelections, setMealSelections] = useState([{ mealId: "", servings: 1 }]);
  const [planId, setPlanId] = useState("");

  const handleDurationChange = (event) => {
    const newDuration = parseInt(event.target.value, 10) || 1;
    setDuration(newDuration);
    setPlan((prev) => {
      const updated = [...prev];
      if (newDuration > prev.length) {
        for (let i = prev.length; i < newDuration; i++) {
          updated.push([]);
        }
      } else {
        updated.length = newDuration;
      }
      return updated;
    });
    setMealSelections((prev) => {
      const updated = [...prev];
      if (newDuration > prev.length) {
        for (let i = prev.length; i < newDuration; i++) {
          updated.push({ mealId: "", servings: 1 });
        }
      } else {
        updated.length = newDuration;
      }
      return updated;
    });
  };

  const handleGoalChange = (event) => {
    const { name, value } = event.target;
    setGoals({ ...goals, [name]: parseFloat(value) });
  };

  const handleMealSelectionChange = (index, field, value) => {
    setMealSelections((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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

  const handleAddMeal = (dayIndex) => {
    const selection = mealSelections[dayIndex];
    if (!selection.mealId) return;
    const meal = meals.find((m) => m.id === selection.mealId);
    const macros = calculateMealMacros(meal);
    const ingredient = {
      mealId: meal.id,
      name: meal.name,
      quantity: parseFloat(selection.servings) || 1,
      nutrition: macros,
    };
    setPlan((prev) => {
      const updated = [...prev];
      updated[dayIndex] = [...updated[dayIndex], ingredient];
      return updated;
    });
    setMealSelections((prev) => {
      const updated = [...prev];
      updated[dayIndex] = { mealId: "", servings: 1 };
      return updated;
    });
  };

  const handleDayPlanChange = (dayIndex, data) => {
    setPlan((prev) => {
      const updated = [...prev];
      if (Array.isArray(data)) {
        updated[dayIndex] = data;
      } else {
        updated[dayIndex] = updated[dayIndex].filter((item) => item !== data);
      }
      return updated;
    });
  };

  const buildPlanForApi = () => {
    return {
      duration,
      goals,
      days: plan.map((dayMeals, idx) => ({
        day: idx + 1,
        meals: dayMeals.map((m) => ({ meal_id: m.mealId, servings: m.quantity })),
      })),
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
        <TextField name="calories" label="Calories Goal" type="number" value={goals.calories} onChange={handleGoalChange} />
        <TextField name="protein" label="Protein Goal" type="number" value={goals.protein} onChange={handleGoalChange} />
        <TextField name="carbohydrates" label="Carbs Goal" type="number" value={goals.carbohydrates} onChange={handleGoalChange} />
        <TextField name="fat" label="Fat Goal" type="number" value={goals.fat} onChange={handleGoalChange} />
        <TextField name="fiber" label="Fiber Goal" type="number" value={goals.fiber} onChange={handleGoalChange} />
      </div>
      {plan.map((dayMeals, dayIndex) => (
        <div key={dayIndex} style={{ marginTop: "20px" }}>
          <h2>Day {dayIndex + 1}</h2>
          <FormControl style={{ minWidth: 200 }}>
            <InputLabel id={`meal-select-label-${dayIndex}`}>Meal</InputLabel>
            <Select
              labelId={`meal-select-label-${dayIndex}`}
              value={mealSelections[dayIndex].mealId}
              label="Meal"
              onChange={(e) => handleMealSelectionChange(dayIndex, "mealId", e.target.value)}>
              <MenuItem value="">
                <em>None</em>
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
          <PlanningTable ingredients={dayMeals} onIngredientRemove={(data) => handleDayPlanChange(dayIndex, data)} />
          <MacrosTable ingredients={dayMeals} goals={goals} />
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
