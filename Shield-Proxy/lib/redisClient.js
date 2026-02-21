const redis = require('redis');

let redisClient = null;
const useRedis = process.env.USE_REDIS === 'true';

const initRedis = async () => {
    if (useRedis && !redisClient) {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = redis.createClient({
            url,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('[Complex Shield-Redis] FATAL: Too many reconnect attempts. Shield will continue in memory-only mode.');
                        return new Error('Redis reconnect failed');
                    }
                    const delay = Math.min(retries * 100, 3000);
                    console.log(`[Complex Shield-Redis] Connection lost. Reconnecting in ${delay}ms... (Attempt ${retries})`);
                    return delay;
                }
            }
        });

        redisClient.on('error', (err) => console.error('[Complex Shield-Redis] Client Error:', err.message));
        redisClient.on('ready', () => console.log('[Complex Shield-Redis] Shield connection synchronized and ready.'));

        await redisClient.connect().catch(err => {
            console.error('[Complex Shield-Redis] Initial connection failed:', err.message);
        });
    }
    return redisClient;
};

const getRedisClient = () => redisClient;

module.exports = { initRedis, getRedisClient };
