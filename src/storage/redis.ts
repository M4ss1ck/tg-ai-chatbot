import { RedisAdapter } from "@grammyjs/storage-redis";
import IORedis from "ioredis";
import { redisUrl } from "../config";

if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
}

const redisInstance = new IORedis(redisUrl);

export const storage = new RedisAdapter({
    instance: redisInstance,
    ttl: 60 * 60 * 24 * 7, // 7 days
});