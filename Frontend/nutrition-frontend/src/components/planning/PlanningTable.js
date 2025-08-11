// PlanningTable.js

import React from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Button } from "@mui/material";

import { formatCellNumber } from "./utils";

// Function to format the cell content

const PlanningTable = ({ meals, onPlanChange }) => {
  const handleRemove = (meal) => {
    const updatedMeals = meals.filter((m) => m !== meal);
    onPlanChange(updatedMeals);
  };

  const handleQuantityChange = (index, quantity) => {
    const updatedMeals = [...meals];
    updatedMeals[index] = { ...updatedMeals[index], quantity };
    onPlanChange(updatedMeals);
  };

  return (
    <div>
      <h1>Meal Plan</h1>
      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Meal</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {meals.map((meal, index) => (
            <TableRow key={index}>
              <TableCell>
                <Button variant="contained" color="error" onClick={() => handleRemove(meal)}>
                  Remove
                </Button>
              </TableCell>
              <TableCell>{meal.name}</TableCell>
              <TableCell>
                <input
                  type="number"
                  value={meal.quantity || 1}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                />
              </TableCell>
              <TableCell>{formatCellNumber(meal.quantity * meal.nutrition.calories)}</TableCell>
              <TableCell>{formatCellNumber(meal.quantity * meal.nutrition.protein)}</TableCell>
              <TableCell>{formatCellNumber(meal.quantity * meal.nutrition.carbohydrates)}</TableCell>
              <TableCell>{formatCellNumber(meal.quantity * meal.nutrition.fat)}</TableCell>
              <TableCell>{formatCellNumber(meal.quantity * meal.nutrition.fiber)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlanningTable;
