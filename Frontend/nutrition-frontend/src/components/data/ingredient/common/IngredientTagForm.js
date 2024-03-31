import TagGroup from "../../../common/TagGroup";
import { useData } from "../../../../contexts/DataContext";

function IngredientTagForm({ selectedTags, onTagToggle }) {
  const { ingredientProcessingTags, ingredientGroupTags, ingredientOtherTags } = useData();

  return (
    <div>
      <TagGroup
        tags={ingredientProcessingTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Processing"
      />
      <TagGroup
        tags={ingredientGroupTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Group Tags"
      />
      <TagGroup
        tags={ingredientOtherTags}
        selectedTags={selectedTags}
        onTagToggle={onTagToggle}
        title="Other Tags"
      />
    </div>
  );
}

export default IngredientTagForm;
