// app/api/settings/route.ts
import { auth } from "@/app/(auth)/auth";
import {
  deleteAllChatsByUserId,
  deleteUserById,
  getUser,
  getUserSettings,
  getUserStats,
  updateUserProfile,
  upsertUserSettings,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const [stats, settings, userRecord] = await Promise.all([
    getUserStats({ userId: session.user.id }),
    getUserSettings({ userId: session.user.id }),
    getUser(session.user.email ?? ""),
  ]);

  const currentUser = userRecord[0];

  return Response.json({
    user: {
      id: session.user.id,
      name: currentUser?.name ?? session.user.name ?? null,
      email: session.user.email ?? null,
      image: currentUser?.image ?? session.user.image ?? null,
      bio: currentUser?.bio ?? null,
      type: session.user.type,
      createdAt: currentUser?.createdAt?.toISOString() ?? null,
    },
    stats,
    preferences: settings?.preferences ?? {},
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { name, bio, image, preferences } = body;

  let updatedUser = null;

  if (name !== undefined || bio !== undefined || image !== undefined) {
    const result = await updateUserProfile({
      userId: session.user.id,
      name,
      bio,
      image,
    });

    updatedUser = result?.[0] ?? null;
  }

  if (preferences !== undefined) {
    await upsertUserSettings({
      userId: session.user.id,
      preferences,
    });
  }

  // Retourner l'utilisateur mis à jour pour que le client puisse mettre à jour la session
  return Response.json({ 
    success: true,
    user: updatedUser ? {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      bio: updatedUser.bio,
    } : null
  });
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  if (scope === "chats") {
    const result = await deleteAllChatsByUserId({ userId: session.user.id });
    return Response.json(result, { status: 200 });
  }

  if (scope === "account") {
    await deleteUserById({ userId: session.user.id });
    return Response.json({ success: true }, { status: 200 });
  }

  return Response.json({ error: "Invalid scope" }, { status: 400 });
}