import React, { useEffect, useMemo, useState } from "react";
import { TextField, type TextFieldProps } from "@mui/material";

const formatDecimal = (value: number, decimalPlaces: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Number.parseFloat(value.toFixed(decimalPlaces));
  const fixed = rounded.toFixed(decimalPlaces);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
};

type DecimalInputProps = Omit<TextFieldProps, "type" | "onChange" | "value" | "inputMode"> & {
  value: number;
  onValueChange: (value: number) => void;
  decimalPlaces?: number;
  allowNegative?: boolean;
};

const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onValueChange,
  decimalPlaces = 2,
  allowNegative = false,
  onFocus,
  onBlur,
  ...textFieldProps
}) => {
  const { inputProps, slotProps, ...restTextFieldProps } = textFieldProps;
  const [inputValue, setInputValue] = useState<string>(() =>
    formatDecimal(value, decimalPlaces),
  );
  const [lastEmittedValue, setLastEmittedValue] = useState<number>(value);

  const decimalPattern = useMemo(() => {
    return allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
  }, [allowNegative]);

  useEffect(() => {
    if (!Object.is(value, lastEmittedValue)) {
      setInputValue(formatDecimal(value, decimalPlaces));
      setLastEmittedValue(value);
    }
  }, [value, decimalPlaces, lastEmittedValue]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value: rawValue } = event.target;
    if (rawValue === "" || decimalPattern.test(rawValue)) {
      setInputValue(rawValue);
      const parsed = Number.parseFloat(rawValue);
      if (Number.isFinite(parsed)) {
        const rounded = Number.parseFloat(parsed.toFixed(decimalPlaces));
        setLastEmittedValue(rounded);
        onValueChange(rounded);
      }
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const trimmed = event.target.value.trim();
    let nextValue: number;

    if (trimmed === "") {
      nextValue = 0;
    } else {
      const parsed = Number.parseFloat(trimmed);
      if (!Number.isFinite(parsed)) {
        nextValue = 0;
      } else {
        const rounded = Number.parseFloat(parsed.toFixed(decimalPlaces));
        nextValue = allowNegative ? rounded : Math.max(0, rounded);
      }
    }

    setLastEmittedValue(nextValue);
    setInputValue(formatDecimal(nextValue, decimalPlaces));
    if (!Object.is(value, nextValue)) {
      onValueChange(nextValue);
    }

    if (onBlur) {
      onBlur(event);
    }
  };

  return (
    <TextField
      {...restTextFieldProps}
      type="number"
      slotProps={{
        ...slotProps,
        htmlInput: {
          ...(slotProps?.htmlInput ?? {}),
          ...(inputProps ?? {}),
          inputMode: "decimal",
        },
      }}
      value={inputValue}
      onChange={handleChange}
      onFocus={(event) => {
        if (onFocus) {
          onFocus(event);
        }
      }}
      onBlur={handleBlur}
    />
  );
};

export default DecimalInput;
