import React, { useEffect } from "react";

import TagFilter from "@/components/common/TagFilter";
import { useData } from "@/contexts/DataContext";

function TagEdit({ ingredient, dispatch, needsClearForm }) {
  const {
    ingredientProcessingTags,
    ingredientGroupTags,
    ingredientOtherTags,
  } = useData();

  const allIngredientTags = [
    ...ingredientProcessingTags,
    ...ingredientGroupTags,
    ...ingredientOtherTags,
  ];

  const handleTagsChange = (newTags) => {
    dispatch({ type: "SET_INGREDIENT", payload: { ...ingredient, tags: newTags } });
  };

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
          <TagFilter
            tags={allIngredientTags}
            selectedTags={ingredient.tags || []}
            onChange={handleTagsChange}
            label="Tags"
          />
        </div>
      }
    </div>
  );
}

export default TagEdit;
