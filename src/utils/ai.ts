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

        // Handle different API endpoints based on provider with fallback logic
        const modelObj = aiModels.find(ai => ai.model === model);
        const provider = modelObj?.provider || "openrouter";

        let apiUrl: string;
        let headers: any;
        let requestBody: any;
        let fallbackAttempted = false;

        const attemptApiCall = async (currentModel: string, currentProvider: string): Promise<any> => {
            if (currentProvider === "cloudflare") {
                if (!cloudflareApiToken || !cloudflareAccountId) {
                    throw new Error("Cloudflare API credentials not configured");
                }

                // Cloudflare API structure
                apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/${currentModel}`;
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

                console.log(`Using Cloudflare model: ${currentModel}`);
            } else {
                // Default to OpenRouter API
                apiUrl = "https://openrouter.ai/api/v1/chat/completions";
                headers = {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                };

                requestBody = {
                    model: currentModel,
                    messages: [
                        ...ctx.session.history,
                        {
                            role: "user",
                            content,
                        }
                    ]
                };
            }

            return await axios.post(apiUrl, requestBody, {
                headers,
                timeout: 30000, // 30 second timeout
            });
        };

        let res: any;
        let finalModel = model;
        let finalProvider = provider;

        try {
            res = await attemptApiCall(model, provider);
        } catch (error) {
            console.error(`Primary model ${model} failed:`, error);

            // Attempt fallback to a free model if the current model is premium and failed
            if (modelObj?.premium && !fallbackAttempted) {
                fallbackAttempted = true;

                // Find a suitable fallback model
                const userId = ctx.from?.id?.toString();
                const isAdmin = adminId && userId === adminId;
                let isPremium = isAdmin;

                if (!isAdmin && userId) {
                    try {
                        isPremium = await premiumService.instance.isPremiumUser(userId);
                    } catch (premiumError) {
                        console.error("Error checking premium status for fallback:", premiumError);
                        isPremium = false;
                    }
                }

                // Find the best fallback model
                const fallbackModel = aiModels.find(ai =>
                    !ai.premium && // Must be free
                    (!content.some(c => c.type === "image_url") || ai.image) // Must support images if needed
                );

                if (fallbackModel) {
                    console.log(`Falling back to model: ${fallbackModel.model}`);
                    finalModel = fallbackModel.model;
                    finalProvider = fallbackModel.provider || "openrouter";
                    ctx.session.model = fallbackModel;

                    try {
                        res = await attemptApiCall(finalModel, finalProvider);

                        // Notify user about the fallback
                        await ctx.reply(
                            `⚠️ The premium model "${modelObj.name}" is currently unavailable. I've switched to "${fallbackModel.name}" for this request.`,
                            { reply_to_message_id: ctx.msg.message_id }
                        );
                    } catch (fallbackError) {
                        console.error(`Fallback model ${finalModel} also failed:`, fallbackError);
                        throw new Error("Both primary and fallback models are currently unavailable. Please try again later.");
                    }
                } else {
                    throw new Error("Premium model is unavailable and no suitable fallback model found.");
                }
            } else {
                // Re-throw the original error if no fallback is possible
                throw error;
            }
        }

        const aiResponse = res.data?.choices?.[0]?.message?.content;
        console.log("\n===========================\n")
        console.log(aiResponse)

        if (!aiResponse || typeof aiResponse !== 'string') {
            throw new Error("No response from AI model. The service may be temporarily unavailable.");
        }

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
        console.error("Error in AI processing:", error);

        let errorMessage = "Sorry, there was an error processing your request.";

        if (error instanceof Error) {
            if (error.message.includes("Both primary and fallback models are currently unavailable")) {
                errorMessage = "🚫 **Service Unavailable**\n\nBoth the primary and backup AI models are currently unavailable. Please try again in a few minutes.";
            } else if (error.message.includes("Premium model is unavailable and no suitable fallback model found")) {
                errorMessage = "🚫 **Premium Model Unavailable**\n\nThe premium model you selected is currently unavailable and no suitable backup model was found. Please try selecting a different model using /model.";
            } else if (error.message.includes("No response from AI model")) {
                errorMessage = "⏱️ **No Response**\n\nThe AI model didn't respond. This might be due to high server load. Please try again.";
            } else if (error.message.includes("Cloudflare API credentials not configured")) {
                errorMessage = "⚙️ **Configuration Error**\n\nCloudflare API credentials are not properly configured. Please contact the bot administrator.";
            } else if (error.message.includes("Premium service temporarily unavailable")) {
                errorMessage = "🔧 **Premium Service Unavailable**\n\nThe premium user verification service is temporarily unavailable. Please try again later.";
            } else if (error.message.includes("timeout")) {
                errorMessage = "⏱️ **Request Timeout**\n\nThe AI model took too long to respond. Please try again with a shorter message or try a different model.";
            } else if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
                errorMessage = "🌐 **Connection Error**\n\nUnable to connect to the AI service. Please check your internet connection and try again.";
            } else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
                errorMessage = "🔑 **Authentication Error**\n\nAPI authentication failed. Please contact the bot administrator.";
            } else if (error.message.includes("429") || error.message.includes("rate limit")) {
                errorMessage = "🚦 **Rate Limited**\n\nToo many requests. Please wait a moment before trying again.";
            } else if (error.message.includes("500") || error.message.includes("502") || error.message.includes("503")) {
                errorMessage = "🔧 **Server Error**\n\nThe AI service is experiencing technical difficulties. Please try again later.";
            } else if (typeof error === 'object' && error && 'description' in error) {
                errorMessage = error.description as string;
            } else if (error.message) {
                errorMessage = `❌ **Error:** ${error.message}`;
            }
        }

        await ctx.reply(errorMessage, {
            reply_to_message_id: ctx.msg.message_id,
        });
    }
}