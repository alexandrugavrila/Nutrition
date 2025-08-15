import React, { useEffect } from "react";
import PropTypes from "prop-types";
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

NameEdit.propTypes = {
  ingredient: PropTypes.shape({
    name: PropTypes.string,
  }).isRequired,
  dispatch: PropTypes.func.isRequired,
  needsClearForm: PropTypes.bool,
};
