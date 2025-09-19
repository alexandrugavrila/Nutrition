import { useCallback, useEffect, useReducer, useRef, useState, type Reducer, type SetStateAction } from "react";

const isBrowser = typeof window !== "undefined";

const readFromSessionStorage = <T,>(key: string): T | undefined => {
  if (!isBrowser) return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse sessionStorage key "${key}".`, error);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore removal errors
    }
    return undefined;
  }
};

const writeToSessionStorage = <T,>(key: string, value: T) => {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist sessionStorage key "${key}".`, error);
  }
};

export function useSessionStorageState<T>(
  key: string,
  initialState: T | (() => T),
) {
  const resolveInitialState = useCallback((): T => {
    const persisted = readFromSessionStorage<T>(key);
    if (persisted !== undefined) {
      return persisted;
    }
    return typeof initialState === "function"
      ? (initialState as () => T)()
      : initialState;
  }, [initialState, key]);

  const [state, setState] = useState<T>(resolveInitialState);

  const setPersistedState = useCallback(
    (value: SetStateAction<T>) => {
      setState((prev) =>
        typeof value === "function"
          ? (value as (previous: T) => T)(prev)
          : value,
      );
    },
    [],
  );

  useEffect(() => {
    writeToSessionStorage(key, state);
  }, [key, state]);

  return [state, setPersistedState] as const;
}

export function useSessionStorageReducer<S, A>(
  reducer: Reducer<S, A>,
  createInitialState: () => S,
  key: string,
) {
  const initializerRef = useRef(createInitialState);

  const initializer = useCallback((): S => {
    const baseState = initializerRef.current();
    const persisted = readFromSessionStorage<Partial<S>>(key);
    if (persisted && typeof persisted === "object") {
      return { ...baseState, ...persisted };
    }
    return baseState;
  }, [key]);

  const [state, dispatch] = useReducer(reducer, undefined as unknown as S, initializer);

  useEffect(() => {
    writeToSessionStorage(key, state);
  }, [key, state]);

  return [state, dispatch] as const;
}

