import { Autocomplete, TextField, Chip } from "@mui/material";

/**
 * TagFilter renders a chip selector for tag objects.
 *
 * Tags can optionally contain a `group` field. When provided, options are
 * grouped in the dropdown using MUI's `groupBy` prop.
 *
 * Example tag object: `{ id: 1, name: "Vegan", group: "Diet" }`
 */
function TagFilter({ tags = [], selectedTags = [], onChange = () => {}, label = "Tags" }) {
  const hasGroups = tags.some((tag) => tag.group);

  return (
    <Autocomplete
      multiple
      options={tags}
      groupBy={hasGroups ? (option) => option.group : undefined}
      value={selectedTags}
      onChange={(event, newValue) => onChange(newValue)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip label={option.name} {...getTagProps({ index })} />
        ))
      }
      renderInput={(params) => (
        <TextField {...params} variant="outlined" label={label} placeholder="Select tags" />
      )}
    />
  );
}

export default TagFilter;
