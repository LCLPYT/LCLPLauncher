type Supplier<T> = () => T;

export default Supplier;

export function isSupplier(x: any): x is Supplier<unknown> {
    return typeof x === 'function';
}