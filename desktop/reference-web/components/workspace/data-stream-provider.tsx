// components/workspace/data-stream-provider.tsx
"use client";

import type { DataUIPart } from "ai";
import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { CustomUIDataTypes } from "@/lib/types";

type ScientificTrace = CustomUIDataTypes["scientific-trace"];

type DataStreamContextValue = {
  dataStream: DataUIPart<CustomUIDataTypes>[];
  setDataStream: React.Dispatch<
    React.SetStateAction<DataUIPart<CustomUIDataTypes>[]>
  >;
  scientificTrace: ScientificTrace | null;
  setScientificTrace: React.Dispatch<React.SetStateAction<ScientificTrace | null>>;
};

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataStream, setDataStream] = useState<DataUIPart<CustomUIDataTypes>[]>([]);
  const [scientificTrace, setScientificTrace] = useState<ScientificTrace | null>(null);

  const value = useMemo(
    () => ({ dataStream, setDataStream, scientificTrace, setScientificTrace }),
    [dataStream, scientificTrace]
  );

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error("useDataStream must be used within a DataStreamProvider");
  }
  return context;
}