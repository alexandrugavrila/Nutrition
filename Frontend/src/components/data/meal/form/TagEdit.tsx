import React, { useEffect } from "react";

import TagFilter from "@/components/common/TagFilter";
import { useData } from "@/contexts/DataContext";

function TagEdit({ meal, dispatch, needsClearForm }) {
  const { mealDietTags, mealTypeTags, mealOtherTags } = useData();

  const allMealTags = [
    ...mealDietTags.map((tag) => ({ ...tag, group: "Diet" })),
    ...mealTypeTags.map((tag) => ({ ...tag, group: "Type" })),
    ...mealOtherTags.map((tag) => ({ ...tag, group: "Other" })),
  ];

  const handleTagsChange = (newTags) => {
    dispatch({ type: "SET_MEAL", payload: { ...meal, tags: newTags } });
  };

  useEffect(() => {
    if (needsClearForm) {
      dispatch({ type: "SET_MEAL", payload: { ...meal, tags: [] } });
    }
  }, [needsClearForm, meal, dispatch]);

  return (
    <div>
      <TagFilter
        tags={allMealTags}
        selectedTags={meal.tags || []}
        onChange={handleTagsChange}
        label="Tags"
      />
    </div>
  );
}

export default TagEdit;
