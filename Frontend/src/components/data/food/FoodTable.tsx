// FoodTable.js

import React, { useState } from "react";
import { Box, TextField, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, Collapse, Typography, TablePagination } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowRight } from "@mui/icons-material";

import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";
import TagFilter from "@/components/common/TagFilter";

function FoodTable({ onFoodDoubleClick = () => {}, onFoodCtrlClick = () => {} }) {
  //#region States
  const {
    foods,
    ingredients,
    foodDietTags,
    foodTypeTags,
    foodOtherTags,
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

  const handleTagFilter = (food) => {
    if (selectedTags.length === 0) {
      return true; // Show all foods if no tags are selected
    }
    if (!Array.isArray(food.tags) || food.tags.length === 0) {
      return false;
    }
    return selectedTags.some((selectedTag) =>
      food.tags.some(({ name }) => name === selectedTag.name)
    );
  };

  const handleFoodDoubleClick = (food) => {
    onFoodDoubleClick(food);
  };

  const handleFoodClick = (event, food) => {
    if (event.ctrlKey) {
      onFoodCtrlClick(food);
    } else {
      setOpen({ ...open, [food.id]: !open[food.id] });
    }
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage + 1);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filteredFoods = foods
    .filter((food) => food.name.toLowerCase().includes(search.toLowerCase()))
    .filter(handleTagFilter);
  const currentFoods = filteredFoods.slice(indexOfFirstItem, indexOfLastItem);

  const allFoodTags = [
    ...foodDietTags.map((tag) => ({ ...tag, group: "Diet" })),
    ...foodTypeTags.map((tag) => ({ ...tag, group: "Type" })),
    ...foodOtherTags.map((tag) => ({ ...tag, group: "Other" })),
  ];

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
        ? dataIngredient.nutrition.calories * dataUnit.grams * ingredient.unit_quantity
        : 0,
      protein: dataIngredient.nutrition.protein
        ? dataIngredient.nutrition.protein * dataUnit.grams * ingredient.unit_quantity
        : 0,
      fat: dataIngredient.nutrition.fat
        ? dataIngredient.nutrition.fat * dataUnit.grams * ingredient.unit_quantity
        : 0,
      carbs: dataIngredient.nutrition.carbohydrates
        ? dataIngredient.nutrition.carbohydrates * dataUnit.grams * ingredient.unit_quantity
        : 0,
      fiber: dataIngredient.nutrition.fiber
        ? dataIngredient.nutrition.fiber * dataUnit.grams * ingredient.unit_quantity
        : 0,
    };
  };

  const calculateFoodMacros = (food) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    let totalFiber = 0;

    food.ingredients.forEach((ingredient) => {
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
      <h1 style={{ textAlign: "center" }}>Foods</h1>

      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <TextField
          type="text"
          label="Search by name"
          value={search}
          onChange={handleSearch}
        />
      </Box>

      <TagFilter
        tags={allFoodTags}
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
            {currentFoods.map((food) => (
                <React.Fragment key={food.id}>
                  <TableRow
                    onDoubleClick={() => handleFoodDoubleClick(food)}
                    onClick={(event) => handleFoodClick(event, food)}>
                    <TableCell>{open[food.id] ? <KeyboardArrowDown /> : <KeyboardArrowRight />}</TableCell>
                    <TableCell>{food.name}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).totalCalories)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).totalProtein)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).totalFat)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).totalCarbs)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).totalFiber)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      style={{ paddingBottom: 0, paddingTop: 0 }}
                      colSpan={6}>
                      <Collapse
                        in={open[food.id]}
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
                            {food.ingredients.map((ingredient) => {
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
                                    {formatCellNumber(ingredient.unit_quantity)}
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
      <TablePagination
        component="div"
        count={filteredFoods.length}
        page={currentPage - 1}
        onPageChange={handlePageChange}
        rowsPerPage={itemsPerPage}
        onRowsPerPageChange={handleItemsPerPageChange}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </div>
  );
}
export default FoodTable;
