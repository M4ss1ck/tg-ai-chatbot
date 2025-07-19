import { Composer } from "grammy";
import { BotContext } from "../context/botContext.js";
import { aiModels, aiPrompts } from "../config/index.js";

const aiActions = new Composer<BotContext>();

aiActions.callbackQuery(/set_model_(\d+)/i, async ctx => {
    if ('data' in ctx.callbackQuery && ctx.from?.id) {
        await ctx.answerCallbackQuery().catch(console.log)
        const [, indexString] = ctx.callbackQuery.data.match(/set_model_(\d+)/i) || [null, '1']
        const index = parseInt(indexString ?? '1')
        const selectedModel = aiModels[index]

        // Check if user is trying to select a premium model without premium access
        if (selectedModel.premium && !ctx.session.isPremium) {
            await ctx.reply("❌ Access denied. This is a premium model that requires special access. Please contact an admin to upgrade your account.")
            return
        }

        // Allow selection for free models or premium users accessing premium models
        ctx.session.model = selectedModel
        const premiumIndicator = selectedModel.premium ? " 🔒" : ""
        await ctx.reply(`Your AI model has been set to ${selectedModel.model}${premiumIndicator}`)
    }
})

aiActions.callbackQuery(/set_prompt_(\d+)/i, async ctx => {
    if ('data' in ctx.callbackQuery && ctx.from?.id) {
        await ctx.answerCallbackQuery().catch(console.log)
        const [, indexString] = ctx.callbackQuery.data.match(/set_prompt_(\d+)/i) || [null, '1']
        const index = parseInt(indexString ?? '1')
        const prompt = aiPrompts[index].text
        ctx.session.history = []
        ctx.session.initialPrompt = {
            role: "system",
            content: prompt
        }
        await ctx.reply(`Initial prompt has been set to:\n${prompt}`)
    }
})

export default aiActions;