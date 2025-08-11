// MacrosTable.js

import React, { useState, useEffect } from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

import { formatCellNumber } from "./utils";

const MacrosTable = ({ ingredients, targets = {} }) => {
  const [totalMacros, setTotalMacros] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });

  useEffect(() => {
    const calculateTotalMacros = () => {
      let calories = 0,
        protein = 0,
        carbohydrates = 0,
        fat = 0,
        fiber = 0;
      ingredients.forEach((ingredient) => {
        const quantity = ingredient.quantity || 1;
        calories += quantity * ingredient.nutrition.calories;
        protein += quantity * ingredient.nutrition.protein;
        carbohydrates += quantity * ingredient.nutrition.carbohydrates;
        fat += quantity * ingredient.nutrition.fat;
        fiber += quantity * ingredient.nutrition.fiber;
      });
      setTotalMacros({ calories, protein, carbohydrates, fat, fiber });
    };

    calculateTotalMacros();
  }, [ingredients]);

  const remaining = {
    calories: (targets.calories || 0) - totalMacros.calories,
    protein: (targets.protein || 0) - totalMacros.protein,
    carbohydrates: (targets.carbohydrates || 0) - totalMacros.carbohydrates,
    fat: (targets.fat || 0) - totalMacros.fat,
    fiber: (targets.fiber || 0) - totalMacros.fiber,
  };

  return (
    <div>
      <h1>Macros</h1>
      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Target</TableCell>
            <TableCell>{formatCellNumber(targets.calories || 0)}</TableCell>
            <TableCell>{formatCellNumber(targets.protein || 0)}</TableCell>
            <TableCell>{formatCellNumber(targets.carbohydrates || 0)}</TableCell>
            <TableCell>{formatCellNumber(targets.fat || 0)}</TableCell>
            <TableCell>{formatCellNumber(targets.fiber || 0)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>{formatCellNumber(totalMacros.calories)}</TableCell>
            <TableCell>{formatCellNumber(totalMacros.protein)}</TableCell>
            <TableCell>{formatCellNumber(totalMacros.carbohydrates)}</TableCell>
            <TableCell>{formatCellNumber(totalMacros.fat)}</TableCell>
            <TableCell>{formatCellNumber(totalMacros.fiber)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Remaining</TableCell>
            <TableCell>{formatCellNumber(remaining.calories)}</TableCell>
            <TableCell>{formatCellNumber(remaining.protein)}</TableCell>
            <TableCell>{formatCellNumber(remaining.carbohydrates)}</TableCell>
            <TableCell>{formatCellNumber(remaining.fat)}</TableCell>
            <TableCell>{formatCellNumber(remaining.fiber)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default MacrosTable;
