import Redis from 'ioredis';
class InMemoryCache {
    store;
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        if (item.expiry < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }
    async setex(key, seconds, value) {
        this.store.set(key, {
            value,
            expiry: Date.now() + seconds * 1000,
        });
    }
    async del(...keys) {
        for (const key of keys) {
            this.store.delete(key);
        }
    }
    async keys(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(this.store.keys()).filter(key => regex.test(key));
    }
}
export class RedisCache {
    static instance;
    client;
    MESSAGE_EXPIRE_TIME = 60 * 60; // 1 hour
    CONTACT_EXPIRE_TIME = 60 * 60 * 24; // 24 hours
    MESSAGE_TTL = 3600; // 1 hour
    connected = false;
    constructor() {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
            console.log('Using in-memory cache for development');
            this.client = new InMemoryCache();
            this.connected = true;
        }
        else {
            this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
            this.client.on('error', (err) => {
                console.warn('Redis connection error:', err.message);
                this.connected = false;
            });
            this.client.on('connect', () => {
                console.log('Redis connected');
                this.connected = true;
            });
            this.client.on('reconnecting', () => {
                console.log('Redis reconnecting...');
            });
        }
    }
    static getInstance() {
        if (!RedisCache.instance) {
            RedisCache.instance = new RedisCache();
        }
        return RedisCache.instance;
    }
    async safeExecute(operation, defaultValue) {
        if (!this.connected) {
            return defaultValue;
        }
        try {
            return await operation();
        }
        catch (error) {
            console.error('Redis operation failed:', error);
            return defaultValue;
        }
    }
    getKey(params) {
        const parts = [];
        if (params.phoneNumber)
            parts.push(`phone:${params.phoneNumber}`);
        if (params.emailAddress)
            parts.push(`email:${params.emailAddress}`);
        return `messages:${parts.join(':')}`;
    }
    async getCachedMessages(params) {
        return this.safeExecute(async () => {
            const key = this.getKey(params);
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        }, null);
    }
    async cacheMessages(params, result) {
        await this.safeExecute(async () => {
            const key = this.getKey(params);
            await this.client.setex(key, this.MESSAGE_EXPIRE_TIME, JSON.stringify(result));
        }, undefined);
    }
    async getCachedContact(identifier) {
        return this.safeExecute(async () => {
            const key = `contact:${identifier}`;
            const cached = await this.client.get(key);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        }, null);
    }
    async cacheContact(identifier, data) {
        await this.safeExecute(async () => {
            const key = `contact:${identifier}`;
            await this.client.setex(key, this.CONTACT_EXPIRE_TIME, JSON.stringify(data));
        }, undefined);
    }
    async invalidateMessagesByPattern(identifier) {
        await this.safeExecute(async () => {
            const pattern = `messages:${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}*`;
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        }, undefined);
    }
    async invalidateContact(identifier) {
        await this.safeExecute(async () => {
            const key = `contact:${identifier}`;
            await this.client.del(key);
        }, undefined);
    }
}
//# sourceMappingURL=redis.js.map