import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";

import { useData } from "../../contexts/DataContext";
import { formatCellNumber } from "../../utils/utils";

function Planning() {
  const { meals, ingredients } = useData();

  const [days, setDays] = useState(1);
  const [targetMacros, setTargetMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [plan, setPlan] = useState([]); // [{ mealId, portions }]

  const [selectedMealId, setSelectedMealId] = useState("");
  const [selectedPortions, setSelectedPortions] = useState(1);

  const handleAddMeal = () => {
    if (!selectedMealId) return;
    setPlan([...plan, { mealId: selectedMealId, portions: selectedPortions }]);
    setSelectedMealId("");
    setSelectedPortions(1);
  };

  const handlePortionChange = (index, portions) => {
    const updated = [...plan];
    updated[index].portions = portions;
    setPlan(updated);
  };

  const handleRemoveMeal = (index) => {
    const updated = plan.filter((_, i) => i !== index);
    setPlan(updated);
  };

  const calculateIngredientMacros = (ingredient) => {
    const dataIngredient = ingredients.find((i) => i.id === ingredient.ingredient_id);
    if (!dataIngredient) {
      return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    }
    const unit =
      dataIngredient.units.find((u) => u.id === ingredient.unit_id) || dataIngredient.units[0];
    const grams = unit ? unit.grams : 0;
    return {
      calories: (dataIngredient.nutrition.calories || 0) * grams * ingredient.amount,
      protein: (dataIngredient.nutrition.protein || 0) * grams * ingredient.amount,
      fat: (dataIngredient.nutrition.fat || 0) * grams * ingredient.amount,
      carbs: (dataIngredient.nutrition.carbohydrates || 0) * grams * ingredient.amount,
      fiber: (dataIngredient.nutrition.fiber || 0) * grams * ingredient.amount,
    };
  };

  const calculateMealMacros = (meal) => {
    if (!meal) return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    return meal.ingredients.reduce(
      (totals, ingredient) => {
        const macros = calculateIngredientMacros(ingredient);
        totals.calories += macros.calories;
        totals.protein += macros.protein;
        totals.fat += macros.fat;
        totals.carbs += macros.carbs;
        totals.fiber += macros.fiber;
        return totals;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  };

  const totalMacros = useMemo(() => {
    return plan.reduce(
      (totals, item) => {
        const meal = meals.find((m) => m.id === item.mealId);
        const macros = calculateMealMacros(meal);
        totals.calories += macros.calories * item.portions;
        totals.protein += macros.protein * item.portions;
        totals.fat += macros.fat * item.portions;
        totals.carbs += macros.carbs * item.portions;
        totals.fiber += macros.fiber * item.portions;
        return totals;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  }, [plan, meals, ingredients]);

  const perDayMacros = useMemo(() => {
    if (days <= 0) {
      return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    }
    return {
      calories: totalMacros.calories / days,
      protein: totalMacros.protein / days,
      fat: totalMacros.fat / days,
      carbs: totalMacros.carbs / days,
      fiber: totalMacros.fiber / days,
    };
  }, [totalMacros, days]);

  return (
    <Box sx={{ p: 2 }}>
      <h1>Planning</h1>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <TextField
          type="number"
          label="Days"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
          sx={{ width: 100 }}
        />
        {Object.keys(targetMacros).map((macro) => (
          <TextField
            key={macro}
            type="number"
            label={`Target ${macro}`}
            value={targetMacros[macro]}
            onChange={(e) =>
              setTargetMacros({
                ...targetMacros,
                [macro]: parseFloat(e.target.value) || 0,
              })
            }
          />
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
        <TextField
          select
          label="Meal"
          value={selectedMealId}
          onChange={(e) => setSelectedMealId(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {meals.map((meal) => (
            <MenuItem key={meal.id} value={meal.id}>
              {meal.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          label="Portions"
          value={selectedPortions}
          onChange={(e) => setSelectedPortions(parseFloat(e.target.value) || 1)}
          sx={{ width: 100 }}
        />
        <Button variant="contained" onClick={handleAddMeal} disabled={!selectedMealId}>
          Add Meal
        </Button>
      </Box>

      <Table component={Paper} sx={{ mb: 3 }}>
        <TableHead>
          <TableRow>
            <TableCell>Meal</TableCell>
            <TableCell>Portions</TableCell>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plan.map((item, index) => {
            const meal = meals.find((m) => m.id === item.mealId);
            const macros = calculateMealMacros(meal);
            return (
              <TableRow key={`${item.mealId}-${index}`}>
                <TableCell>{meal ? meal.name : ""}</TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={item.portions}
                    onChange={(e) =>
                      handlePortionChange(index, parseFloat(e.target.value) || 0)
                    }
                    sx={{ width: 80 }}
                  />
                </TableCell>
                <TableCell>
                  {formatCellNumber(macros.calories * item.portions)}
                </TableCell>
                <TableCell>
                  {formatCellNumber(macros.protein * item.portions)}
                </TableCell>
                <TableCell>
                  {formatCellNumber(macros.carbs * item.portions)}
                </TableCell>
                <TableCell>
                  {formatCellNumber(macros.fat * item.portions)}
                </TableCell>
                <TableCell>
                  {formatCellNumber(macros.fiber * item.portions)}
                </TableCell>
                <TableCell>
                  <Button color="error" onClick={() => handleRemoveMeal(index)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Box>
        <h2>Summary</h2>
        <Table component={Paper}>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>Calories</TableCell>
              <TableCell>Protein</TableCell>
              <TableCell>Carbs</TableCell>
              <TableCell>Fat</TableCell>
              <TableCell>Fiber</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell>{formatCellNumber(totalMacros.calories)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.protein)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.carbs)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fat)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fiber)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Per Day</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.calories)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.protein)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.carbs)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.fat)}</TableCell>
              <TableCell>{formatCellNumber(perDayMacros.fiber)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>{targetMacros.calories}</TableCell>
              <TableCell>{targetMacros.protein}</TableCell>
              <TableCell>{targetMacros.carbs}</TableCell>
              <TableCell>{targetMacros.fat}</TableCell>
              <TableCell>{targetMacros.fiber}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

export default Planning;
