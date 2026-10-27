import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { ChatShellChat } from "@/components/workspace/workspace-shell";

export default function Page() {
  return (
    <ActiveChatProvider>
      <ChatShellChat />
    </ActiveChatProvider>
  );
}
