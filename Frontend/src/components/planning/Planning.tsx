import React, { useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  IconButton,
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
import { KeyboardArrowDown, KeyboardArrowRight, Add, Remove } from "@mui/icons-material";

import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";

// Plan item types
type FoodOverride = {
  unitId: number;
  quantity: number; // quantity in selected unit per portion
};

type FoodPlanItem = {
  type: "food";
  foodId: string;
  portions: number;
  overrides: Record<string, FoodOverride>; // ingredientId -> override
};

type IngredientPlanItem = {
  type: "ingredient";
  ingredientId: string;
  unitId: number;
  amount: number;
};

type PlanItem = FoodPlanItem | IngredientPlanItem;

function Planning() {
  const { foods, ingredients } = useData();

  const [days, setDays] = useState(1);
  const [daysError, setDaysError] = useState(false);
  const [targetMacros, setTargetMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [plan, setPlan] = useState<PlanItem[]>([]); // FoodPlanItem or IngredientPlanItem

  const [selectedType, setSelectedType] = useState("food");
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [selectedPortions, setSelectedPortions] = useState(1);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [selectedIngredientUnitId, setSelectedIngredientUnitId] = useState(0);
  const [selectedIngredientAmount, setSelectedIngredientAmount] = useState(1);
  const [open, setOpen] = useState({});

  const handleAddItem = () => {
    if (selectedType === "food") {
      if (!selectedFoodId || selectedPortions <= 0) return;
      const existingIndex = plan.findIndex(
        (p) => p.type === "food" && p.foodId === selectedFoodId
      );
      if (existingIndex >= 0) {
        const updated = [...plan];
        const existing = updated[existingIndex] as FoodPlanItem;
        updated[existingIndex] = {
          ...existing,
          portions: existing.portions + selectedPortions,
        };
        setPlan(updated);
      } else {
        // Build default overrides from the selected food's ingredients
        const food = foods.find((f) => f.id === selectedFoodId);
        const overrides: Record<string, FoodOverride> = {};
        food?.ingredients.forEach((ing) => {
          overrides[ing.ingredient_id] = {
            unitId: ing.unit_id,
            quantity: ing.unit_quantity ?? 0,
          };
        });
        const newItem: FoodPlanItem = {
          type: "food",
          foodId: selectedFoodId,
          portions: selectedPortions,
          overrides,
        };
        setPlan([...plan, newItem]);
      }
      setSelectedFoodId("");
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

  const handleQuantityChange = (
    index: number,
    value: number,
    opts?: { ingredientId?: string }
  ) => {
    if (value <= 0) return;
    const updated = [...plan];
    const item = updated[index];
    if (!item) return;
    if (item.type === "food") {
      if (opts?.ingredientId) {
        const ingredientId = opts.ingredientId;
        const foodItem = item as FoodPlanItem;
        const current = foodItem.overrides[ingredientId];
        // Only update quantity for the specific ingredient override
        foodItem.overrides = {
          ...foodItem.overrides,
          [ingredientId]: {
            unitId: current?.unitId ?? 0,
            quantity: value,
          },
        };
        updated[index] = { ...foodItem };
      } else {
        updated[index] = { ...item, portions: value } as FoodPlanItem;
      }
    } else {
      updated[index] = { ...(item as IngredientPlanItem), amount: value };
    }
    setPlan(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = plan.filter((_, i) => i !== index);
    setPlan(updated);
  };

  const calculateIngredientMacros = useCallback(
    (
      ingredient,
      override?: FoodOverride,
    ) => {
      const dataIngredient = ingredients.find(
        (i) => i.id === ingredient.ingredient_id,
      );
      if (!dataIngredient) {
        return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
      }
      const effectiveUnitId = override?.unitId ?? ingredient.unit_id;
      const effectiveQuantity = override?.quantity ?? ingredient.unit_quantity;
      const unit =
        dataIngredient.units.find((u) => u.id === effectiveUnitId) ||
        dataIngredient.units.find((u) => u.name === "1g") ||
        dataIngredient.units[0];
      const grams = unit ? unit.grams : 0;
      return {
        calories:
          (dataIngredient.nutrition.calories || 0) * grams * effectiveQuantity,
        protein:
          (dataIngredient.nutrition.protein || 0) * grams * effectiveQuantity,
        fat: (dataIngredient.nutrition.fat || 0) * grams * effectiveQuantity,
        carbs:
          (dataIngredient.nutrition.carbohydrates || 0) * grams * effectiveQuantity,
        fiber: (dataIngredient.nutrition.fiber || 0) * grams * effectiveQuantity,
      };
    },
    [ingredients],
  );

  const calculateFoodMacros = useCallback(
    (
      food,
      overrides?: Record<string, FoodOverride>,
    ) => {
      if (!food) return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
      return food.ingredients.reduce(
        (totals, ingredient) => {
          const override = overrides?.[ingredient.ingredient_id];
          const macros = calculateIngredientMacros(ingredient, override);
          totals.calories += macros.calories;
          totals.protein += macros.protein;
          totals.fat += macros.fat;
          totals.carbs += macros.carbs;
          totals.fiber += macros.fiber;
          return totals;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
      );
    },
    [calculateIngredientMacros]
  );

  const calculateItemMacros = useCallback(
    (item: PlanItem) => {
      if (item.type === "food") {
        const food = foods.find((m) => m.id === item.foodId);
        const macros = calculateFoodMacros(food, item.overrides);
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
    },
    [foods, calculateFoodMacros, calculateIngredientMacros]
  );

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
          <MenuItem value="food">Food</MenuItem>
          <MenuItem value="ingredient">Ingredient</MenuItem>
        </TextField>
        {selectedType === "food" ? (
          <>
            <TextField
              select
              label="Food"
              value={selectedFoodId}
              onChange={(e) => setSelectedFoodId(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {foods.map((food) => (
                <MenuItem key={food.id} value={food.id}>
                  {food.name}
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
                const defaultUnit =
                  ing?.units.find((u) => u.grams === 1) || ing?.units[0];
                setSelectedIngredientUnitId(defaultUnit?.id || 0);
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
            selectedType === "food"
              ? !selectedFoodId || selectedPortions <= 0
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
            if (item.type === "food") {
              const food = foods.find((m) => m.id === item.foodId);
              const macros = calculateFoodMacros(food, item.overrides);
              return (
                <React.Fragment key={`food-${item.foodId}`}>
                  <TableRow>
                    <TableCell onClick={() => setOpen({ ...open, [index]: !open[index] })}>
                      {open[index] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
                    </TableCell>
                    <TableCell>{food ? food.name : ""}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton
                          size="small"
                          aria-label="decrement portions"
                          onClick={() =>
                            handleQuantityChange(index, Math.max(1, item.portions - 1))
                          }
                        >
                          <Remove fontSize="small" />
                        </IconButton>
                        <TextField
                          type="number"
                          value={item.portions}
                          onChange={(e) =>
                            handleQuantityChange(index, parseFloat(e.target.value) || 0)
                          }
                          sx={{ width: 80 }}
                        />
                        <IconButton
                          size="small"
                          aria-label="increment portions"
                          onClick={() => handleQuantityChange(index, item.portions + 1)}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>
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
                            {food?.ingredients.map((ingredient) => {
                              const dataIngredient = ingredients.find(
                                (i) => i.id === ingredient.ingredient_id
                              );
                              const override = item.overrides[ingredient.ingredient_id];
                              const unitId = override?.unitId ?? ingredient.unit_id;
                              const unit =
                                dataIngredient?.units.find((u) => u.id === unitId) ||
                                dataIngredient?.units.find((u) => u.name === "1g") ||
                                dataIngredient?.units[0];
                              const quantity = override?.quantity ?? ingredient.unit_quantity;
                              const ingMacros = calculateIngredientMacros(
                                ingredient,
                                { unitId, quantity },
                              );
                              return (
                                <TableRow key={ingredient.ingredient_id}>
                                  <TableCell>
                                    {dataIngredient ? dataIngredient.name : ""}
                                  </TableCell>
                                  <TableCell>{unit ? unit.name : ""}</TableCell>
                                  <TableCell>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <IconButton
                                        size="small"
                                        aria-label="decrement quantity"
                                        onClick={() =>
                                          handleQuantityChange(
                                            index,
                                            Math.max(1, (quantity || 0) - 1),
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                      >
                                        <Remove fontSize="small" />
                                      </IconButton>
                                      <TextField
                                        type="number"
                                        value={quantity}
                                        onChange={(e) =>
                                          handleQuantityChange(
                                            index,
                                            parseFloat(e.target.value) || 0,
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                        sx={{ width: 80 }}
                                      />
                                      <IconButton
                                        size="small"
                                        aria-label="increment quantity"
                                        onClick={() =>
                                          handleQuantityChange(
                                            index,
                                            (quantity || 0) + 1,
                                            { ingredientId: ingredient.ingredient_id }
                                          )
                                        }
                                      >
                                        <Add fontSize="small" />
                                      </IconButton>
                                      <Box component="span">x {item.portions}</Box>
                                    </Box>
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <IconButton
                        size="small"
                        aria-label="decrement amount"
                        onClick={() =>
                          handleQuantityChange(index, Math.max(1, item.amount - 1))
                        }
                      >
                        <Remove fontSize="small" />
                      </IconButton>
                      <TextField
                        type="number"
                        value={item.amount}
                        onChange={(e) =>
                          handleQuantityChange(index, parseFloat(e.target.value) || 0)
                        }
                        sx={{ width: 80 }}
                      />
                      <IconButton
                        size="small"
                        aria-label="increment amount"
                        onClick={() => handleQuantityChange(index, item.amount + 1)}
                      >
                        <Add fontSize="small" />
                      </IconButton>
                      <Box component="span">{unit ? unit.name : ""}</Box>
                    </Box>
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
