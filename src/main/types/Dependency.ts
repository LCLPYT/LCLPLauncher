import { SegmentedPath } from "./Installation"

export type DependencyDescriptor = {
    id: string,
    version: string,
}

export type DependencyInfo = DependencyDescriptor & SpecificInfo & {
    platform?: OSDependantInfo,
    dependencies?: DependencyDescriptor[]
}

export type DependencyFragment = DependencyDescriptor & {
    dependencies?: DependencyFragment[];
}

export type SpecificInfo = {
    url?: string,
    size?: number,
    md5?: string,
    itemTotalSize?: number,
    index?: SegmentedPath
}

export type OSDependantInfo = {
    [platform: string]: SpecificInfo
}