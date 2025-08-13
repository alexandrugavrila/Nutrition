import React, { useEffect } from "react";
import { TextField } from "@mui/material";

function MealNameForm({ meal, dispatch, needsClearForm }) {
  const handleNameChange = (event) => {
    const name = event.target.value;
    dispatch({ type: "SET_MEAL", payload: { ...meal, name } });
  };

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_MEAL", payload: { ...meal, name: "" } });
    }
  }, [needsClearForm, dispatch, meal]);

  return (
    <TextField
      label="Name"
      variant="outlined"
      value={meal.name || ""}
      onChange={handleNameChange}
      style={{ marginBottom: "10px" }}
    />
  );
}

export default MealNameForm;
