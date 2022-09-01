import { SimpleFile } from "../../../core/io/SimpleFile";
import * as fs from 'fs';
import { getAppUninstallFile } from "../../../core/io/fshelper";
import { ERR_EOS } from "../../../utils/constants";
import { InputMap } from "../../../../common/types/InstallationInputResult";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
const TRACKER_VERSION = 1;

export namespace UninstallTracker {
    export type Variables = {
        inputMap?: InputMap
    }

    export abstract class Writer extends SimpleFile.AbstractWriter<Variables> {
        public readonly appId: number;
        public readonly uninstallId: string;
        protected headerWritten = false;
        protected uninstallType: Type;
    
        constructor(uninstallId: string, appId: number, vars: Variables, uninstallType: Type, reuseStream?: fs.WriteStream) {
            super(getAppUninstallFile(appId, uninstallId), vars, reuseStream);
            this.uninstallId = uninstallId;
            this.appId = appId;
            this.uninstallType = uninstallType;
        }
        
        protected async writeHeader(type: Type) {
            if (this.headerWritten) throw new Error('Trying to write a header while there was already one written.');
    
            const buffer = Buffer.alloc(4); // 32 bits
            buffer.writeInt16LE(TRACKER_VERSION); // the version must always be written first
            buffer.writeInt16LE(type, 2); // offset 2 bytes, because write always inserts at the beginning
    
            await this.writeBuffer(buffer);
            this.headerWritten = true;
        }

        public async writeContent() {
            await this.openFile();
            let err = await this.writeHeader(this.uninstallType).catch(err => err);
            if (err) {
                this.closeFile();
                throw err;
            }
            err = await this.writeSpecific().catch(err => err);
            this.closeFile(); // be sure to close the tracker
            if (err) throw err;
        }

        protected abstract writeSpecific(): Promise<void>;
    }
    
    export abstract class Reader extends SimpleFile.AbstractReader<Variables> {
        public readonly appId: number;
        public readonly uninstallId: string;
        protected type?: Type;
    
        constructor(uninstallId: string, appId: number, vars: Variables, reuseStream?: fs.ReadStream) {
            super(getAppUninstallFile(appId, uninstallId), vars, reuseStream);
            this.uninstallId = uninstallId;
            this.appId = appId;
        }
    
        public readHeader(): Header | undefined {
            if (!this.stream) throw new Error('File is not opened (read)');
            if (this.type) throw new Error('Trying to read a header while there was already one read.');
    
            const versionBuffer = <Buffer | null>this.stream.read(2); // 16 bits; version is always the first two bytes
            if (versionBuffer === null) throw ERR_EOS;
            const version = versionBuffer.readInt16LE();
            if (version < TRACKER_VERSION) throw new VersionError(`Artifact tracker version is too old: ${version}; current: ${TRACKER_VERSION}`);
            else if (version > TRACKER_VERSION) throw new VersionError(`Artifact tracker version is too new: ${version}; current: ${TRACKER_VERSION}; Consider an upgrade.`);
    
            // version specific deserialization; above code should never break
            const typeBuffer = <Buffer | null> this.stream.read(2); // 16 bits
            if (typeBuffer === null) throw ERR_EOS;
            const type = <Type> typeBuffer.readInt16LE();
    
            return {
                version: version,
                type: type
            };
        }

        public abstract readContent(): Promise<void>;

        public abstract uninstall(): Promise<void>;
    }
    
    export class VersionError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'VersionError';
        }
    }

    export enum Type {
        REMOVE_MC_PROFILE
    }

    export type Header = {
        version: number;
        type: Type;
    }

    export async function writeUninstallTracker(writer: Writer) {
        await writer.writeContent();
    }
}