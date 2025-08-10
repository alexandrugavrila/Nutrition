// MealTable.js

import React, { useState } from "react";
import { Button, TextField, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, Collapse, Typography, MenuItem, Select } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowRight } from "@mui/icons-material";

import { useData } from "../../../contexts/DataContext";
import { formatCellNumber } from "../../../utils/utils";
import TagFilter from "../../common/TagFilter";

function MealTable({ onMealDoubleClick = () => {}, onMealCtrlClick = () => {} }) {
  //#region States
  const {
    meals,
    ingredients,
    mealDietTags,
    mealTypeTags,
    mealOtherTags,
  } = useData();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [open, setOpen] = React.useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  //#endregion States

  //#region Handles
  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const handleTagFilter = (meal) => {
    if (selectedTags.length === 0) {
      return true; // Show all meals if no tags are selected
    }
    if (!Array.isArray(meal.tags) || meal.tags.length === 0) {
      return false;
    }
    return selectedTags.some((selectedTag) =>
      meal.tags.some((tag) => tag.name === selectedTag.name)
    );
  };

  const handleMealDoubleClick = (meal) => {
    onMealDoubleClick(meal);
  };

  const handleMealClick = (event, meal) => {
    if (event.ctrlKey) {
      onMealCtrlClick(meal);
    } else {
      setOpen({ ...open, [meal.id]: !open[meal.id] });
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMeals = meals
    .filter((meal) => meal.name.toLowerCase().includes(search.toLowerCase()))
    .filter(handleTagFilter)
    .slice(indexOfFirstItem, indexOfLastItem);

  const allMealTags = [...mealDietTags, ...mealTypeTags, ...mealOtherTags];

  const calculateIngredientMacros = (ingredient) => {
    const dataIngredient = ingredients.find(
      (item) => item.id === ingredient.ingredient_id
    );
    if (!dataIngredient) {
      return {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
      };
    }

    const dataUnit =
      dataIngredient.units.find((u) => u.id === ingredient.unit_id) ||
      dataIngredient.units[0];

    if (!dataUnit) {
      return {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
      };
    }

    return {
      calories: dataIngredient.nutrition.calories
        ? dataIngredient.nutrition.calories * dataUnit.grams * ingredient.amount
        : 0,
      protein: dataIngredient.nutrition.protein
        ? dataIngredient.nutrition.protein * dataUnit.grams * ingredient.amount
        : 0,
      fat: dataIngredient.nutrition.fat
        ? dataIngredient.nutrition.fat * dataUnit.grams * ingredient.amount
        : 0,
      carbs: dataIngredient.nutrition.carbohydrates
        ? dataIngredient.nutrition.carbohydrates * dataUnit.grams * ingredient.amount
        : 0,
      fiber: dataIngredient.nutrition.fiber
        ? dataIngredient.nutrition.fiber * dataUnit.grams * ingredient.amount
        : 0,
    };
  };

  const calculateMealMacros = (meal) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalFiber = 0;

    meal.ingredients.forEach((ingredient) => {
      const dataIngredient = ingredients.find((item) => item.id === ingredient.ingredient_id);
      if (dataIngredient) {
        totalCalories += calculateIngredientMacros(ingredient).calories;
        totalProtein += calculateIngredientMacros(ingredient).protein;
        totalFat += calculateIngredientMacros(ingredient).fat;
        totalCarbs += calculateIngredientMacros(ingredient).carbs;
        totalFiber += calculateIngredientMacros(ingredient).fiber;
      }
    });

    return {
      totalCalories,
      totalProtein,
      totalFat,
      totalCarbs,
      totalFiber,
    };
  };
  //#endregion Handles

  return (
    <div>
      <h1>Meals</h1>

      <TextField
        type="text"
        label="Search by name"
        value={search}
        onChange={handleSearch}
        style={{ marginBottom: "10px" }}
      />

      <TagFilter
        tags={allMealTags}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
        label="Filter tags"
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Calories</TableCell>
              <TableCell>Protein</TableCell>
              <TableCell>Fat</TableCell>
              <TableCell>Carbs</TableCell>
              <TableCell>Fiber</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentMeals.map((meal) => (
                <React.Fragment key={meal.id}>
                  <TableRow
                    onDoubleClick={() => handleMealDoubleClick(meal)}
                    onClick={(event) => handleMealClick(event, meal)}>
                    <TableCell>{open[meal.id] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}</TableCell>
                    <TableCell>{meal.name}</TableCell>
                    <TableCell>{formatCellNumber(calculateMealMacros(meal).totalCalories)}</TableCell>
                    <TableCell>{formatCellNumber(calculateMealMacros(meal).totalProtein)}</TableCell>
                    <TableCell>{formatCellNumber(calculateMealMacros(meal).totalFat)}</TableCell>
                    <TableCell>{formatCellNumber(calculateMealMacros(meal).totalCarbs)}</TableCell>
                    <TableCell>{formatCellNumber(calculateMealMacros(meal).totalFiber)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      style={{ paddingBottom: 0, paddingTop: 0 }}
                      colSpan={6}>
                      <Collapse
                        in={open[meal.id]}
                        timeout="auto"
                        unmountOnExit>
                        <Typography
                          variant="h6"
                          gutterBottom
                          component="div">
                          Ingredients
                        </Typography>
                        <Table
                          size="small"
                          aria-label="purchases">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Unit</TableCell>
                              <TableCell>Amount</TableCell>
                              <TableCell>Calories</TableCell>
                              <TableCell>Protein</TableCell>
                              <TableCell>Fat</TableCell>
                              <TableCell>Carbs</TableCell>
                              <TableCell>Fiber</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {meal.ingredients.map((ingredient) => {
                              const dataIngredient = ingredients.find(
                                (item) => item.id === ingredient.ingredient_id
                              );
                              const unit =
                                dataIngredient?.units.find(
                                  (u) => u.id === ingredient.unit_id
                                ) || dataIngredient?.units[0];

                              // Render the TableRow with TableCell containing the ingredient name
                              return (
                                <TableRow key={ingredient.ingredient_id}>
                                  <TableCell>
                                    {dataIngredient
                                      ? dataIngredient.name
                                      : "Unknown Ingredient"}
                                  </TableCell>
                                  <TableCell>{unit ? unit.name : ""}</TableCell>
                                  <TableCell>
                                    {formatCellNumber(ingredient.amount)}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(
                                      dataIngredient
                                        ? calculateIngredientMacros(ingredient).calories
                                        : 0
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(
                                      dataIngredient
                                        ? calculateIngredientMacros(ingredient).protein
                                        : 0
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(
                                      dataIngredient
                                        ? calculateIngredientMacros(ingredient).fat
                                        : 0
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(
                                      dataIngredient
                                        ? calculateIngredientMacros(ingredient).carbs
                                        : 0
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatCellNumber(
                                      dataIngredient
                                        ? calculateIngredientMacros(ingredient).fiber
                                        : 0
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <div style={{ marginTop: "10px" }}>
        <span>Items per page:</span>
        <Select
          value={itemsPerPage}
          onChange={handleItemsPerPageChange}>
          <MenuItem value={5}>5</MenuItem>
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={20}>20</MenuItem>
        </Select>
        <span style={{ marginLeft: "10px" }}>Page: {currentPage}</span>
        <Button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}>
          Previous
        </Button>
        <Button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={indexOfLastItem >= meals.length}>
          Next
        </Button>
      </div>
    </div>
  );
}
export default MealTable;
