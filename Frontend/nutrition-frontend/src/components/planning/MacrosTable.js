// MacrosTable.js

import React, { useState, useEffect } from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

import { formatCellNumber } from "./utils";

const MacrosTable = ({ ingredients }) => {
  const [totalMacros, setTotalMacros] = useState({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  });

  useEffect(() => {
    // Calculate total macros when ingredients change
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

  return (
    <div>
      <h1>Total Macros</h1>
      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableCell>{formatCellNumber(totalMacros.calories)}</TableCell>
          <TableCell>{formatCellNumber(totalMacros.protein)}</TableCell>
          <TableCell>{formatCellNumber(totalMacros.carbohydrates)}</TableCell>
          <TableCell>{formatCellNumber(totalMacros.fat)}</TableCell>
          <TableCell>{formatCellNumber(totalMacros.fiber)}</TableCell>
        </TableBody>
      </Table>
    </div>
  );
};

export default MacrosTable;
