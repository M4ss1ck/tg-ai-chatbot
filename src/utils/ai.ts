import type { BotContext } from "../context/botContext";
import { apiKey, aiModels, token } from "../config";
import axios from "axios";

export const processCommand = async (ctx: BotContext, message: string) => {
    if (!apiKey) {
        await ctx.reply("API key not set. Please contact the bot owner");
        return;
    }
    if (!ctx.msg) {
        await ctx.reply("Invalid context. Please contact the bot owner");
        return;
    }

    // check for history
    if (ctx.session.history.length === 0) {
        ctx.session.history.push(ctx.session.initialPrompt)
    }

    let model = ctx.session.model.model;
    let search = message

    // append replied-to message content
    if (ctx.msg.reply_to_message) {
        if ('text' in ctx.msg.reply_to_message) {
            search += "\n" + ctx.msg.reply_to_message.text;
        }
        else if ('caption' in ctx.msg.reply_to_message) {
            search += "\n" + ctx.msg.reply_to_message.caption;
        }
    }
    const sanitizedInput = encodeURIComponent(search);
    try {
        let content: any[] = [{
            type: "text",
            text: sanitizedInput
        }]
        // handle images
        if (ctx.msg.photo && ctx.msg.photo.length > 0) {
            const photo = ctx.msg.photo.pop()
            if (photo) {
                const file = await ctx.api.getFile(photo.file_id)
                const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`
                const response = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'arraybuffer'
                })
                const buffer = Buffer.from(response.data, 'binary').toString('base64')
                // check if model supports images
                const modelObj = aiModels.find(ai => ai.model === model)
                if (!modelObj || !modelObj.image) {
                    model = aiModels.find(ai => ai.image)?.model ?? aiModels[0].model
                }

                content.push({
                    type: "image_url",
                    image_url: {
                        url: buffer,
                    }
                })
            }
        }
        if (ctx.msg.reply_to_message && ctx.msg.reply_to_message.photo && ctx.msg.reply_to_message.photo.length > 0) {
            const photo = ctx.msg.reply_to_message.photo.pop()
            if (photo) {
                const file = await ctx.api.getFile(photo.file_id)
                const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`
                const response = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'arraybuffer'
                })
                const buffer = Buffer.from(response.data, 'binary').toString('base64')
                // check if model supports images
                const modelObj = aiModels.find(ai => ai.model === model)
                if (!modelObj || !modelObj.image) {
                    model = aiModels.find(ai => ai.image)?.model ?? aiModels[0].model
                }

                content.push({
                    type: "image_url",
                    image_url: {
                        url: buffer,
                    }
                })
            }
        }
        console.log("\n===========================\n")
        console.log(content)

        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions",
            {
                model,
                messages: [
                    ...ctx.session.history,
                    {
                        role: "user",
                        content,
                    }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const aiResponse = res.data?.choices?.[0].message.content;
        console.log("\n===========================\n")
        console.log(aiResponse)

        if (!aiResponse || typeof aiResponse !== 'string') throw new Error("No response from AI (Timeout?)");
        ctx.session.history.push({
            role: "assistant",
            content: aiResponse
        })

        // TODO: should I parse?
        const parsedResponse = aiResponse;

        // handle long responses
        if (parsedResponse.length > 4096) {
            const chunks = Math.ceil(parsedResponse.length / 4096)
            for (let i = 0; i < chunks; i++) {
                const index = 4096 * i
                await ctx.reply(parsedResponse.substring(index, index + 4096), {
                    reply_to_message_id: ctx.msg.message_id,
                    link_preview_options: {
                        is_disabled: true
                    },
                })
            }
        } else {
            await ctx.reply(parsedResponse, {
                reply_to_message_id: ctx.msg.message_id,
                link_preview_options: {
                    is_disabled: true
                },
            });
        }
    } catch (error) {
        console.error("Error calling OpenRouter API:", error);
        const msg = typeof error === 'object' && error && 'description' in error ? error.description as string : "Sorry, there was an error processing your request."
        await ctx.reply(msg, {
            reply_to_message_id: ctx.msg.message_id,
        });
    }
}