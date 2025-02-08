import type { Context, SessionFlavor } from "grammy";
import { aiModels } from "../config";

export interface Model {
    model: string
    name: string
    image: boolean
}

export interface TextContent {
    role: string
    text: string
}

export interface ImageContent {
    type: string
    image_url: {
        url: string
    }
}

export type Message = {
    role: string
    content: TextContent | ImageContent | string
}

interface SessionData {
    model: Model
    availableModels: Model[]
    history: Message[]
    initialPrompt: Message
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function initial(): SessionData {
    return {
        model: aiModels[0],
        availableModels: aiModels,
        history: [],
        initialPrompt: {
            role: "system",
            content: "You are a helpful assistant."
        }
    }
} 