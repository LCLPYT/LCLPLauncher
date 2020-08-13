# ![Logo](https://github.com/LCLPYT/LCLPLauncher/blob/master/resources/img/logo.png "LCLPLauncher") LCLPLauncher
An electron app for managing LCLP's environments.

## Download
The LCLPLauncher installer can be downloaded from [here](https://lclpnet.work/lclplauncher/dl).

<hr>

## Installation

<hr>

### Windows
Just execute the .exe file. The launcher will be installed and updated automatically.<br>
Your antivirus might warn you because of low reputation.

<hr>

### Linux
The recommended way of opening LCLPLauncher is the AppImage file format, since it requires no root and supports auto updating (by electron-builder).<br>This file format is a little different from standard .deb or .rpm files, so please read throught the following installation instructions carefully and, if needed, check the compatibility with AppImageLauncher on your system.

Download the AppImage file and open it like this:
```bash
# Download the AppImage
wget https://lclpnet.work/lclplauncher/dl-linux -O lclplauncher.AppImage 
# Make the AppImage executable
chmod a+x lclplauncher.AppImage
# Run the AppImage
./lclplauncher.AppImage
```
You have to start the AppImage every time you want to start the Launcher. (I'll explain a more convenient way after the additional requirements)

**Additional requirements (linux)**: Please make sure you have those installed for **playing Minecraft** with the mods (on windows, these ones are either bundled with the Minecraft Launcher or redundant at all):
- Java 8 (for Minecraft Launcher JRE)
- Python 2.6, 2.7, or 3.2+

<br>
To integrate LCLPLauncher fully to your system, I recommend using <a href="https://github.com/TheAssassin/AppImageLauncher/releases">AppImageLauncher</a>.

**PLEASE NOTE**: It is not at all recommended to use the full version of AppImageLauncher with Electron apps using electron-updater (at least at the moment) since the auto updater breaks with it.<br>
Instead of the full version, you can use **the lite version** of AppImageLauncher (*appimagelauncher-lite-&lt;version&gt;-&lt;build&gt;.AppImage* in a release) which also provides basic integration functionality.<br>
To integrate LCLPLauncher, use these commands:
```bash
# Make the downloaded appimagelauncher-lite executable; Please replace the filename with the actual one
chmod a+x appimagelauncher-lite-<version>-<build>.AppImage

# Install appimagelauncher-lite into your user account; Replace the filename again.
./appimagelauncher-lite[...].AppImage install

# Integrate LCLPLauncher to your system
./appimagelauncher-lite[...].AppImage cli integrate ./lclplauncher.AppImage
```

With that, LCLPLauncher should show up in the Applications menu.
It is recommended to add LCLPLauncher to your path in order for my update checker mod (LCLPUpdateChecker) to locate and auto open the launcher in case of an update.<br>
<br>
It is important, that the command `lclplauncher` opens the LCLPLauncher AppImage, which is now located inside the newly created ~/Applications folder (by AppImageLauncher).
In order to do that, you have to create a symlink to the AppImage:
```bash
cd ~/Applications
# Create the symbolic link; Please replace the source_file with the actual generated filename
ln -s lclplauncher_<hsh>.AppImage lclplauncher
```
After that, add the following lines to your `~/.profile`:
```bash
if [ -d "$HOME/Applications" ] ; then
    PATH="$HOME/Applications:$PATH"
fi
```
If you added the lines, the ~/Applications directory will be in your path and `lclplauncher` should start the launcher the next time you log in. (I recommend to restart your PC before playing)

<hr>
<br>
<br>

# For developers

## Installing dependencies
`npm install`

## Run the app
`npm start`

## Building
The application can be built via [electron-builder](https://www.electron.build).<br>
To build it, simply type:
<br>
```npm run dist```
<br>

Currently, Windows and Linux are supported.
