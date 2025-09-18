// FoodTable.js

import React, { useState, useMemo, useCallback } from "react";
import { Box, TextField, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, Collapse, Typography, TablePagination, Button, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowRight } from "@mui/icons-material";

import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";
import { createIngredientLookup, macrosForFood, macrosForIngredientPortion, ZERO_MACROS, findIngredientInLookup } from "@/utils/nutrition";
import TagFilter from "@/components/common/TagFilter";

function FoodTable({ onFoodDoubleClick = () => {}, onFoodCtrlClick = () => {} }) {
  //#region States
  const {
    foods,
    ingredients,
    foodDietTags,
    foodTypeTags,
    foodOtherTags,
    addPossibleFoodTag,
  } = useData();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [openAddTag, setOpenAddTag] = useState(false);
  const [open, setOpen] = React.useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const ingredientLookup = useMemo(() => createIngredientLookup(ingredients), [ingredients]);
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

  const calculateIngredientMacros = useCallback(
    (ingredient) => {
      if (!ingredient) return { ...ZERO_MACROS };
      const ingredientId = ingredient.ingredient_id;
      if (ingredientId === null || ingredientId === undefined) {
        return { ...ZERO_MACROS };
      }
      const dataIngredient = findIngredientInLookup(ingredientLookup, ingredientId);
      if (!dataIngredient) {
        return { ...ZERO_MACROS };
      }
      return macrosForIngredientPortion({
        ingredient: dataIngredient,
        unitId: ingredient.unit_id,
        quantity: ingredient.unit_quantity,
      });
    },
    [ingredientLookup]
  );

  const calculateFoodMacros = useCallback(
    (food) => macrosForFood(food, ingredientLookup),
    [ingredientLookup]
  );

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

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <TagFilter
            tags={allFoodTags}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            label="Filter tags"
          />
        </Box>
        <Button variant="outlined" onClick={() => setOpenAddTag(true)}>Add Tag</Button>
      </Box>

      <Dialog open={openAddTag} onClose={() => setOpenAddTag(false)}>
        <DialogTitle>Add Food Tag</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tag name"
            fullWidth
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && newTag.trim()) {
                const created = await addPossibleFoodTag(newTag);
                if (created) {
                  setSelectedTags((prev) => [...prev, created]);
                  setNewTag("");
                  setOpenAddTag(false);
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddTag(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const created = await addPossibleFoodTag(newTag);
              if (created) {
                setSelectedTags((prev) => [...prev, created]);
                setNewTag("");
                setOpenAddTag(false);
              }
            }}
            disabled={!newTag.trim()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

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
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).calories)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).protein)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).fat)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).carbs)}</TableCell>
                    <TableCell>{formatCellNumber(calculateFoodMacros(food).fiber)}</TableCell>
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
                              const dataIngredient =
                              findIngredientInLookup(ingredientLookup, ingredient.ingredient_id);
                              const unit =
                                dataIngredient?.units.find(
                                  (u) => u.id === ingredient.unit_id
                                ) ||
                                dataIngredient?.units.find((u) => u.grams === 1) ||
                                dataIngredient?.units[0];

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
















