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
    if (value === "") {
      setDisplayedNutrition({
        ...displayNutrition,
        [key]: "",
      });
    } else if (!isNaN(value)) {
      const newValue = parseFloat(value); // Validation: Check if value is numeric
      setDisplayedNutrition({
        ...displayNutrition,
        [key]: newValue,
      });
    }
  };
  const handleFieldEditFinish = () => {
    // Ensure that any blank fields are set to 0
    const updatedDisplayNutrition = Object.keys(displayNutrition).reduce((acc, key) => {
      return {
        ...acc,
        [key]: displayNutrition[key] === "" ? 0 : displayNutrition[key],
      };
    }, {});
    setDisplayedNutrition(updatedDisplayNutrition);

    // Calculate nutrition per gram
    const updatedNutrition = {
      calories: updatedDisplayNutrition.calories / multiplier,
      protein: updatedDisplayNutrition.protein / multiplier,
      carbohydrates: updatedDisplayNutrition.carbohydrates / multiplier,
      fat: updatedDisplayNutrition.fat / multiplier,
      fiber: updatedDisplayNutrition.fiber / multiplier,
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
        }}
      />
    </div>
  );
}

export default NutritionEdit;
