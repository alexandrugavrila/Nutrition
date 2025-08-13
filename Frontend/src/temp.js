import React, { useEffect, useState } from "react";
import { TextField } from "@mui/material";

function NutritionEdit({ ingredient, dispatch, needsClearForm }) {
  const [multiplier, setMultiplier] = useState(1);

  const [displayedNutrition, setDisplayedNutrition] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });
  const [oneGramNutrition, setOneGramNutrition] = useState({
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

  const handleFieldEditFinish = (key, value) => {
    if (!isNaN(value)) {
      const newValue = parseFloat(value); // Validation: Check if value is numeric
      setDisplayedNutrition({
        ...displayedNutrition,
        [key]: newValue,
      });
      setOneGramNutrition({
        ...ingredient.nutrition,
        [key]: value === newValue / multiplier,
      });
    }
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, nutrition: oneGramNutrition } });
  };

  useEffect(() => {
    if (ingredient && ingredient.units && ingredient.selectedUnitId) {
      setMultiplier(ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId).grams);
    }
  }, [ingredient]); // Sets multiplier on ingredient.selectedUnitId change

  useEffect(() => {
    if (needsClearForm) {
      const newNutrition = {
        calories: "",
        protein: "",
        carbohydrates: "",
        fat: "",
        fiber: "",
      };
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, nutrition: newNutrition } });
    }
  }, [needsClearForm, dispatch, ingredient]); // Clears the form on needsClearForm

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <TextField
        label="Calories"
        value={displayedNutrition.calories}
        onBlur={(e) => handleFieldEditFinish("calories", e.target.value)}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
        }}
      />
      <TextField
        label="Protein"
        value={displayedNutrition.protein * multiplier}
        onBlur={(e) => handleFieldEditFinish("protein", e.target.value)}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
        }}
      />
      <TextField
        label="Carbs"
        value={displayedNutrition.carbohydrates * multiplier}
        onBlur={(e) => handleFieldEditFinish("carbohydrates", e.target.value)}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
        }}
      />
      <TextField
        label="Fat"
        value={displayedNutrition.fat * multiplier}
        onBlur={(e) => handleFieldEditFinish("fat", e.target.value)}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
        }}
      />
      <TextField
        label="Fiber"
        value={displayedNutrition.fiber * multiplier}
        onBlur={(e) => handleFieldEditFinish("fiber", e.target.value)}
        variant="outlined"
        sx={inputStyle}
        inputProps={{
          sx: inputStyle["& input"],
        }}
      />
    </div>
  );
}

export default NutritionEdit;
