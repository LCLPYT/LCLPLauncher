import { remote } from 'electron';

export function closeCurrentWindow() {
    remote.getCurrentWindow().close();
}