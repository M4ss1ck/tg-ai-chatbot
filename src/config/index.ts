export const token = process.env.BOT_TOKEN;
export const adminId = process.env.ADMIN_ID;
export const apiKey = process.env.OPENROUTER_API_KEY;

export const aiModels = [
    {
        model: "google/gemini-2.0-pro-exp-02-05:free",
        name: "Gemini Pro 2.0 Experimental",
        image: true
    },
    {
        model: "qwen/qwen2.5-vl-72b-instruct:free",
        name: "Qwen2.5 VL 72B Instruct",
        image: true
    },
    {
        model: "deepseek/deepseek-r1-distill-llama-70b:free",
        name: "DeepSeek: R1 Distill Llama 70B",
        image: false
    },
    {
        model: "deepseek/deepseek-r1:free",
        name: "DeepSeek: R1",
        image: false
    },
    {
        model: "google/gemini-2.0-flash-thinking-exp:free",
        name: "Gemini 2.0 Flash Thinking Experimental 01-21",
        image: true
    },
]