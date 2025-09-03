// IngredientTable.js

import React, { useState } from 'react';
import {
  Box,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  MenuItem,
  Select,
  TablePagination,
} from '@mui/material';

import { useData } from '@/contexts/DataContext';
import { formatCellNumber } from '@/utils/utils';
import TagFilter from '@/components/common/TagFilter';

function IngredientTable({ onIngredientDoubleClick = () => {}, onIngredientCtrlClick = () => {} }) {
  //#region States
  const { ingredients, setIngredients, ingredientTagsByGroup } = useData();

  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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
      ingredient.tags.some(({ name }) => name === selectedTag.name),
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
    const selectedUnitId = event.target.value; // Store only the id of the selected unit
    setIngredients((prevIngredients) =>
      prevIngredients.map((ingredient) =>
        ingredient.id === ingredientId
          ? {
              ...ingredient,
              selectedUnitId,
            }
          : ingredient,
      ),
    );
  };

  const handlePageChange = (event, newPage) => {
    setCurrentPage(newPage + 1);
  };

  const handleItemsPerPageChange = (event) => {
    setItemsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(1); // Reset to first page when items per page changes
  };
  //#endregion Handles

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const filteredIngredients = ingredients
    .filter((ingredient) => ingredient.name.toLowerCase().includes(search.toLowerCase()))
    .filter(handleTagFilter);
  const currentIngredients = filteredIngredients.slice(indexOfFirstItem, indexOfLastItem);

  const allIngredientTags = Object.values(ingredientTagsByGroup).flat();

  return (
    <div>
      <h1 style={{ textAlign: 'center' }}>Ingredients</h1>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <TextField type="text" label="Search by name" value={search} onChange={handleSearch} />
      </Box>

      <TagFilter
        tags={allIngredientTags}
        selectedTags={selectedTags}
        onChange={setSelectedTags}
        label="Filter tags"
      />

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
            {currentIngredients.map((ingredient) => (
              <TableRow
                key={ingredient.id}
                onDoubleClick={() => handleIngredientDoubleClick(ingredient)}
                onClick={(event) => handleIngredientClick(event, ingredient)}
              >
                <TableCell>{ingredient.name}</TableCell>
                <TableCell>
                  <Select
                    value={ingredient.selectedUnitId}
                    size="small"
                    onChange={(event) => handleUnitChange(event, ingredient.id)}
                    style={{ minWidth: '120px', display: 'inline-block' }}
                  >
                    {ingredient.units.map((unit) => (
                      <MenuItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  {formatCellNumber(
                    ingredient.nutrition.calories *
                      (ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId)
                        ?.grams || 1),
                  )}
                </TableCell>
                <TableCell>
                  {formatCellNumber(
                    ingredient.nutrition.protein *
                      (ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId)
                        ?.grams || 1),
                  )}
                </TableCell>
                <TableCell>
                  {formatCellNumber(
                    ingredient.nutrition.carbohydrates *
                      (ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId)
                        ?.grams || 1),
                  )}
                </TableCell>
                <TableCell>
                  {formatCellNumber(
                    ingredient.nutrition.fat *
                      (ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId)
                        ?.grams || 1),
                  )}
                </TableCell>
                <TableCell>
                  {formatCellNumber(
                    ingredient.nutrition.fiber *
                      (ingredient.units.find((unit) => unit.id === ingredient.selectedUnitId)
                        ?.grams || 1),
                  )}
                </TableCell>
              </TableRow>
            ))}
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
