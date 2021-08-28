import * as fs from 'fs';
import { withBufferReadMethods } from "../../../utils/buffer";
import { UninstallMCProfile } from './UninstallMCProfile';
import { UninstallTracker } from './UninstallTracker';

export namespace UninstallTrackers {
    type TrackerFactory = (uninstallId: string, appId: number, vars: UninstallTracker.Variables, reuseStream?: fs.ReadStream) => UninstallTracker.Reader;

    const TRACKER_READERS = new Map<UninstallTracker.Type, TrackerFactory>([
        [
            UninstallTracker.Type.REMOVE_MC_PROFILE,
            (uninstallId, appId, vars, reuseStream) => new (UninstallMCProfile.Reader.getConstructor())(uninstallId, appId, vars, reuseStream)
        ]
    ]);
    
    /** Tracker reader to determine tracker type */
    class DummyTrackerReader extends UninstallTracker.Reader {
        public static getConstructor() {
            return withBufferReadMethods(DummyTrackerReader);
        }
    
        public async toActualReader<T extends UninstallTracker.Reader>(): Promise<T> {
            await this.openFile();
            let header: UninstallTracker.Header | undefined;
            try {
                header = this.readHeader();
            } catch (err) {
                await this.deleteFile();
                throw err;
            }
    
            if (!header) {
                await this.deleteFile();
                throw new Error('Could not read header.');
            }
    
            const readerFactory = TRACKER_READERS.get(header.type);
            if (!readerFactory) throw new TypeError(`No reader factory defined for artifact type '${header.type}'`);
    
            return <T> readerFactory(this.uninstallId, this.appId, this.vars, this.stream); // reuse this stream, therefore do not close the file here.
        }
    
        public readContent(): Promise<void> {
            throw new Error('Method not implemented.');
        }
        public uninstall(): Promise<void> {
            throw new Error('Method not implemented.');
        }
    }
    
    export async function createReader<T extends UninstallTracker.Reader>(uninstallId: string, appId: number, vars: UninstallTracker.Variables): Promise<T> {
        const constructor = DummyTrackerReader.getConstructor();
        const dummyReader = new constructor(uninstallId, appId, vars);
        return await dummyReader.toActualReader<T>();
    }
}