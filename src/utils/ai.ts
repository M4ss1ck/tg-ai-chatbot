import type { BotContext } from "../context/botContext.js";
import { apiKey, aiModels, token, adminId, cloudflareApiToken, cloudflareAccountId } from "../config/index.js";
import { premiumService } from "../services/premium.js";
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

    // Premium model access validation
    const currentModelObj = aiModels.find(ai => ai.model === model);
    if (currentModelObj?.premium) {
        const userId = ctx.from?.id?.toString();
        if (!userId) {
            await ctx.reply("Unable to verify user identity. Please try again.", {
                reply_to_message_id: ctx.msg.message_id,
            });
            return;
        }

        // Check if user is admin (automatic premium access)
        const isAdmin = adminId && userId === adminId;

        // Check premium status if not admin
        let isPremium = isAdmin;
        if (!isAdmin) {
            try {
                isPremium = await premiumService.instance.isPremiumUser(userId);
            } catch (error) {
                console.error("Error checking premium status:", error);
                await ctx.reply("Unable to verify premium access. Please try again later.", {
                    reply_to_message_id: ctx.msg.message_id,
                });
                return;
            }
        }

        if (!isPremium) {
            // User lost premium access or never had it - fallback to free model
            const fallbackModel = aiModels.find(ai => !ai.premium);
            if (fallbackModel) {
                ctx.session.model = fallbackModel;
                model = fallbackModel.model;

                await ctx.reply(
                    `⚠️ You don't have access to premium models. I've switched you to ${fallbackModel.name} instead.\n\n` +
                    "To access premium models, please contact an administrator.",
                    {
                        reply_to_message_id: ctx.msg.message_id,
                    }
                );
            } else {
                await ctx.reply("No free models available. Please contact the bot owner.", {
                    reply_to_message_id: ctx.msg.message_id,
                });
                return;
            }
        }
    }

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
                    // Find an image-supporting model that user has access to
                    const userId = ctx.from?.id?.toString();
                    const isAdmin = adminId && userId === adminId;
                    let isPremium = isAdmin;

                    if (!isAdmin && userId) {
                        try {
                            isPremium = await premiumService.instance.isPremiumUser(userId);
                        } catch (error) {
                            console.error("Error checking premium status for image fallback:", error);
                            isPremium = false;
                        }
                    }

                    // Find appropriate fallback model
                    const fallbackModel = aiModels.find(ai =>
                        ai.image && (isPremium || !ai.premium)
                    );

                    if (fallbackModel) {
                        model = fallbackModel.model;
                        ctx.session.model = fallbackModel;
                    } else {
                        // No image-supporting model available, use first available model
                        const availableModel = aiModels.find(ai => isPremium || !ai.premium);
                        model = availableModel?.model ?? aiModels[0].model;
                        if (availableModel) {
                            ctx.session.model = availableModel;
                        }
                    }
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
                    // Find an image-supporting model that user has access to
                    const userId = ctx.from?.id?.toString();
                    const isAdmin = adminId && userId === adminId;
                    let isPremium = isAdmin;

                    if (!isAdmin && userId) {
                        try {
                            isPremium = await premiumService.instance.isPremiumUser(userId);
                        } catch (error) {
                            console.error("Error checking premium status for replied image fallback:", error);
                            isPremium = false;
                        }
                    }

                    // Find appropriate fallback model
                    const fallbackModel = aiModels.find(ai =>
                        ai.image && (isPremium || !ai.premium)
                    );

                    if (fallbackModel) {
                        model = fallbackModel.model;
                        ctx.session.model = fallbackModel;
                    } else {
                        // No image-supporting model available, use first available model
                        const availableModel = aiModels.find(ai => isPremium || !ai.premium);
                        model = availableModel?.model ?? aiModels[0].model;
                        if (availableModel) {
                            ctx.session.model = availableModel;
                        }
                    }
                }

                content.push({
                    type: "image_url",
                    image_url: {
                        url: buffer,
                    }
                })
            }
        }
        ctx.session.history.push({
            role: "user",
            content,
        })

        // Handle different API endpoints based on provider
        const modelObj = aiModels.find(ai => ai.model === model);
        const provider = modelObj?.provider || "openrouter";

        let apiUrl: string;
        let headers: any;
        let requestBody: any;

        if (provider === "cloudflare") {
            if (!cloudflareApiToken || !cloudflareAccountId) {
                await ctx.reply("Cloudflare API credentials not configured. Please contact the bot owner.", {
                    reply_to_message_id: ctx.msg.message_id,
                });
                return;
            }

            // Cloudflare API structure
            apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/${model}`;
            headers = {
                "Authorization": `Bearer ${cloudflareApiToken}`,
                "Content-Type": "application/json"
            };

            // Cloudflare doesn't include model in request body, only messages
            requestBody = {
                messages: [
                    ...ctx.session.history,
                    {
                        role: "user",
                        content,
                    }
                ]
            };

            console.log(`Using Cloudflare model: ${model}`);
        } else {
            // Default to OpenRouter API
            apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            headers = {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            };

            requestBody = {
                model,
                messages: [
                    ...ctx.session.history,
                    {
                        role: "user",
                        content,
                    }
                ]
            };
        }

        const res = await axios.post(apiUrl, requestBody, { headers });

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