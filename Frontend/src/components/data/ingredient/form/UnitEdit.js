import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Button, Select, MenuItem, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

function AddUnitDialog({ open, onClose, onAddUnit }) {
  const [unitName, setUnitName] = useState("");
  const [unitGrams, setUnitGrams] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleAddUnit = () => {
    if (!unitName.trim()) {
      setValidationError("Unit name cannot be empty");
      return;
    }
    const gramsFloat = parseFloat(unitGrams);
    if (isNaN(gramsFloat) || gramsFloat <= 0 || !/^(\d*\.?\d{0,4})$/.test(unitGrams)) {
      setValidationError("Please enter a valid grams value up to 4 decimal places");
      return;
    }
    onAddUnit(unitName, gramsFloat.toFixed(4));
    setUnitName("");
    setUnitGrams("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}>
      <DialogTitle>Add Unit</DialogTitle>
      <DialogContent>
        <TextField
          label="Unit name"
          variant="outlined"
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
          error={Boolean(validationError && validationError.includes("Unit name"))}
          helperText={validationError && validationError.includes("Unit name") ? validationError : ""}
        />
        <TextField
          label="Unit grams"
          variant="outlined"
          value={unitGrams}
          onChange={(e) => setUnitGrams(e.target.value)}
          error={Boolean(validationError && validationError.includes("grams"))}
          helperText={validationError && validationError.includes("grams") ? validationError : "Enter a number up to 4 decimal places"}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleAddUnit}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UnitEdit({ ingredient, dispatch, needsClearForm }) {
  const [showAddUnitDialog, setShowAddUnitDialog] = useState(false);

  const handleSelectedUnitChange = useCallback(
    (event) => {
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, selectedUnitId: event.target.value } });
    },
    [ingredient, dispatch]
  );

  const handleAddUnit = useCallback(
    (name, grams) => {
      const tempId = crypto.randomUUID();
      const newUnit = {
        id: tempId,
        ingredient_id: ingredient.id,
        name: name.trim(),
        grams: grams,
      };
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, units: [...ingredient.units, newUnit], selectedUnitId: tempId } });
    },
    [dispatch, ingredient]
  );

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, units: [], selectedUnitId: 0 } });
    }
  }, [needsClearForm, dispatch, ingredient]);

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <div>
        <Select
          style={{ textAlign: "center" }}
          labelId="unit-select-label"
          id="unit-select"
          value={ingredient.selectedUnitId || 0}
          onChange={handleSelectedUnitChange}>
          {ingredient.units &&
            ingredient.units.map((unit) => (
              <MenuItem
                key={unit.id}
                value={unit.id}>
                {unit.name}
              </MenuItem>
            ))}
        </Select>
        <Button onClick={() => setShowAddUnitDialog(true)}>Add Unit</Button>
      </div>
      <AddUnitDialog
        open={showAddUnitDialog}
        onClose={() => setShowAddUnitDialog(false)}
        onAddUnit={handleAddUnit}
      />
    </div>
  );
}

export default UnitEdit;

AddUnitDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAddUnit: PropTypes.func.isRequired,
};

UnitEdit.propTypes = {
  ingredient: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    units: PropTypes.array,
    selectedUnitId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  dispatch: PropTypes.func.isRequired,
  needsClearForm: PropTypes.bool,
};
