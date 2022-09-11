import { app } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { isDevelopment } from '../common/utils/env';
import { handleArgv } from './utils/argv';
import { getAppName } from './utils/env';

// accept code hot updates in development
if (module.hot) {
    module.hot.accept();
}

// set NODE_ENV correctly for react-router-dom, so it will work in production...
process.env['NODE_' + 'ENV'] = process.env.NODE_ENV;

// set app name manually, if in development environment
if (isDevelopment) {
    app.setName(`${getAppName()}-dev`);

    const devDataPath = path.resolve(path.dirname(app.getPath('userData')), app.getName());
    if (!fs.existsSync(devDataPath)) fs.mkdirSync(devDataPath);

    app.setPath('userData', devDataPath);
}

// configure logger
log.transports.console.level = 'info';
log.transports.file.level = 'verbose';
log.catchErrors({
    showDialog: false
});

// Handle program arguments
handleArgv().then(exitCode => {
    if (exitCode === undefined) {
        import('./gui').then(({startup}) => startup());
    }
    else process.exit(exitCode);
}).catch(err => {
    console.error('Error while handling program args:', err);
    process.exit(1);
});
