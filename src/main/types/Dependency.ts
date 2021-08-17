export type DependencyDescriptor = {
    id: string,
    version: string,
}

export type DependencyInfo = DependencyDescriptor & SpecificInfo & {
    platform?: OSDependantInfo,
    dependencies?: DependencyDescriptor[]
}

export type SpecificInfo = {
    url?: string,
    size?: number,
    md5?: string,
    itemTotalSize?: number
}

export type OSDependantInfo = {
    [platform: string]: SpecificInfo
}