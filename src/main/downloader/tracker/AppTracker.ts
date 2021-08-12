import { ReadStreamContainer, WriteStreamContainer } from "../../utils/streams";
import { ERR_EOS } from "../../utils/constants";
import { BufferWrapper, MixinBufferReader, MixinBufferWriter, withBufferWriteMethods } from "../../utils/buffer";
import { AbstractTrackerReader, AbstractTrackerWriter, VersionError } from "./ArtifactTracker";

// if a tracker file has a version older than this string, it will be deleted and an update of the artifact will be required
const APP_TRACKER_VERSION = 4;

type TrackerHeader = {
    version: string;
    versionInt: number;
}

type AppTrackerVariables = {
    version: string;
    versionInt: number;
};

export interface TrackerWriter extends MixinBufferWriter {} // make the compiler aware of the mixin with declaration merging
export class TrackerWriter extends AbstractTrackerWriter<AppTrackerVariables> implements WriteStreamContainer {
    protected headerWritten = false;

    public static getConstructor() {
        return withBufferWriteMethods(TrackerWriter);
    }

    protected async writeHeader() {
        if (this.headerWritten) throw new Error('Trying to write a header while there was already one written.');

        const fixedBuffer = Buffer.alloc(4); // 32 bits
        fixedBuffer.writeInt16LE(APP_TRACKER_VERSION); // the version must always be written first
        fixedBuffer.writeInt16LE(this.vars.versionInt);

        const versionBuffer = BufferWrapper.wrapString(this.vars.version, 'utf8');

        await this.writeBuffer(Buffer.concat([fixedBuffer, versionBuffer]));
        this.headerWritten = true;
    }
}

export interface TrackerReader extends MixinBufferReader {} // make the compiler aware of the mixin with declaration merging
export abstract class TrackerReader extends AbstractTrackerReader<AppTrackerVariables> implements ReadStreamContainer {
    public readHeader(): [header: TrackerHeader | undefined, error: any] {
        if (!this.stream) throw new Error('File is not opened (read)');

        const versionBuffer = <Buffer | null>this.stream.read(2); // 16 bits; version is always the first two bytes
        if (!versionBuffer) throw ERR_EOS;
        const version = versionBuffer.readInt16LE();
        if (version < APP_TRACKER_VERSION) return [undefined, new VersionError(`Artifact tracker version is to old: ${version}; current: ${APP_TRACKER_VERSION}`)];
        else if (version > APP_TRACKER_VERSION) throw [undefined, new VersionError(`Artifact tracker version is to new: ${version}; current: ${APP_TRACKER_VERSION}; Consider an upgrade.`)];

        // version specific deserialization; above code should never break
        const lengthBuffer = <Buffer | null> this.stream.read(2); // 16 bits
        if (!lengthBuffer) throw ERR_EOS;

        return [{
            version: 'UNDEFINED',
            versionInt: version
        }, undefined];
    }

}