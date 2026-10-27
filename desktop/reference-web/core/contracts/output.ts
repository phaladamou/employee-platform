export type Artifact = {
  id: string;
  title: string;
  kind: "text" | "code" | "sheet" | "site";
  content: string;
};

export type CoreEvent =
  | { type: "status"; message: string }
  | { type: "text_delta"; text: string }
  | { type: "reasoning_delta"; text: string }
  | {
      type: "tool_started";
      toolName: string;
      toolCallId: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      toolCallId: string;
      output: unknown;
    }
  | {
      type: "environment_result";
      requestId: string;
      result: unknown;
    }
  | { type: "artifact"; artifact: Artifact }
  | { type: "done" }
  | { type: "error"; message: string };

export type CoreEventHandler = (event: CoreEvent) => void;