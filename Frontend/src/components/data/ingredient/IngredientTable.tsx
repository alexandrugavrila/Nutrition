// IngredientTable.js

import React, { useState } from "react";
import { Box, TextField, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, MenuItem, Select, TablePagination, Button, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

import { useData } from "@/contexts/DataContext";
import { formatCellNumber } from "@/utils/utils";
import TagFilter from "@/components/common/TagFilter";

function IngredientTable({ onIngredientDoubleClick = () => {}, onIngredientCtrlClick = () => {} }) {
  //#region States
  const {
    ingredients,
    setIngredients,
    ingredientProcessingTags,
    ingredientGroupTags,
    ingredientOtherTags,
    addPossibleIngredientTag,
  } = useData();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [newTag, setNewTag] = useState("");
  const [openAddTag, setOpenAddTag] = useState(false);
  //#endregion States

  //#region Handles
  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const handleTagFilter = (ingredient) => {
    if (selectedTags.length === 0) {
      return true; // Show all ingredients if no tags are selected
    }
    return selectedTags.some((selectedTag) =>
      ingredient.tags.some(({ name }) => name === selectedTag.name)
    );
  };

  const handleIngredientDoubleClick = (ingredient) => {
    onIngredientDoubleClick(ingredient);
  };

  const handleIngredientClick = (event, ingredient) => {
    if (event.ctrlKey) {
      onIngredientCtrlClick(ingredient);
    }
  };

  const handleUnitChange = (event, ingredientId) => {
    const rawValue = event.target.value;
    let selectedUnitId = null;
    if (rawValue !== "" && rawValue !== null && rawValue !== undefined) {
      if (typeof rawValue === "number") {
        selectedUnitId = rawValue;
      } else {
        const parsed = Number(rawValue);
        selectedUnitId = Number.isNaN(parsed) ? null : parsed;
      }
    }
    setIngredients((prevIngredients) =>
      prevIngredients.map((ingredient) =>
        ingredient.id === ingredientId
          ? {
              ...ingredient,
              selectedUnitId,
            }
          : ingredient
      )
    );
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage + 1);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(1); // Reset to first page when items per page changes
  };
  const resolveSelectedUnit = (ingredient) => {
    if (!ingredient.units || ingredient.units.length === 0) {
      return null;
    }
    const selectedId = ingredient.selectedUnitId;
    if (selectedId === null || selectedId === undefined || selectedId === "") {
      return (
        ingredient.units.find((unit) => unit.name === "g" && unit.grams === 1) ||
        ingredient.units.find((unit) => unit.grams === 1) ||
        ingredient.units[0]
      );
    }
    const numericId =
      typeof selectedId === "number" ? selectedId : Number(selectedId);
    if (!Number.isNaN(numericId)) {
      const match = ingredient.units.find((unit) => unit.id === numericId);
      if (match) {
        return match;
      }
    }
    // Fall back to the 1g entry when the backend sends a synthetic unit without an id.
    return (
      ingredient.units.find((unit) => unit.name === "g" && unit.grams === 1) ||
      ingredient.units.find((unit) => unit.grams === 1) ||
      ingredient.units[0]
    );
  };
  //#endregion Handles

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filteredIngredients = ingredients
    .filter((ingredient) => ingredient.name.toLowerCase().includes(search.toLowerCase()))
    .filter(handleTagFilter);
  const currentIngredients = filteredIngredients.slice(indexOfFirstItem, indexOfLastItem);

  const allIngredientTags = [
    ...ingredientProcessingTags.map((tag) => ({ ...tag, group: "Processing" })),
    ...ingredientGroupTags.map((tag) => ({ ...tag, group: "Group" })),
    ...ingredientOtherTags.map((tag) => ({ ...tag, group: "Other" })),
  ];

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>Ingredients</h1>

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
            tags={allIngredientTags}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
            label="Filter tags"
          />
        </Box>
        <Button variant="outlined" onClick={() => setOpenAddTag(true)}>Add Tag</Button>
      </Box>

      <Dialog open={openAddTag} onClose={() => setOpenAddTag(false)}>
        <DialogTitle>Add Ingredient Tag</DialogTitle>
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
                const created = await addPossibleIngredientTag(newTag);
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
              const created = await addPossibleIngredientTag(newTag);
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
              <TableCell>Name</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Calories</TableCell>
              <TableCell>Protein</TableCell>
              <TableCell>Carbs</TableCell>
              <TableCell>Fat</TableCell>
              <TableCell>Fiber</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentIngredients.map((ingredient) => {
              const selectedUnit = resolveSelectedUnit(ingredient);
              const gramsPerUnit = selectedUnit?.grams ?? 1;
              return (
                <TableRow
                  key={ingredient.id}
                  onDoubleClick={() => handleIngredientDoubleClick(ingredient)}
                  onClick={(event) => handleIngredientClick(event, ingredient)}>
                  <TableCell>{ingredient.name}</TableCell>
                  <TableCell>
                    <Select
                      value={ingredient.selectedUnitId ?? ""}
                      size="small"
                      displayEmpty
                      renderValue={() => selectedUnit?.name ?? ""}
                      onChange={(event) => handleUnitChange(event, ingredient.id)}
                      style={{ minWidth: "120px", display: "inline-block" }}>
                      {ingredient.units.map((unit) => (
                        <MenuItem
                          key={unit.id ?? `${ingredient.id}-${unit.name}`}
                          value={unit.id ?? ""}>
                          {unit.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>{formatCellNumber((ingredient.nutrition?.calories ?? 0) * gramsPerUnit)}</TableCell>
                  <TableCell>{formatCellNumber((ingredient.nutrition?.protein ?? 0) * gramsPerUnit)}</TableCell>
                  <TableCell>{formatCellNumber((ingredient.nutrition?.carbohydrates ?? 0) * gramsPerUnit)}</TableCell>
                  <TableCell>{formatCellNumber((ingredient.nutrition?.fat ?? 0) * gramsPerUnit)}</TableCell>
                  <TableCell>{formatCellNumber((ingredient.nutrition?.fiber ?? 0) * gramsPerUnit)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filteredIngredients.length}
        page={currentPage - 1}
        onPageChange={handlePageChange}
        rowsPerPage={itemsPerPage}
        onRowsPerPageChange={handleItemsPerPageChange}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </div>
  );
}

export default IngredientTable;
