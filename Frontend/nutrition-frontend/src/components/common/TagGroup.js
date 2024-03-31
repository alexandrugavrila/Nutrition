import { ToggleButton, ToggleButtonGroup } from "@mui/material";

function TagGroup({ tags, selectedTags, onTagToggle, title }) {
  if (!tags || !selectedTags || !onTagToggle || !title) {
    return null; // Return null if any required props are null
  }

  return (
    <div>
      <h3>{title}</h3>
      <ToggleButtonGroup
        value={selectedTags}
        onChange={onTagToggle}
        aria-label="tags"
        style={{ flexDirection: "row" }}>
        {tags.map((tag) => (
          <ToggleButton
            key={tag.id}
            value={tag.name}
            selected={selectedTags.some((selectedTag) => selectedTag.name === tag.name)}
            onClick={(event) => {
              event.preventDefault(); // Add this line to prevent the default behavior
              onTagToggle(tag);
            }}>
            {tag.name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

export default TagGroup;
