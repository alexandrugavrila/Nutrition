import React, { useEffect, useState } from "react";
import { TextField } from "@mui/material";

function NutritionEdit({ ingredient, dispatch, needsClearForm, needsFillForm }) {
  const [multiplier, setMultiplier] = useState(1);
  const [displayNutrition, setDisplayedNutrition] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });

  const inputStyle = {
    width: "15ch",
    margin: "8px",
    "& input": {
      marginLeft: "3ch",
    },
  };

  const handleFieldEdit = (key, value) => {
    // Allow empty, integers, and decimals while typing (e.g. "1.")
    const isValidPartialNumber = value === "" || /^(\d+)?([\.,]\d*)?$/.test(value);
    if (!isValidPartialNumber) return;

    setDisplayedNutrition({
      ...displayNutrition,
      [key]: value,
    });
  };
  const handleFieldEditFinish = () => {
    // Normalize blanks and parse to numbers (support ',' as decimal)
    const normalized = Object.keys(displayNutrition).reduce((acc, key) => {
      const raw = displayNutrition[key];
      const parsed = parseFloat(String(raw).replace(",", "."));
      return { ...acc, [key]: isNaN(parsed) ? 0 : parsed };
    }, {});

    setDisplayedNutrition(normalized);

    // Calculate nutrition per gram
    const updatedNutrition = {
      calories: normalized.calories / multiplier,
      protein: normalized.protein / multiplier,
      carbohydrates: normalized.carbohydrates / multiplier,
      fat: normalized.fat / multiplier,
      fiber: normalized.fiber / multiplier,
    };
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, nutrition: updatedNutrition } });
  };

  useEffect(() => {
    if (ingredient && ingredient.units && ingredient.selectedUnitId) {
      setMultiplier(ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId).grams);
    }
  }, [ingredient]); // Sets multiplier on ingredient.selectedUnitId change

  useEffect(() => {
    if (needsClearForm) {
      // Clear input fields visually
      setDisplayedNutrition({
        calories: "",
        protein: "",
        carbohydrates: "",
        fat: "",
        fiber: "",
      });

      // Keep underlying state numeric to avoid type issues elsewhere
      const clearedNutrition = {
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fiber: 0,
      };
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, nutrition: clearedNutrition } });
    }
  }, [needsClearForm, dispatch, ingredient]); // Clears the form on needsClearForm

  useEffect(() => {
    if (needsFillForm) {
      setDisplayedNutrition({
        calories: ingredient.nutrition.calories * multiplier,
        protein: ingredient.nutrition.protein * multiplier,
        carbohydrates: ingredient.nutrition.carbohydrates * multiplier,
        fat: ingredient.nutrition.fat * multiplier,
        fiber: ingredient.nutrition.fiber * multiplier,
      });
    }
  }, [needsFillForm, ingredient, multiplier]); // Fills the form on needsFillForm

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <TextField
        label="Calories"
        value={displayNutrition.calories}
        onChange={(e) => handleFieldEdit("calories", e.target.value)}
        onBlur={handleFieldEditFinish}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
          inputMode: "decimal",
        }}
      />
      <TextField
        label="Protein"
        value={displayNutrition.protein}
        onChange={(e) => handleFieldEdit("protein", e.target.value)}
        onBlur={handleFieldEditFinish}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
          inputMode: "decimal",
        }}
      />
      <TextField
        label="Carbs"
        value={displayNutrition.carbohydrates}
        onChange={(e) => handleFieldEdit("carbohydrates", e.target.value)}
        onBlur={handleFieldEditFinish}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
          inputMode: "decimal",
        }}
      />
      <TextField
        label="Fat"
        value={displayNutrition.fat}
        onChange={(e) => handleFieldEdit("fat", e.target.value)}
        onBlur={handleFieldEditFinish}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
          inputMode: "decimal",
        }}
      />
      <TextField
        label="Fiber"
        value={displayNutrition.fiber}
        onChange={(e) => handleFieldEdit("fiber", e.target.value)}
        onBlur={handleFieldEditFinish}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
          inputMode: "decimal",
        }}
      />
    </div>
  );
}

export default NutritionEdit;
