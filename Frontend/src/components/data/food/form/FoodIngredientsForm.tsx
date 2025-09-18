import React, { useEffect, useState, useCallback } from "react";
import { Button, TextField, Select, MenuItem, Dialog, TableContainer, Table, TableHead, TableRow, TableCell, Paper, TableBody, IconButton, Stack } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { useData } from "@/contexts/DataContext";
import IngredientTable from "@/components/data/ingredient/IngredientTable";
import IngredientEditModal from "@/components/common/IngredientEditModal";
import IngredientAddModal from "@/components/common/IngredientAddModal";

import { formatCellNumber } from "@/utils/utils";

const NULL_UNIT_VALUE = "__NULL_UNIT__";

function matchUnitById(units, targetId) {
  if (!units || units.length === 0) return undefined;
  const normalizedTarget = Array.isArray(targetId) ? targetId[0] : targetId;
  const comparableTarget =
    normalizedTarget === NULL_UNIT_VALUE || normalizedTarget === "" || normalizedTarget === undefined
      ? null
      : normalizedTarget;
  return units.find((unit) => {
    if (unit.id == null && comparableTarget == null) return true;
    if (unit.id == null || comparableTarget == null) return false;
    return String(unit.id) === String(comparableTarget);
  });
}

function coerceUnitId(units, rawId) {
  const normalizedRaw = Array.isArray(rawId) ? rawId[0] : rawId;
  if (
    normalizedRaw === NULL_UNIT_VALUE ||
    normalizedRaw === "" ||
    normalizedRaw === undefined ||
    normalizedRaw === null
  ) {
    return null;
  }
  const match = matchUnitById(units, normalizedRaw);
  if (!match) return normalizedRaw;
  return match.id ?? null;
}

function FoodIngredientsForm({ food, dispatch, needsClearForm }) {
  //#region States
  const { ingredients } = useData();
  const [openIngredientsDialog, setOpenIngredientsDialog] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [editorIngredient, setEditorIngredient] = useState(null);
  const [unitQuantities, setUnitQuantities] = useState({}); // Use an object to track unit quantities by ingredient index
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
    dispatch({ type: "SET_FOOD", payload: { ...food, ingredients: [...food.ingredients, buildFoodIngredient(ingredient)] } });
    handleCloseIngredientsDialog();
  };

  const handleOpenIngredientEditor = (ingredientId) => {
    const dataIngredient = ingredients.find((i) => i.id === ingredientId) || null;
    setEditorIngredient(dataIngredient);
    if (dataIngredient) {
      setOpenEditModal(true);
    } else {
      setOpenAddModal(true);
    }
  };

  const buildFoodIngredient = (ingredient) => {
    return {
      ingredient_id: ingredient.id,
      food_id: food.id,
      unit_id: ingredient.selectedUnitId ?? null,
      unit_quantity: 1,
    };
  };

  const handleUnitQuantityChange = (event, index) => {
    const newUnitQuantities = { ...unitQuantities, [index]: event.target.value };
    setUnitQuantities(newUnitQuantities);
    handleUpdateIngredientUnitQuantity(index, event.target.value);
  };

  const handleUnitQuantityBlur = (index) => {
    if (unitQuantities[index] === "") {
      const newUnitQuantities = { ...unitQuantities, [index]: "0" };
      setUnitQuantities(newUnitQuantities);
      handleUpdateIngredientUnitQuantity(index, "0");
    }
  };

  const handleUpdateIngredientUnitQuantity = (index, value) => {
    const updatedIngredients = [...food.ingredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      unit_quantity: parseFloat(value),
    };
    if (!isNaN(updatedIngredients[index].unit_quantity)) {
      // Don't update if the field is empty
      dispatch({ type: "SET_FOOD", payload: { ...food, ingredients: updatedIngredients } });
    }
  };

  const calculateTotalIngredientMacros = useCallback(
    (food_ingredient) => {
      if (!food_ingredient) return;

      const dataIngredient = ingredients.find((item) => item.id === food_ingredient.ingredient_id);

      const unitId = food_ingredient.unit_id;
      const dataUnit =
        matchUnitById(dataIngredient.units, unitId) ||
        dataIngredient.units.find((unit) => unit.grams === 1) ||
        dataIngredient.units[0];

      return {
        calories: dataIngredient.nutrition.calories ? dataIngredient.nutrition.calories * dataUnit.grams * food_ingredient.unit_quantity : 0,
        protein: dataIngredient.nutrition.protein ? dataIngredient.nutrition.protein * dataUnit.grams * food_ingredient.unit_quantity : 0,
        fat: dataIngredient.nutrition.fat ? dataIngredient.nutrition.fat * dataUnit.grams * food_ingredient.unit_quantity : 0,
        carbs: dataIngredient.nutrition.carbohydrates ? dataIngredient.nutrition.carbohydrates * dataUnit.grams * food_ingredient.unit_quantity : 0,
        fiber: dataIngredient.nutrition.fiber ? dataIngredient.nutrition.fiber * dataUnit.grams * food_ingredient.unit_quantity : 0,
      };
    },
    [ingredients]
  );

  const handleUnitChange = (event, ingredientIndex, ingredientUnits) => {
    const unitsForIngredient = ingredientUnits ?? [];
    const newUnitId = coerceUnitId(unitsForIngredient, event.target.value);
    const updatedIngredients = [...food.ingredients];
    updatedIngredients[ingredientIndex] = {
      ...updatedIngredients[ingredientIndex],
      unit_id: newUnitId,
    };
    dispatch({ type: "SET_FOOD", payload: { ...food, ingredients: updatedIngredients } });
  };
  //#endregion Handles

  //#region Effects
  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_FOOD", payload: { ...food, ingredients: [] } });
    }
  }, [needsClearForm, dispatch, food]); // Clear ingredients when needsClearForm is true

  useEffect(() => {
    const initialUnitQuantities = food.ingredients.reduce((acc, ingredient, index) => {
      acc[index] = ingredient.unit_quantity.toString();
      return acc;
    }, {});
    setUnitQuantities(initialUnitQuantities);
  }, [food]); // Initialize or reset the unit quantities when food changes, ensuring inputs are up-to-date

  useEffect(() => {
    const totals = food.ingredients.reduce(
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
  }, [food.ingredients, ingredients, calculateTotalIngredientMacros]); // Update totals when food ingredients or ingredients change
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
            {food.ingredients.map((ingredient, index) => {
              const dataIngredient = ingredients.find((item) => item.id === ingredient.ingredient_id);
              const ingredientUnits = dataIngredient?.units ?? [];
              const defaultUnitId =
                ingredientUnits.find((u) => u.grams === 1)?.id ??
                ingredientUnits[0]?.id ??
                null;
              const selectedUnitId = ingredient.unit_id ?? defaultUnitId ?? null;
              const selectedUnitOption =
                selectedUnitId == null ? NULL_UNIT_VALUE : String(selectedUnitId);
              return (
                <TableRow key={index}>
                  <TableCell>{dataIngredient ? dataIngredient.name : "Unknown Ingredient"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Select
                        style={{ textAlign: "center" }}
                        value={selectedUnitOption}
                        onChange={(event) => handleUnitChange(event, index, ingredientUnits)}
                        inputProps={{ "aria-label": "Without label" }}
                        displayEmpty
                        renderValue={(value) => {
                          const unit = matchUnitById(ingredientUnits, value);
                          return unit ? unit.name : "Select unit";
                        }}>
                        {ingredientUnits.map((unit) => {
                          const optionValue = unit.id == null ? NULL_UNIT_VALUE : String(unit.id);
                          return (
                            <MenuItem key={unit.id ?? `unit-${unit.name}`} value={optionValue}>
                              {unit.name}
                            </MenuItem>
                          );
                        })}
                      </Select>
                      <IconButton
                        aria-label="Edit ingredient"
                        size="small"
                        onClick={() => handleOpenIngredientEditor(ingredient.ingredient_id)}
                        title="Edit ingredient (add units, nutrition, tags)"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={unitQuantities[index] || ""}
                      onChange={(event) => handleUnitQuantityChange(event, index)}
                      onBlur={() => handleUnitQuantityBlur(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.target.blur();
                      }}
                      inputProps={{ min: 0, step: "any", inputMode: "decimal" }}
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
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="contained" onClick={handleOpenIngredientsDialog}>
          Add Ingredients
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setEditorMode("add");
            setEditorIngredient(null);
            setOpenEditor(true);
          }}
        >
          New Ingredient
        </Button>
      </Stack>

      <Dialog
        open={openIngredientsDialog}
        onClose={handleCloseIngredientsDialog}
        maxWidth="lg"
        scroll="body"
        fullWidth>
        <IngredientTable
          onIngredientDoubleClick={handleAddIngredient}
          onIngredientCtrlClick={(ing) => {
            setEditorIngredient(ing);
            setOpenEditModal(true);
          }}
        />
      </Dialog>

      <IngredientEditModal
        open={openEditModal}
        ingredient={editorIngredient}
        onClose={() => setOpenEditModal(false)}
      />
      <IngredientAddModal
        open={openAddModal}
        onClose={() => setOpenAddModal(false)}
      />
    </div>
  );
}

export default FoodIngredientsForm;
