import { ERR_EOS } from "./constants";
import { MixinConstructor } from "./mixin";
import { ReadStreamContainer, WriteStreamContainer } from "./streams";

export interface MixinBufferWriter {
    writeString(str: string): Promise<void>;
    writeBoolean(bool: boolean): Promise<void>;
    writeBuffer(buffer: Buffer): Promise<void>;
}

export function withBufferWriteMethods<T extends MixinConstructor<WriteStreamContainer>>(Base: T) {
    return class BufferWriter extends Base implements MixinBufferWriter {
        // Mixin properties here
        public async writeString(str: string) {
            const pathBuffer = Buffer.from(str, 'utf8');
            const lengthBuffer = Buffer.alloc(2); // 16 bits
            lengthBuffer.writeInt16LE(pathBuffer.length);
    
            await this.writeBuffer(Buffer.concat([lengthBuffer, pathBuffer]));
        }
    
        public async writeBoolean(bool: boolean) {
            const buffer = Buffer.alloc(1); // 8 bits
            buffer.writeInt8(bool ? 1 : 0);
            await this.writeBuffer(buffer);
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
    return class BufferReader extends Base implements MixinBufferReader {
        // Mixin properties here
        public readString() {
            if (!this.stream) throw new Error('File is not opened (read)');
    
            const lengthBuffer = <Buffer | null>this.stream.read(2); // 16 bits
            if (!lengthBuffer) throw ERR_EOS;
            const length = lengthBuffer.readInt16LE();
            const buffer = <Buffer | null>this.stream.read(length);
            if (!buffer) throw ERR_EOS;
            return buffer.toString('utf8');
        }
    
        public readBoolean() {
            if (!this.stream) throw new Error('File is not opened (read)');

            const buffer = <Buffer | null>this.stream.read(1); // 16 bits
            if (!buffer) throw ERR_EOS;
            const boolNumber = buffer.readInt8();
            return boolNumber === 1;
        }
    };
}