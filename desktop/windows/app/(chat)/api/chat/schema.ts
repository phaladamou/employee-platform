import { z } from "zod";

const partSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  mediaType: z.string().optional(),
}).passthrough();

const attachmentSchema = z.object({
  url: z.string(),
  name: z.string(),
  contentType: z.string(),
}).passthrough();

const userMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
  attachments: z.array(attachmentSchema).optional().default([]),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(partSchema),
});

export const postRequestBodySchema = z.object({
  id: z.string(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  mode: z
    .enum(["research", "reasoning", "course", "search"])
    .optional()
    .nullable(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;