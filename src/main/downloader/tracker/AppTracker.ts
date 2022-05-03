import { ERR_EOS } from "../../utils/constants";
import { BufferWrapper, withBufferReadMethods, withBufferWriteMethods } from "../../utils/buffer";
import { VersionError } from "./ArtifactTracker";
import { SimpleFile } from "../../utils/SimpleFile";
import { getAppTrackerFile } from "../../utils/fshelper";
import * as fs from 'fs';

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
const APP_TRACKER_VERSION = 0;

export namespace AppTracker {
    export type Variables = {
        version: string;
        versionInt: number;
    }

    export type Header = {
        version: string;
        versionInt: number;
    }

    export class Writer extends SimpleFile.AbstractWriter<Variables> {
        protected headerWritten = false;

        constructor(appId: number, vars: Variables, reuseStream?: fs.WriteStream) {
            super(getAppTrackerFile(appId), vars, reuseStream);
        }

        public static getConstructor() {
            return withBufferWriteMethods(Writer);
        }
    
        protected async writeHeader() {
            if (this.headerWritten) throw new Error('Trying to write a header while there was already one written.');
    
            const fixedBuffer = Buffer.alloc(4); // 32 bits
            fixedBuffer.writeInt16LE(APP_TRACKER_VERSION); // the version must always be written first
            fixedBuffer.writeInt16LE(this.vars.versionInt, 2); // offset manually
    
            const versionStringBuffer = BufferWrapper.wrapString(this.vars.version, 'utf8');
    
            await this.writeBuffer(Buffer.concat([fixedBuffer, versionStringBuffer]));
            this.headerWritten = true;
        }
    
        public async writeAppTracker() {
            await this.openFile();
            const err = await this.writeHeader().catch(err => err);
            this.closeFile(); // be sure to close the reader
            if (err) throw err;
        }
    }
    
    export class Reader extends SimpleFile.AbstractReader<Variables> {
        constructor(appId: number, vars: Variables, reuseStream?: fs.ReadStream) {
            super(getAppTrackerFile(appId), vars, reuseStream);
        }

        public static getConstructor() {
            return withBufferReadMethods(Reader);
        }

        public readHeader(): Header | undefined {
            if (!this.stream) throw new Error('File is not opened (read)');
    
            const versionBuffer = <Buffer | null> this.stream.read(2); // 16 bits; version is always the first two bytes
            if (versionBuffer === null) throw ERR_EOS;
            const version = versionBuffer.readInt16LE();
            if (version < APP_TRACKER_VERSION) throw new VersionError(`App tracker version is too old: ${version}; current: ${APP_TRACKER_VERSION}`);
            else if (version > APP_TRACKER_VERSION) throw new VersionError(`App tracker version is too new: ${version}; current: ${APP_TRACKER_VERSION}; Consider an upgrade.`);
    
            // version specific deserialization; above code should never break
            const versionIntBuffer = <Buffer | null> this.stream.read(2);
            if(versionIntBuffer === null) throw ERR_EOS;
            const versionInt = versionIntBuffer.readInt16LE();
            const versionString = this.readString();
    
            return {
                version: versionString,
                versionInt: versionInt
            };
        }
    }
}