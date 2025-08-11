// MacrosTable.js

import React, { useState, useEffect } from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";

import { formatCellNumber } from "./utils";

const MacrosTable = ({ meals, targets = {} }) => {
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
      meals.forEach((meal) => {
        const quantity = meal.quantity || 1;
        calories += quantity * meal.nutrition.calories;
        protein += quantity * meal.nutrition.protein;
        carbohydrates += quantity * meal.nutrition.carbohydrates;
        fat += quantity * meal.nutrition.fat;
        fiber += quantity * meal.nutrition.fiber;
      });
      setTotalMacros({ calories, protein, carbohydrates, fat, fiber });
    };

    calculateTotalMacros();
  }, [meals]);

  const perDayMacros = {
    calories: totalMacros.calories / duration,
    protein: totalMacros.protein / duration,
    carbohydrates: totalMacros.carbohydrates / duration,
    fat: totalMacros.fat / duration,
    fiber: totalMacros.fiber / duration,
  };

  const remaining = {
    calories: (targets.calories || 0) - perDayMacros.calories,
    protein: (targets.protein || 0) - perDayMacros.protein,
    carbohydrates: (targets.carbohydrates || 0) - perDayMacros.carbohydrates,
    fat: (targets.fat || 0) - perDayMacros.fat,
    fiber: (targets.fiber || 0) - perDayMacros.fiber,
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
            <TableCell>Per Day</TableCell>
            <TableCell>{formatCellNumber(perDayMacros.calories)}</TableCell>
            <TableCell>{formatCellNumber(perDayMacros.protein)}</TableCell>
            <TableCell>{formatCellNumber(perDayMacros.carbohydrates)}</TableCell>
            <TableCell>{formatCellNumber(perDayMacros.fat)}</TableCell>
            <TableCell>{formatCellNumber(perDayMacros.fiber)}</TableCell>
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
