import { Composer } from "grammy";
import { BotContext } from "../context/botContext.js";
import { aiModels } from "../config/index.js";

const aiActions = new Composer<BotContext>();

aiActions.callbackQuery(/set_model_(\d+)/i, async ctx => {
    if ('data' in ctx.callbackQuery && ctx.from?.id) {
        await ctx.answerCallbackQuery().catch(console.log)
        const [, indexString] = ctx.callbackQuery.data.match(/set_model_(\d+)/i) || [null, '1']
        const index = parseInt(indexString ?? '1')
        const model = aiModels[index].model
        ctx.session.model = aiModels[index]
        await ctx.reply(`Your AI model has been set to ${model}`)
    }
})

export default aiActions;