import TagGroup from "../../../common/TagGroup";
import { useData } from "../../../../contexts/DataContext";

function MealTagForm({ selectedTags, onTagToggle }) {
  const { mealDietTags, mealTypeTags, mealOtherTags } = useData();

  return (
    <div>
      <TagGroup
        tags={mealDietTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Diet"
      />
      <TagGroup
        tags={mealTypeTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Type"
      />
      <TagGroup
        tags={mealOtherTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Other Tags"
      />
    </div>
  );
}

export default MealTagForm;
