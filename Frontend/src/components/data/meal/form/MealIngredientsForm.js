import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Button, TextField, Select, MenuItem, Dialog, TableContainer, Table, TableHead, TableRow, TableCell, Paper, TableBody } from "@mui/material";

import { useData } from "../../../../contexts/DataContext";
import IngredientTable from "../../ingredient/IngredientTable";

import { formatCellNumber } from "../../../../utils/utils";

function MealIngredientsForm({ meal, dispatch, needsClearForm }) {
  //#region States
  const { ingredients } = useData();
  const [openIngredientsDialog, setOpenIngredientsDialog] = useState(false);
  const [amounts, setAmounts] = useState({}); // Use an object to track amounts by ingredient index
  const [totalMacros, setTotalMacros] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
  });
  //#endregion States

  //#region Handles
  const handleOpenIngredientsDialog = () => {
    setOpenIngredientsDialog(true);
  };

  const handleCloseIngredientsDialog = () => {
    setOpenIngredientsDialog(false);
  };

  const handleAddIngredient = (ingredient) => {
    dispatch({ type: "SET_MEAL", payload: { ...meal, ingredients: [...meal.ingredients, buildMealIngredient(ingredient)] } });
    handleCloseIngredientsDialog();
  };

  const buildMealIngredient = (ingredient) => {
    return {
      ingredient_id: ingredient.id,
      meal_id: meal.id,
      unit_id: ingredient.selectedUnitId ? ingredient.selectedUnitId : null,
      amount: 1,
    };
  };

  const handleAmountChange = (event, index) => {
    const newAmounts = { ...amounts, [index]: event.target.value };
    setAmounts(newAmounts);
    handleUpdateIngredientAmount(index, event.target.value);
  };

  const handleAmountBlur = (index) => {
    if (amounts[index] === "") {
      const newAmounts = { ...amounts, [index]: "0" };
      setAmounts(newAmounts);
      handleUpdateIngredientAmount(index, "0");
    }
  };

  const handleUpdateIngredientAmount = (index, value) => {
    const updatedIngredients = [...meal.ingredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      amount: parseFloat(value),
    };
    if (!isNaN(updatedIngredients[index].amount)) {
      // Don't update if the field is empty
      dispatch({ type: "SET_MEAL", payload: { ...meal, ingredients: updatedIngredients } });
    }
  };

  const calculateTotalIngredientMacros = useCallback(
    (meal_ingredient) => {
      if (!meal_ingredient) return;

      const dataIngredient = ingredients.find((item) => item.id === meal_ingredient.ingredient_id);

      const unitId = meal_ingredient.unit_id ?? 0; // If meal_ingredient.unit_id is undefined or null, use 0
      const dataUnit = dataIngredient.units.find((unit) => unit.id === unitId) || dataIngredient.units[0]; // Fallback to the first unit if not found

      return {
        calories: dataIngredient.nutrition.calories ? dataIngredient.nutrition.calories * dataUnit.grams * meal_ingredient.amount : 0,
        protein: dataIngredient.nutrition.protein ? dataIngredient.nutrition.protein * dataUnit.grams * meal_ingredient.amount : 0,
        fat: dataIngredient.nutrition.fat ? dataIngredient.nutrition.fat * dataUnit.grams * meal_ingredient.amount : 0,
        carbs: dataIngredient.nutrition.carbohydrates ? dataIngredient.nutrition.carbohydrates * dataUnit.grams * meal_ingredient.amount : 0,
        fiber: dataIngredient.nutrition.fiber ? dataIngredient.nutrition.fiber * dataUnit.grams * meal_ingredient.amount : 0,
      };
    },
    [ingredients]
  );

  const handleUnitChange = (event, ingredientIndex) => {
    const newUnitId = event.target.value;
    const updatedIngredients = [...meal.ingredients];
    updatedIngredients[ingredientIndex] = {
      ...updatedIngredients[ingredientIndex],
      unit_id: newUnitId,
    };
    dispatch({ type: "SET_MEAL", payload: { ...meal, ingredients: updatedIngredients } });
  };
  //#endregion Handles

  //#region Effects
  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_MEAL", payload: { ...meal, ingredients: [] } });
    }
  }, [needsClearForm, dispatch, meal]); // Clear ingredients when needsClearForm is true

  useEffect(() => {
    const initialAmounts = meal.ingredients.reduce((acc, ingredient, index) => {
      acc[index] = ingredient.amount.toString();
      return acc;
    }, {});
    setAmounts(initialAmounts);
  }, [meal]); // Initialize or reset the amounts when meal changes, ensuring inputs are up-to-date

  useEffect(() => {
    const totals = meal.ingredients.reduce(
      (acc, ingredient) => {
        const macros = calculateTotalIngredientMacros(ingredient);
        acc.calories += macros.calories;
        acc.protein += macros.protein;
        acc.fat += macros.fat;
        acc.carbs += macros.carbs;
        acc.fiber += macros.fiber;
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );

    setTotalMacros(totals);
  }, [meal.ingredients, ingredients, calculateTotalIngredientMacros]); // Update totals when meal ingredients or ingredients change
  //#endregion Effects

  return (
    <div>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell>{formatCellNumber(totalMacros.calories)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.protein)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fat)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.carbs)}</TableCell>
              <TableCell>{formatCellNumber(totalMacros.fiber)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Calories</TableCell>
              <TableCell>Protein</TableCell>
              <TableCell>Fat</TableCell>
              <TableCell>Carbs</TableCell>
              <TableCell>Fiber</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {meal.ingredients.map((ingredient, index) => {
              const dataIngredient = ingredients.find((item) => item.id === ingredient.ingredient_id);

              return (
                <TableRow key={index}>
                  <TableCell>{dataIngredient ? dataIngredient.name : "Unknown Ingredient"}</TableCell>
                  <TableCell>
                    <div>
                      <Select
                        style={{ textAlign: "center" }}
                        value={ingredient.unit_id || 0}
                        onChange={(event) => handleUnitChange(event, index)}
                        inputProps={{ "aria-label": "Without label" }}>
                        {dataIngredient.units.map((unit) => (
                          <MenuItem
                            key={unit.id}
                            value={unit.id}>
                            {unit.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={amounts[index] || ""}
                      onChange={(event) => handleAmountChange(event, index)}
                      onBlur={() => handleAmountBlur(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.target.blur();
                      }}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </TableCell>
                  <TableCell>{formatCellNumber(calculateTotalIngredientMacros(ingredient).calories)}</TableCell>
                  <TableCell>{formatCellNumber(calculateTotalIngredientMacros(ingredient).protein)}</TableCell>
                  <TableCell>{formatCellNumber(calculateTotalIngredientMacros(ingredient).fat)}</TableCell>
                  <TableCell>{formatCellNumber(calculateTotalIngredientMacros(ingredient).carbs)}</TableCell>
                  <TableCell>{formatCellNumber(calculateTotalIngredientMacros(ingredient).fiber)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        variant="contained"
        onClick={handleOpenIngredientsDialog}>
        Add Ingredients
      </Button>

      <Dialog
        open={openIngredientsDialog}
        onClose={handleCloseIngredientsDialog}
        maxWidth="lg"
        scroll="body"
        fullWidth>
        <IngredientTable onIngredientDoubleClick={handleAddIngredient} />
      </Dialog>
    </div>
  );
}

export default MealIngredientsForm;

MealIngredientsForm.propTypes = {
  meal: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    ingredients: PropTypes.arrayOf(
      PropTypes.shape({
        ingredient_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        unit_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        amount: PropTypes.number,
      })
    ).isRequired,
  }).isRequired,
  dispatch: PropTypes.func.isRequired,
  needsClearForm: PropTypes.bool,
};
