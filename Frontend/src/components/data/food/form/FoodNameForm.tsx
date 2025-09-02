import React, { useEffect } from "react";
import { TextField } from "@mui/material";

function FoodNameForm({ food, dispatch, needsClearForm }) {
  const handleNameChange = (event) => {
    const name = event.target.value;
    dispatch({ type: "SET_FOOD", payload: { ...food, name } });
  };

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_FOOD", payload: { ...food, name: "" } });
    }
  }, [needsClearForm, dispatch, food]);

  return (
    <TextField
      label="Name"
      variant="outlined"
      value={food.name || ""}
      onChange={handleNameChange}
      style={{ marginBottom: "10px" }}
    />
  );
}

export default FoodNameForm;
