import { MixinBufferReader, MixinBufferWriter } from "./buffer";
import { exists, mkdirp } from "./fshelper";
import { ReadStreamContainer, WriteStreamContainer } from "./streams";
import * as fs from 'fs';
import * as Path from 'path';

export namespace SimpleFile {
    abstract class AbstractBase<Vars> {
        protected readonly file: string;
        protected readonly vars: Vars;
    
        constructor(file: string, vars: Vars) {
            this.file = file;
            this.vars = vars;
        }
    
        protected abstract openFile(): Promise<void>;
    
        protected abstract closeFile(): void;
    
        protected abstract ensureFileNotOpen(): void;
    
        public getFile() {
            return this.file;
        }
    
        public doesFileExist() {
            return exists(this.getFile());
        }
    }
    
    export interface AbstractWriter<Vars> extends MixinBufferWriter {} // make the compiler aware of the mixin with declaration merging
    export abstract class AbstractWriter<Vars> extends AbstractBase<Vars> implements WriteStreamContainer {
        public stream?: fs.WriteStream;
    
        constructor(file: string, vars: Vars, reuseStream?: fs.WriteStream) {
            super(file, vars)
            if(reuseStream) this.stream = reuseStream;
        }
    
        protected async openFile() {
            if (this.stream) throw new Error('Trying to open a version safe file twice (write)');
    
            const file = this.getFile();
            await mkdirp(Path.dirname(file));
            this.stream = fs.createWriteStream(file);
        }
    
        protected closeFile() {
            if (!this.stream) return; // already closed
            this.stream.close();
            this.stream = undefined;
        }
    
        protected ensureFileNotOpen() {
            if (this.stream) throw new Error('File is already open (write)');
        }
    }
    
    export interface AbstractReader<Vars> extends MixinBufferReader {} // make the compiler aware of the mixin with declaration merging
    export abstract class AbstractReader<Vars> extends AbstractBase<Vars> implements ReadStreamContainer {
        public stream?: fs.ReadStream;
    
        constructor(file: string, vars: Vars, reuseStream?: fs.ReadStream) {
            super(file, vars);
            if(reuseStream) this.stream = reuseStream;
        }
    
        public async openFile() {
            if (this.stream) throw new Error('Trying to open a version safe file twice (read)');
    
            const file = this.getFile();
            if (!await exists(file)) throw new Error(`Version safe file does not exist: '${file}'`);
    
            this.stream = fs.createReadStream(file);
            await new Promise<void>(resolve => {
                if (!this.stream) throw new Error('File is not opened (read)');
                this.stream.on('readable', () => resolve());
            });
        }
    
        public closeFile(): void {
            if (!this.stream) return; // file is already closed
            this.stream.close();
            this.stream = undefined;
        }
    
        public isFileOpen(): boolean {
            return this.stream !== undefined;
        }
    
        protected ensureFileNotOpen() {
            if (this.stream) throw new Error('File is already open (read)');
        }
    
        public async deleteFile() {
            if (this.stream) this.closeFile();
            if(await exists(this.getFile())) await fs.promises.unlink(this.getFile());
        }
    }
}