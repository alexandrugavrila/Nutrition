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
    const sanitizedValue = typeof value === "string" ? value.replace(",", ".") : String(value ?? "");
    const partialNumberPattern = /^(\d+)?(\.\d*)?$/;
    const isValidPartialNumber = sanitizedValue === "" || partialNumberPattern.test(sanitizedValue) || sanitizedValue === ".";
    if (!isValidPartialNumber) {
      return;
    }

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
    const baseMultiplier = multiplier || 1;
    const updatedNutrition = {
      calories: normalized.calories / baseMultiplier,
      protein: normalized.protein / baseMultiplier,
      carbohydrates: normalized.carbohydrates / baseMultiplier,
      fat: normalized.fat / baseMultiplier,
      fiber: normalized.fiber / baseMultiplier,
    };
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, nutrition: updatedNutrition } });
  };

  useEffect(() => {
    if (!ingredient) return;

    const units = ingredient.units || [];
    const selectedUnit =
      units.find((unit) => {
        const target = ingredient.shoppingUnitId;
        if (target == null) return false;
        if (unit.id == null) return false;
        if (typeof target === "string" && !Number.isNaN(Number(target))) {
          return Number(unit.id) === Number(target);
        }
        return String(unit.id) === String(target);
      }) || units[0];
    const parsedGrams = parseFloat(String(selectedUnit?.grams ?? 1));
    const safeMultiplier = Number.isFinite(parsedGrams) && parsedGrams > 0 ? parsedGrams : 1;

    if (safeMultiplier !== multiplier) {
      setMultiplier(safeMultiplier);
    }

    if (!needsClearForm) {
      setDisplayedNutrition({
        calories: (ingredient.nutrition?.calories ?? 0) * safeMultiplier,
        protein: (ingredient.nutrition?.protein ?? 0) * safeMultiplier,
        carbohydrates: (ingredient.nutrition?.carbohydrates ?? 0) * safeMultiplier,
        fat: (ingredient.nutrition?.fat ?? 0) * safeMultiplier,
        fiber: (ingredient.nutrition?.fiber ?? 0) * safeMultiplier,
      });
    }
  }, [ingredient, multiplier, needsClearForm]); // Sync displayed nutrition when units or base values change

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
        calories: (ingredient.nutrition?.calories ?? 0) * multiplier,
        protein: (ingredient.nutrition?.protein ?? 0) * multiplier,
        carbohydrates: (ingredient.nutrition?.carbohydrates ?? 0) * multiplier,
        fat: (ingredient.nutrition?.fat ?? 0) * multiplier,
        fiber: (ingredient.nutrition?.fiber ?? 0) * multiplier,
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




