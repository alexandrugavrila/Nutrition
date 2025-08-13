import React, { useEffect } from "react";
import { TextField } from "@mui/material";

function NameEdit({ ingredient, dispatch, needsClearForm }) {
  const handleNameChange = (event) => {
    const name = event.target.value;
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, name } });
  };

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, name: "" } });
    }
  }, [needsClearForm, dispatch, ingredient]);

  return (
    <TextField
      label="Name"
      variant="outlined"
      value={ingredient.name || ""}
      onChange={handleNameChange}
      style={{ marginBottom: "10px" }}
    />
  );
}

export default NameEdit;
