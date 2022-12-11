# LCLPLauncher
[![Open in Visual Studio Code](https://open.vscode.dev/badges/open-in-vscode.svg)](https://open.vscode.dev/LCLPYT/LCLPLauncher)
<br>
A manager for applications provided by LCLPNetwork.
<img align="right" src="https://i.imgur.com/VvTfYMJ.gif" alt="preview">

## For end-users
Download precompiled executables for your operating system from the official [download page](https://lclpnet.work/lclplauncher).

## For developers
In order to develop LCLPLauncher, use **Node 16**.
If you have [nvm](https://github.com/nvm-sh/nvm) installed, you can use.

```
nvm use
```

You may have to install Node 16 via nvm before:

```bash
nvm install <version>  # retrieve the current version from the .nvmrc file
```

### Building the app yourself
You'll need to have [Yarn](https://yarnpkg.com/) >= 3.1.0 installed.

First, install all dependencies with:
```bash
yarn
```

Then, you may simply build the app for your OS:
```bash
yarn dist
```

### Develop the application
You are free to modify the code as you would like. 

You can start a development server with code hot-swapping using:

```bash
yarn dev
```

Feel free to contribute to the project. If you want to distribute your forked version, please consider the notes below.

### Distributing your own version
If you don't want to contribute to the original repository, you may distribute binaries of your fork under **a different project name**.
In this case, please don't choose a name similar to "LCLPLauncher".
Use your own name to distinguish it from the original.

Please, **do not distribute LCLPLauncher** under the name "LCLPLauncher".
