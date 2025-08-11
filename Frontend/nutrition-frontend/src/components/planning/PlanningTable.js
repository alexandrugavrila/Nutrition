// PlanningTable.js

import React from "react";
import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Button } from "@mui/material";

import { formatCellNumber } from "../../utils/utils";

// Function to format the cell content

const PlanningTable = ({ ingredients, onIngredientRemove }) => {
  const handleIngredientRemove = (ingredient) => {
    onIngredientRemove(ingredient);
  };

  const handleQuantityChange = (index, quantity) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[index].quantity = quantity;
    onIngredientRemove(updatedIngredients);
  };

  return (
    <div>
      <h1>Planning Table</h1>
      <Table component={Paper}>
        <TableHead>
          <TableRow>
            <TableCell></TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Calories</TableCell>
            <TableCell>Protein</TableCell>
            <TableCell>Carbs</TableCell>
            <TableCell>Fat</TableCell>
            <TableCell>Fiber</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ingredients.map((ingredient, index) => (
            <TableRow key={index}>
              <TableCell>
                <Button variant="contained" color="error" onClick={() => handleIngredientRemove(ingredient)}>
                  Remove
                </Button>
              </TableCell>
              <TableCell>{ingredient.name}</TableCell>
              <TableCell>
                <input type="number" value={ingredient.quantity || 1} onChange={(e) => handleQuantityChange(index, e.target.value)} />
              </TableCell>
              <TableCell>{formatCellNumber(ingredient.quantity * ingredient.nutrition.calories)}</TableCell>
              <TableCell>{formatCellNumber(ingredient.quantity * ingredient.nutrition.protein)}</TableCell>
              <TableCell>{formatCellNumber(ingredient.quantity * ingredient.nutrition.carbohydrates)}</TableCell>
              <TableCell>{formatCellNumber(ingredient.quantity * ingredient.nutrition.fat)}</TableCell>
              <TableCell>{formatCellNumber(ingredient.quantity * ingredient.nutrition.fiber)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlanningTable;
