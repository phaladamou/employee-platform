// app/(chat)/websites/workspace/[id]/page.tsx
import { ChatShellWebsites } from "@/components/workspace/website-shell";
import { ActiveChatProvider } from "@/hooks/use-active-chat";

export default function WebsiteChatPage() {
  return (
    <ActiveChatProvider key="websites">
      <ChatShellWebsites key="websites" />
    </ActiveChatProvider>
  );
}