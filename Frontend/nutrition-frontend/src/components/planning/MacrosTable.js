// MacrosTable.js

import React, { useState, useEffect } from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

import { formatCellNumber } from "./utils";

const MacrosTable = ({ ingredients, goals = {} }) => {
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
    calories: (goals.calories || 0) - totalMacros.calories,
    protein: (goals.protein || 0) - totalMacros.protein,
    carbohydrates: (goals.carbohydrates || 0) - totalMacros.carbohydrates,
    fat: (goals.fat || 0) - totalMacros.fat,
    fiber: (goals.fiber || 0) - totalMacros.fiber,
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
            <TableCell>Goal</TableCell>
            <TableCell>{formatCellNumber(goals.calories || 0)}</TableCell>
            <TableCell>{formatCellNumber(goals.protein || 0)}</TableCell>
            <TableCell>{formatCellNumber(goals.carbohydrates || 0)}</TableCell>
            <TableCell>{formatCellNumber(goals.fat || 0)}</TableCell>
            <TableCell>{formatCellNumber(goals.fiber || 0)}</TableCell>
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
