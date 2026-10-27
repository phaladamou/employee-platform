import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { ComputerShell } from "@/components/computer/computer-shell";

export default function Page() {
  return (
    <ActiveChatProvider>
      <ComputerShell />
    </ActiveChatProvider>
  );
}
