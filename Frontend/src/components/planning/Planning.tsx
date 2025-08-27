import React, { useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Collapse,
  Typography,
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowRight } from "@mui/icons-material";

import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";

function Planning() {
  const { meals, ingredients } = useData();

  const [days, setDays] = useState(1);
  const [daysError, setDaysError] = useState(false);
  const [targetMacros, setTargetMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [plan, setPlan] = useState([]); // [{type:'meal', mealId, portions} or {type:'ingredient', ingredientId, unitId, amount}]

  const [selectedType, setSelectedType] = useState("meal");
  const [selectedMealId, setSelectedMealId] = useState("");
  const [selectedPortions, setSelectedPortions] = useState(1);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [selectedIngredientUnitId, setSelectedIngredientUnitId] = useState(0);
  const [selectedIngredientAmount, setSelectedIngredientAmount] = useState(1);
  const [open, setOpen] = useState({});

  const handleAddItem = () => {
    if (selectedType === "meal") {
      if (!selectedMealId || selectedPortions <= 0) return;
      const existingIndex = plan.findIndex(
        (p) => p.type === "meal" && p.mealId === selectedMealId
      );
      if (existingIndex >= 0) {
        const updated = [...plan];
        updated[existingIndex].portions += selectedPortions;
        setPlan(updated);
      } else {
        setPlan([
          ...plan,
          { type: "meal", mealId: selectedMealId, portions: selectedPortions },
        ]);
      }
      setSelectedMealId("");
      setSelectedPortions(1);
    } else {
      if (!selectedIngredientId || selectedIngredientAmount <= 0) return;
      setPlan([
        ...plan,
        {
          type: "ingredient",
          ingredientId: selectedIngredientId,
          unitId: selectedIngredientUnitId,
          amount: selectedIngredientAmount,
        },
      ]);
      setSelectedIngredientId("");
      setSelectedIngredientUnitId(0);
      setSelectedIngredientAmount(1);
    }
  };

  const handleQuantityChange = (index, value) => {
    if (value <= 0) return;
    const updated = [...plan];
    if (updated[index].type === "meal") {
      updated[index].portions = value;
    } else {
      updated[index].amount = value;
    }
    setPlan(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = plan.filter((_, i) => i !== index);
    setPlan(updated);
  };

  const calculateIngredientMacros = useCallback((ingredient) => {
    const dataIngredient = ingredients.find((i) => i.id === ingredient.ingredient_id);
    if (!dataIngredient) {
      return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    }
    const unit =
      dataIngredient.units.find((u) => u.id === ingredient.unit_id) || dataIngredient.units[0];
    const grams = unit ? unit.grams : 0;
    return {
      calories: (dataIngredient.nutrition.calories || 0) * grams * ingredient.unit_quantity,
      protein: (dataIngredient.nutrition.protein || 0) * grams * ingredient.unit_quantity,
      fat: (dataIngredient.nutrition.fat || 0) * grams * ingredient.unit_quantity,
      carbs: (dataIngredient.nutrition.carbohydrates || 0) * grams * ingredient.unit_quantity,
      fiber: (dataIngredient.nutrition.fiber || 0) * grams * ingredient.unit_quantity,
    };
  }, [ingredients]);

  const calculateMealMacros = useCallback((meal) => {
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
  }, [calculateIngredientMacros]);

  const calculateItemMacros = useCallback((item) => {
    if (item.type === "meal") {
      const meal = meals.find((m) => m.id === item.mealId);
      const macros = calculateMealMacros(meal);
      return {
        calories: macros.calories * item.portions,
        protein: macros.protein * item.portions,
        fat: macros.fat * item.portions,
        carbs: macros.carbs * item.portions,
        fiber: macros.fiber * item.portions,
      };
    }
    return calculateIngredientMacros({
      ingredient_id: item.ingredientId,
      unit_id: item.unitId,
      unit_quantity: item.amount,
    });
  }, [meals, calculateMealMacros, calculateIngredientMacros]);

  const totalMacros = useMemo(() => {
    return plan.reduce(
      (totals, item) => {
        const macros = calculateItemMacros(item);
        totals.calories += macros.calories;
        totals.protein += macros.protein;
        totals.fat += macros.fat;
        totals.carbs += macros.carbs;
        totals.fiber += macros.fiber;
        return totals;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  }, [plan, calculateItemMacros]);

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

  const handleDaysChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!value || value < 1) {
      setDays(1);
      setDaysError(true);
    } else {
      setDays(value);
      setDaysError(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <h1>Planning</h1>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <TextField
          type="number"
          label="Days"
          value={days}
          onChange={handleDaysChange}
          sx={{ width: 100 }}
          error={daysError}
          helperText={daysError ? "Days must be at least 1" : ""}
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
          label="Type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="meal">Meal</MenuItem>
          <MenuItem value="ingredient">Ingredient</MenuItem>
        </TextField>
        {selectedType === "meal" ? (
          <>
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
              onChange={(e) =>
                setSelectedPortions(parseFloat(e.target.value) || 0)
              }
              sx={{ width: 100 }}
              error={selectedPortions <= 0}
              helperText={
                selectedPortions <= 0 ? "Portions must be greater than 0" : ""
              }
            />
          </>
        ) : (
          <>
            <TextField
              select
              label="Ingredient"
              value={selectedIngredientId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedIngredientId(id);
                const ing = ingredients.find((i) => i.id === id);
                setSelectedIngredientUnitId(ing?.units[0]?.id || 0);
              }}
              sx={{ minWidth: 200 }}
            >
              {ingredients.map((ingredient) => (
                <MenuItem key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Unit"
              value={selectedIngredientUnitId}
              onChange={(e) =>
                setSelectedIngredientUnitId(parseInt(e.target.value, 10))
              }
              sx={{ minWidth: 120 }}
            >
              {(ingredients.find((i) => i.id === selectedIngredientId)?.units || []).map(
                (unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </MenuItem>
                )
              )}
            </TextField>
            <TextField
              type="number"
              label="Amount"
              value={selectedIngredientAmount}
              onChange={(e) =>
                setSelectedIngredientAmount(
                  parseFloat(e.target.value) || 0
                )
              }
              sx={{ width: 100 }}
              error={selectedIngredientAmount <= 0}
              helperText={
                selectedIngredientAmount <= 0
                  ? "Amount must be greater than 0"
                  : ""
              }
            />
          </>
        )}
        <Button
          variant="contained"
          onClick={handleAddItem}
          disabled={
            selectedType === "meal"
              ? !selectedMealId || selectedPortions <= 0
              : !selectedIngredientId || selectedIngredientAmount <= 0
          }
        >
          Add
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Amount</TableCell>
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
            if (item.type === "meal") {
              const meal = meals.find((m) => m.id === item.mealId);
              const macros = calculateMealMacros(meal);
              return (
                <React.Fragment key={`meal-${item.mealId}`}>
                  <TableRow>
                    <TableCell onClick={() => setOpen({ ...open, [index]: !open[index] })}>
                      {open[index] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                    </TableCell>
                    <TableCell>{meal ? meal.name : ""}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.portions}
                        onChange={(e) =>
                          handleQuantityChange(index, parseFloat(e.target.value) || 0)
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
                      <Button color="error" onClick={() => handleRemoveItem(index)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                      <Collapse in={open[index]} timeout="auto" unmountOnExit>
                        <Typography variant="h6" gutterBottom component="div">
                          Ingredients
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Unit</TableCell>
                              <TableCell>Amount</TableCell>
                              <TableCell>Calories</TableCell>
                              <TableCell>Protein</TableCell>
                              <TableCell>Carbs</TableCell>
                              <TableCell>Fat</TableCell>
                              <TableCell>Fiber</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {meal?.ingredients.map((ingredient) => {
                              const dataIngredient = ingredients.find(
                                (i) => i.id === ingredient.ingredient_id
                              );
                              const unit =
                                dataIngredient?.units.find(
                                  (u) => u.id === ingredient.unit_id
                                ) || dataIngredient?.units[0];
                              const ingMacros = calculateIngredientMacros(ingredient);
                              return (
                                <TableRow key={ingredient.ingredient_id}>
                                  <TableCell>
                                    {dataIngredient ? dataIngredient.name : ""}
                                  </TableCell>
                                  <TableCell>{unit ? unit.name : ""}</TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingredient.unit_quantity * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.calories * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.protein * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.carbs * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.fat * item.portions)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingMacros.fiber * item.portions)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            } else {
              const ingredient = ingredients.find(
                (i) => i.id === item.ingredientId
              );
              const unit = ingredient?.units.find((u) => u.id === item.unitId);
              const macros = calculateIngredientMacros({
                ingredient_id: item.ingredientId,
                unit_id: item.unitId,
                unit_quantity: item.amount,
              });
              return (
                <TableRow key={`ingredient-${index}`}>
                  <TableCell />
                  <TableCell>
                    {ingredient ? ingredient.name : ""}
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.amount}
                      onChange={(e) =>
                        handleQuantityChange(index, parseFloat(e.target.value) || 0)
                      }
                      sx={{ width: 80 }}
                    /> {unit ? unit.name : ""}
                  </TableCell>
                  <TableCell>{formatCellNumber(macros.calories)}</TableCell>
                  <TableCell>{formatCellNumber(macros.protein)}</TableCell>
                  <TableCell>{formatCellNumber(macros.carbs)}</TableCell>
                  <TableCell>{formatCellNumber(macros.fat)}</TableCell>
                  <TableCell>{formatCellNumber(macros.fiber)}</TableCell>
                  <TableCell>
                    <Button color="error" onClick={() => handleRemoveItem(index)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }
          })}
        </TableBody>
        </Table>
      </TableContainer>

      <Box>
        <h2>Summary</h2>
        <TableContainer component={Paper}>
          <Table>
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
        </TableContainer>
      </Box>
    </Box>
  );
}

export default Planning;
