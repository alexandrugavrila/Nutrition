import { Autocomplete, TextField, Chip } from "@mui/material";

function TagFilter({ tags = [], selectedTags = [], onChange = () => {}, label = "Tags" }) {
  return (
    <Autocomplete
      multiple
      options={tags}
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
