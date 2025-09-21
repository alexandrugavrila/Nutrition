import React, { useCallback, useEffect, useState } from "react";
import { TextField } from "@mui/material";

const roundToTwoDecimalPlaces = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
};

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
    const isValidPartialNumber = value === "" || /^(\\d+)?([.,]\\d*)?$/.test(value);
    if (!isValidPartialNumber) return;

    setDisplayedNutrition({
      ...displayNutrition,
      [key]: value,
    });
  };
  const getRoundedDisplayNutrition = useCallback(
    (targetMultiplier: number) => ({
      calories: roundToTwoDecimalPlaces((ingredient?.nutrition?.calories ?? 0) * targetMultiplier),
      protein: roundToTwoDecimalPlaces((ingredient?.nutrition?.protein ?? 0) * targetMultiplier),
      carbohydrates: roundToTwoDecimalPlaces((ingredient?.nutrition?.carbohydrates ?? 0) * targetMultiplier),
      fat: roundToTwoDecimalPlaces((ingredient?.nutrition?.fat ?? 0) * targetMultiplier),
      fiber: roundToTwoDecimalPlaces((ingredient?.nutrition?.fiber ?? 0) * targetMultiplier),
    }),
    [ingredient],
  );

  const handleFieldEditFinish = () => {
    // Normalize blanks and parse to numbers (support ',' as decimal)
    const normalized = Object.keys(displayNutrition).reduce((acc, key) => {
      const raw = displayNutrition[key];
      const parsed = parseFloat(String(raw).replace(",", "."));
      const numericValue = Number.isNaN(parsed) ? 0 : roundToTwoDecimalPlaces(parsed);
      return { ...acc, [key]: numericValue };
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
      setDisplayedNutrition(getRoundedDisplayNutrition(safeMultiplier));
    }
  }, [ingredient, multiplier, needsClearForm, getRoundedDisplayNutrition]); // Sync displayed nutrition when units or base values change

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
      setDisplayedNutrition(getRoundedDisplayNutrition(multiplier));
    }
  }, [needsFillForm, ingredient, multiplier, getRoundedDisplayNutrition]); // Fills the form on needsFillForm

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




