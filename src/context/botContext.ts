import type { Context, SessionFlavor } from "grammy";
import { aiModels } from "../config";

export interface Model {
    model: string
    name: string
    image: boolean
}

interface SessionData {
    model: Model
    availableModels: Model[]
    history: string[]
    initialPrompt: string
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function initial(): SessionData {
    return {
        model: aiModels[0],
        availableModels: aiModels,
        history: [],
        initialPrompt: ""
    }
} 