import type { Context, SessionFlavor } from "grammy";
import { aiModels, aiPrompts } from "../config/index.js";

export interface Model {
    model: string
    name: string
    image: boolean
    premium: boolean
    provider: string
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
    content: (TextContent | ImageContent)[] | string
}

interface SessionData {
    model: Model
    availableModels: Model[]
    history: Message[]
    initialPrompt: Message
    isPremium: boolean
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function initial(): SessionData {
    return {
        model: aiModels[0],
        availableModels: aiModels,
        history: [],
        initialPrompt: {
            role: "system",
            content: aiPrompts[0].text
        },
        isPremium: false
    }
} 