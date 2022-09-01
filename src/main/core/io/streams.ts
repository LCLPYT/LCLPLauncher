import * as fs from 'fs';

export interface WriteStreamContainer {
    stream?: fs.WriteStream;
}

export interface ReadStreamContainer {
    stream?: fs.ReadStream;
}