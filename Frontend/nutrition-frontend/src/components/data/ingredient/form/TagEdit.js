import React, { useEffect } from "react";

import IngredientTagForm from "../common/IngredientTagForm";

function TagEdit({ ingredient, dispatch, needsClearForm }) {
  const handleTagToggle = (tag) => {
    const newTags = ingredient.tags ? [...ingredient.tags] : [];
    const tagIndex = newTags.findIndex((t) => t.id === tag.id);
    if (tagIndex !== -1) {
      newTags.splice(tagIndex, 1);
    } else {
      newTags.push(tag);
    }
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
          <IngredientTagForm
            selectedTags={ingredient.tags}
            onTagToggle={handleTagToggle}
          />
        </div>
      }
    </div>
  );
}

export default TagEdit;
