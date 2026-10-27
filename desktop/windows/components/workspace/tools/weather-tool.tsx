import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
} from "@/components/ai-elements/tool";
import type { WeatherAtLocation } from "../weather";
import { Weather } from "../weather";

type WeatherPart = {
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  approval?: { id: string; approved?: boolean };
};

export function WeatherTool({
  part,
  addToolApprovalResponse,
}: {
  part: WeatherPart;
  addToolApprovalResponse?: (response: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;
}) {
  const { toolCallId, state } = part;
  const approvalId = part.approval?.id;
  const isDenied =
    state === "output-denied" ||
    (state === "approval-responded" && part.approval?.approved === false);
  const widthClass = "w-[min(100%,450px)]";

  if (state === "output-available") {
    return (
      <div className={widthClass} key={toolCallId}>
        <Weather
          weatherAtLocation={part.output as WeatherAtLocation | undefined}
        />
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state="output-denied" type="tool-getWeather" />
          <ToolContent>
            <div className="px-4 py-3 text-muted-foreground text-sm">
              Weather lookup was denied.
            </div>
          </ToolContent>
        </Tool>
      </div>
    );
  }

  if (state === "approval-responded") {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state={state as any} type="tool-getWeather" />
          <ToolContent>
            <ToolInput input={part.input} />
          </ToolContent>
        </Tool>
      </div>
    );
  }

  return (
    <div className={widthClass} key={toolCallId}>
      <Tool className="w-full" defaultOpen={true}>
        <ToolHeader state={state as any} type="tool-getWeather" />
        <ToolContent>
          {(state === "input-available" || state === "approval-requested") && (
            <ToolInput input={part.input} />
          )}
          {state === "approval-requested" &&
            approvalId &&
            addToolApprovalResponse && (
              <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                <button
                  className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    addToolApprovalResponse({
                      id: approvalId,
                      approved: false,
                      reason: "User denied weather lookup",
                    });
                  }}
                  type="button"
                >
                  Deny
                </button>
                <button
                  className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                  onClick={() => {
                    addToolApprovalResponse({
                      id: approvalId,
                      approved: true,
                    });
                  }}
                  type="button"
                >
                  Allow
                </button>
              </div>
            )}
        </ToolContent>
      </Tool>
    </div>
  );
}
