import { RedisAdapter } from "@grammyjs/storage-redis";
import { Redis } from "ioredis";
import { redisUrl } from "../config/index.js";

if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
}

const redisInstance = new Redis(redisUrl);

export const storage = new RedisAdapter({
    instance: redisInstance,
    ttl: 60 * 60 * 24 * 7, // 7 days
});