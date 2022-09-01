const DEFAULT_TTL = 30_000;

export class SingletonCache<T> {

    private value?: T;
    private time = 0;
    private ttl = DEFAULT_TTL;

    constructor(ttl = DEFAULT_TTL) {
        this.ttl = ttl;
    }

    set(value?: T) {
        this.value = value;
        this.time = Date.now();
    }

    get(): T | undefined {
        if (this.value === undefined || Date.now() - this.time > this.ttl) {
            return undefined;
        }

        return this.value;
    }
}