type UpdateCheckResult = {
    updateAvailable: boolean;
    mandatory?: boolean,
    versionName?: string
}

export default UpdateCheckResult;