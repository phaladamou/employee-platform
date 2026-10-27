import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { CliShell } from "@/components/cli/cli-shell";

export default function Page() {
  return (
    <ActiveChatProvider>
      <CliShell />
    </ActiveChatProvider>
  );
}
