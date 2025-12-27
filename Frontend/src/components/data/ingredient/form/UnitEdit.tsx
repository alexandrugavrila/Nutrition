import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";

import type { components } from "@/api-types";
import { generateUUID } from "@/utils/utils";

type IngredientRead = components["schemas"]["IngredientRead"];
type IngredientUnit = NonNullable<IngredientRead["units"]>[number];

const NULL_UNIT_VALUE = "__NULL_UNIT__";

type UnitDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  initialUnit?: IngredientUnit | null;
  units: IngredientUnit[];
  onClose: () => void;
  onSubmit: (name: string, grams: number) => void;
};

const formatUnitGrams = (value: IngredientUnit["grams"] | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return typeof value === "number" ? value.toString() : String(value);
};

function UnitDialog({ open, mode, initialUnit = null, units, onClose, onSubmit }: UnitDialogProps) {
  const [unitMode, setUnitMode] = useState<"grams" | "unit">("grams");
  const [unitName, setUnitName] = useState("");
  const [unitGrams, setUnitGrams] = useState("");
  const [baseUnitId, setBaseUnitId] = useState<string>("");
  const [baseQuantity, setBaseQuantity] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUnitMode("grams");
      setUnitName(initialUnit?.name ?? "");
      setUnitGrams(formatUnitGrams(initialUnit?.grams));
      setBaseUnitId(units[0]?.id != null ? String(units[0].id) : "");
      setBaseQuantity("1");
      setValidationError(null);
    }
  }, [initialUnit, open, units]);

  const resolvedBaseUnit = useMemo(
    () => units.find((unit) => String(unit.id) === baseUnitId) ?? null,
    [baseUnitId, units]
  );

  const resolvedBaseGrams = useMemo(() => {
    if (!resolvedBaseUnit) return null;
    const parsedQuantity = Number.parseFloat(baseQuantity.trim());
    if (!Number.isFinite(parsedQuantity)) return null;
    if (parsedQuantity <= 0) return null;
    const baseGrams = typeof resolvedBaseUnit.grams === "number"
      ? resolvedBaseUnit.grams
      : Number.parseFloat(String(resolvedBaseUnit.grams));
    if (!Number.isFinite(baseGrams) || baseGrams <= 0) return null;
    return parsedQuantity * baseGrams;
  }, [baseQuantity, resolvedBaseUnit]);

  const handleSubmit = () => {
    const trimmedName = unitName.trim();
    const trimmedGrams = unitMode === "unit" ? "" : unitGrams.trim();

    if (!trimmedName) {
      setValidationError("Unit name cannot be empty");
      return;
    }

    if (unitMode === "unit") {
      if (!resolvedBaseUnit) {
        setValidationError("Please select a base unit");
        return;
      }

      if (!baseQuantity.trim() || Number.isNaN(Number.parseFloat(baseQuantity.trim()))) {
        setValidationError("Please enter a valid unit quantity up to 4 decimal places");
        return;
      }

      if (!/^(\d*\.?\d{0,4})$/.test(baseQuantity.trim())) {
        setValidationError("Please enter a valid unit quantity up to 4 decimal places");
        return;
      }

      const gramsValue = resolvedBaseGrams;
      if (!gramsValue || gramsValue <= 0) {
        setValidationError("Please enter a valid unit quantity up to 4 decimal places");
        return;
      }

      const normalizedGrams = Number.parseFloat(gramsValue.toFixed(4));
      onSubmit(trimmedName, normalizedGrams);
      onClose();
      return;
    }

    if (!trimmedGrams || Number.isNaN(Number.parseFloat(trimmedGrams))) {
      setValidationError("Please enter a valid grams value up to 4 decimal places");
      return;
    }

    if (!/^(\d*\.?\d{0,4})$/.test(trimmedGrams)) {
      setValidationError("Please enter a valid grams value up to 4 decimal places");
      return;
    }

    const gramsFloat = Number.parseFloat(trimmedGrams);
    if (gramsFloat <= 0) {
      setValidationError("Please enter a valid grams value up to 4 decimal places");
      return;
    }

    const normalizedGrams = Number.parseFloat(gramsFloat.toFixed(4));
    onSubmit(trimmedName, normalizedGrams);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{mode === "edit" ? "Edit Unit" : "Add Unit"}</DialogTitle>
      <DialogContent>
        <TextField
          label="Unit name"
          variant="outlined"
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
          error={Boolean(validationError && validationError.includes("name"))}
          helperText={validationError && validationError.includes("name") ? validationError : ""}
          fullWidth
          margin="dense"
        />
        <TextField
          label="Definition method"
          variant="outlined"
          select
          value={unitMode}
          onChange={(event) => {
            setUnitMode(event.target.value as "grams" | "unit");
            setValidationError(null);
          }}
          fullWidth
          margin="dense"
        >
          <MenuItem value="grams">Direct grams</MenuItem>
          <MenuItem value="unit" disabled={units.length === 0}>
            Based on existing unit
          </MenuItem>
        </TextField>
        {unitMode === "unit" ? (
          <>
            <TextField
              label="Base unit"
              variant="outlined"
              select
              value={baseUnitId}
              onChange={(event) => setBaseUnitId(event.target.value)}
              error={Boolean(validationError && validationError.includes("base unit"))}
              helperText={
                validationError && validationError.includes("base unit")
                  ? validationError
                  : ""
              }
              fullWidth
              margin="dense"
            >
              {units.map((unit) => (
                <MenuItem key={unit.id ?? `unit-${unit.name}`} value={String(unit.id)}>
                  {unit.name} ({formatUnitGrams(unit.grams)} g)
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Base quantity"
              variant="outlined"
              value={baseQuantity}
              onChange={(e) => setBaseQuantity(e.target.value)}
              error={Boolean(validationError && validationError.includes("unit quantity"))}
              helperText={
                validationError && validationError.includes("unit quantity")
                  ? validationError
                  : "Enter a number up to 4 decimal places"
              }
              fullWidth
              margin="dense"
            />
          </>
        ) : null}
        <TextField
          label="Unit grams"
          variant="outlined"
          value={
            unitMode === "unit"
              ? formatUnitGrams(
                  resolvedBaseGrams == null ? undefined : resolvedBaseGrams
                )
              : unitGrams
          }
          onChange={(e) => setUnitGrams(e.target.value)}
          InputProps={{ readOnly: unitMode === "unit" }}
          disabled={unitMode === "unit"}
          error={Boolean(validationError && validationError.includes("grams"))}
          helperText={
            validationError && validationError.includes("grams")
              ? validationError
              : unitMode === "unit"
                ? "Calculated from the base unit"
                : "Enter a number up to 4 decimal places"
          }
          fullWidth
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
        >
          {mode === "edit" ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type UnitEditProps = {
  ingredient: IngredientRead & { shoppingUnitId?: number | string | null };
  dispatch: React.Dispatch<{ type: string; payload?: unknown }>;
  needsClearForm: boolean;
};

function UnitEdit({ ingredient, dispatch, needsClearForm }: UnitEditProps) {
  const [dialogMode, setDialogMode] = useState<UnitDialogProps["mode"]>("add");
  const [showDialog, setShowDialog] = useState(false);

  const units = useMemo(() => ingredient.units ?? [], [ingredient.units]);

  const selectedUnit = useMemo(() => {
    const target = ingredient.shoppingUnitId;

    if (target === null || target === undefined) {
      return units.find((unit) => unit.id === null || unit.id === undefined) ?? null;
    }

    return (
      units.find((unit) => {
        if (unit.id === null || unit.id === undefined) {
          return false;
        }
        return String(unit.id) === String(target);
      }) ?? null
    );
  }, [ingredient.shoppingUnitId, units]);

  const handleSelectedUnitChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const { value } = event.target;
      const normalizedValue =
        value === NULL_UNIT_VALUE || value === "" || value === undefined ? null : value;
      const matchingUnit =
        units.find((unit) => {
          if (unit.id == null && normalizedValue == null) return true;
          if (unit.id == null || normalizedValue == null) return false;
          return String(unit.id) === String(normalizedValue);
        }) || null;
      const updatedUnitId = matchingUnit
        ? matchingUnit.id ?? normalizedValue
        : normalizedValue;
      dispatch({
        type: "SET_INGREDIENT",
        payload: { ...ingredient, shoppingUnitId: updatedUnitId ?? null },
      });
    },
    [dispatch, ingredient, units]
  );

  const handleAddUnit = useCallback(
    (name: string, grams: number) => {
      const tempId = generateUUID();
      const newUnit = {
        id: tempId,
        ingredient_id: ingredient.id,
        name: name.trim(),
        grams: grams,
      };
      dispatch({
        type: "SET_INGREDIENT",
        payload: {
          ...ingredient,
          units: [...units, newUnit],
          shoppingUnitId: tempId,
        },
      });
    },
    [dispatch, ingredient, units]
  );

  const handleEditUnit = useCallback(
    (name: string, grams: number) => {
      if (!selectedUnit) return;

      const updatedUnits = units.map((unit) => {
        if (unit.id == null && selectedUnit.id == null) {
          return unit === selectedUnit ? { ...unit, name, grams } : unit;
        }
        if (unit.id == null || selectedUnit.id == null) {
          return unit;
        }
        return String(unit.id) === String(selectedUnit.id) ? { ...unit, name, grams } : unit;
      });

      dispatch({
        type: "SET_INGREDIENT",
        payload: {
          ...ingredient,
          units: updatedUnits,
        },
      });
    },
    [dispatch, ingredient, selectedUnit, units]
  );

  const handleRemoveUnit = useCallback(() => {
    if (!selectedUnit) return;

    const filteredUnits = units.filter((unit) => {
      if (unit.id == null && selectedUnit.id == null) {
        return unit !== selectedUnit;
      }
      if (unit.id == null || selectedUnit.id == null) {
        return true;
      }
      return String(unit.id) !== String(selectedUnit.id);
    });

    const nextUnit = filteredUnits[0] ?? null;
    dispatch({
      type: "SET_INGREDIENT",
      payload: {
        ...ingredient,
        units: filteredUnits,
        shoppingUnitId: nextUnit ? nextUnit.id ?? null : null,
      },
    });
  }, [dispatch, ingredient, selectedUnit, units]);

  const handleDialogSubmit = useCallback(
    (name: string, grams: number) => {
      if (dialogMode === "edit") {
        handleEditUnit(name, grams);
      } else {
        handleAddUnit(name, grams);
      }
    },
    [dialogMode, handleAddUnit, handleEditUnit]
  );

  useEffect(() => {
    if (needsClearForm) {
      dispatch({
        type: "SET_INGREDIENT",
        payload: { ...ingredient, units: [], shoppingUnitId: null },
      });
    }
  }, [needsClearForm, dispatch, ingredient]);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Unit
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Select
          labelId="unit-select-label"
          id="unit-select"
          value={
            ingredient.shoppingUnitId == null
              ? NULL_UNIT_VALUE
              : String(ingredient.shoppingUnitId)
          }
          onChange={handleSelectedUnitChange}
          fullWidth
          size="small"
        >
          {units.map((unit) => (
            <MenuItem
              key={unit.id ?? `unit-${unit.name}`}
              value={unit.id == null ? NULL_UNIT_VALUE : String(unit.id)}
            >
              {unit.name}
            </MenuItem>
          ))}
        </Select>
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-start" }}>
          <Button
            variant="outlined"
            onClick={() => {
              setDialogMode("add");
              setShowDialog(true);
            }}
          >
            Add
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              if (!selectedUnit) return;
              setDialogMode("edit");
              setShowDialog(true);
            }}
            disabled={!selectedUnit}
          >
            Edit
          </Button>
          <Button variant="outlined" color="error" onClick={handleRemoveUnit} disabled={!selectedUnit}>
            Remove
          </Button>
        </Box>
      </Box>
      <UnitDialog
        open={showDialog}
        mode={dialogMode}
        initialUnit={dialogMode === "edit" ? selectedUnit : null}
        units={units}
        onClose={() => setShowDialog(false)}
        onSubmit={handleDialogSubmit}
      />
    </Box>
  );
}

export default UnitEdit;
