# ![Logo](https://github.com/LCLPYT/LCLPLauncher/blob/master/resources/img/logo.png "LCLPLauncher") LCLPLauncher
An electron app for managing LCLP's environments.

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
To assemble it, you will need to clone the LauncherLogic repository and build it manually according to the description specified there.
