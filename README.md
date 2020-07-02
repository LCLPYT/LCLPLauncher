# ![Logo](https://github.com/LCLPYT/LCLPLauncher/blob/master/resources/img/logo.png "LCLPLauncher") LCLPLauncher
An electron app for managing LCLP's environments.

## Download
The LCLPLauncher installer can be downloaded from [here](https://lclpnet.work/lclplauncher/dl).

## Installing dependencies
`npm install`

## Run the app
`npm start`

## The "bin" directory
The bin dir does not exist in this repository, since it contains various runtimes e.g. a custom java runtime.
To use features of the app involving the /bin dir, please assemble it manually.

### Structure
```
bin
│
└───launcherlogic
    |   LauncherLogic.jar
    |   launcherlogic-forge_installer.jar
    |
    └───runtime (Java jlink runtime)
```
### Java jlink runtime
The runtime needed for this project is a custom image, created using jlink.
To assemble it, you will need to clone the [LauncherLogic](https://github.com/LCLPYT/LauncherLogic) repository and build it manually according to the [description specified there](https://github.com/LCLPYT/LauncherLogic/blob/master/README.md#java-jlink-runtime).
The launcherlogic-forge_installer.jar can be downloaded from [here](https://github.com/LCLPYT/LauncherLogicForgeInstaller/releases/latest/download/launcherlogic-forge_installer.jar).

## Building
The application can be built via [electron-builder](https://www.electron.build).<br>
To build it, simply type:
<br>
```npm run dist```
<br>

Currently, only Windows is supported.
