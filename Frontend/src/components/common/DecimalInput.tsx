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
  const [inputValue, setInputValue] = useState<string>(() =>
    formatDecimal(value, decimalPlaces),
  );
  const [isFocused, setIsFocused] = useState(false);

  const decimalPattern = useMemo(() => {
    return allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
  }, [allowNegative]);

  useEffect(() => {
    if (isFocused) {
      return;
    }
    const formatted = formatDecimal(value, decimalPlaces);
    if (formatted !== inputValue) {
      setInputValue(formatted);
    }
  }, [value, decimalPlaces, isFocused, inputValue]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value: rawValue } = event.target;
    if (rawValue === "" || decimalPattern.test(rawValue)) {
      setInputValue(rawValue);
      const parsed = Number.parseFloat(rawValue);
      if (Number.isFinite(parsed)) {
        const rounded = Number.parseFloat(parsed.toFixed(decimalPlaces));
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

    setIsFocused(false);
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
      {...textFieldProps}
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={handleChange}
      onFocus={(event) => {
        setIsFocused(true);
        if (onFocus) {
          onFocus(event);
        }
      }}
      onBlur={handleBlur}
    />
  );
};

export default DecimalInput;
