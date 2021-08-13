import { ERR_EOS } from "./constants";
import { MixinConstructor } from "./mixin";
import { ReadStreamContainer, WriteStreamContainer } from "./streams";

export interface MixinBufferWriter {
    writeString(str: string): Promise<void>;
    writeBoolean(bool: boolean): Promise<void>;
    writeBuffer(buffer: Buffer): Promise<void>;
}

export function withBufferWriteMethods<T extends MixinConstructor<WriteStreamContainer>>(Base: T) {
    return class BufferWriterWrapper extends Base implements MixinBufferWriter {
        // Mixin properties here
        public async writeString(str: string) {
            await this.writeBuffer(BufferWrapper.wrapString(str, 'utf8'));
        }
    
        public async writeBoolean(bool: boolean) {
            await this.writeBuffer(BufferWrapper.wrapBoolean(bool));
        }
    
        public async writeBuffer(buffer: Buffer): Promise<void> {
            return new Promise<void>((resolve, reject) => {
                if (!this.stream) throw new Error('File is not opened (write)');
                this.stream.write(buffer, error => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    };
}

export interface MixinBufferReader {
    readString(): string;
    readBoolean(): boolean;
}

export function withBufferReadMethods<T extends MixinConstructor<ReadStreamContainer>>(Base: T) {
    return class BufferReaderWrapper extends Base implements MixinBufferReader {
        bufferSupplier: BufferUnwrapper.BufferSupplier = (bytes) => {
            if (!this.stream) throw new Error('File is not opened (read)');
            return this.stream.read(bytes);
        };

        // Mixin properties here
        public readString() {
            if (!this.stream) throw new Error('File is not opened (read)');
            return BufferUnwrapper.unwrapString(this.bufferSupplier);
        }
    
        public readBoolean() {
            if (!this.stream) throw new Error('File is not opened (read)');
            return BufferUnwrapper.unwrapBoolean(this.bufferSupplier);
        }
    };
}

export namespace BufferWrapper {
    export function wrapString(str: string, charset: BufferEncoding) {
        const pathBuffer = Buffer.from(str, charset);
        const lengthBuffer = Buffer.alloc(2); // 16 bits
        lengthBuffer.writeInt16LE(pathBuffer.length);

        return Buffer.concat([lengthBuffer, pathBuffer]);
    }

    export function wrapBoolean(bool: boolean) {
        const buffer = Buffer.alloc(1); // 8 bits
        buffer.writeInt8(bool ? 1 : 0);

        return buffer;
    }
}

export namespace BufferUnwrapper {
    export type BufferSupplier = (bytes: number) => Buffer | null

    export function unwrapString(bufferSupplier: BufferSupplier) {
        const lengthBuffer = <Buffer | null> bufferSupplier(2); // 16 bits
        if (lengthBuffer === null) throw ERR_EOS;
        const length = lengthBuffer.readInt16LE();
        const buffer = <Buffer | null> bufferSupplier(length);
        if (buffer === null) throw ERR_EOS;
        return buffer.toString('utf8');
    }

    export function unwrapBoolean(bufferSupplier: BufferSupplier) {
        const buffer = <Buffer | null> bufferSupplier(1); // 16 bits
        if (buffer === null) throw ERR_EOS;
        const boolNumber = buffer.readInt8();
        return boolNumber === 1;
    }
}