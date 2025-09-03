import React, { useEffect } from "react";

import TagFilter from "@/components/common/TagFilter";
import { useData } from "@/contexts/DataContext";
import { Box } from "@mui/material";

function TagEdit({ ingredient, dispatch, needsClearForm }) {
  const { ingredientProcessingTags, ingredientGroupTags, ingredientOtherTags } = useData();

  const allIngredientTags = [
    ...ingredientProcessingTags,
    ...ingredientGroupTags,
    ...ingredientOtherTags,
  ];

  const handleTagsChange = (newTags) => {
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, tags: newTags } });
  };

  // Tag creation handled in IngredientTable; editor provides selection only.

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, tags: [] } });
    }
  }, [needsClearForm, ingredient, dispatch]);

  useEffect(() => {}, [ingredient]);

  return (
    <div>
      {
        <div>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <TagFilter
                tags={allIngredientTags}
                selectedTags={ingredient.tags || []}
                onChange={handleTagsChange}
                label="Tags"
              />
            </Box>
          </Box>
        </div>
      }
    </div>
  );
}

export default TagEdit;
