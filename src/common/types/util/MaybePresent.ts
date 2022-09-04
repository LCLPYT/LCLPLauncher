import Supplier, { isSupplier } from "./Supplier";

type MaybePresent<T> = T | Supplier<T>;

export default MaybePresent;

export function makePresent<T>(present: MaybePresent<T>): T {
    if (isSupplier(present)) return present();
    return present;
}