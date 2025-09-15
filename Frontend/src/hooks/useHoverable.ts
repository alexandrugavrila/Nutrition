import { useCallback, useState } from "react";

type HoverBind = {
  onMouseEnter: React.MouseEventHandler;
  onMouseLeave: React.MouseEventHandler;
};

/**
 * Simple hoverable hook to reveal UI on hover.
 * Returns the current hovered state and mouse enter/leave binders.
 */
export default function useHoverable() {
  const [hovered, setHovered] = useState(false);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

  return { hovered, bind: { onMouseEnter, onMouseLeave } as HoverBind };
}

