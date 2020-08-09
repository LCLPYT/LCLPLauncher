let pressedKeys = [];

function addKeyListener() {
    if(document.keyListenerAdded) return;

    document.addEventListener("keydown", e => {
        if (!pressedKeys.includes(e.which)) pressedKeys.push(e.which);
  }, false);

  document.addEventListener("keyup", e => {
        if (!pressedKeys.includes(e.which)) return;
        let index = pressedKeys.indexOf(e.which);
        if (index >= 0) pressedKeys.splice(index, 1);
  }, false);

  document.keyListenerAdded = true;
}

function addDebugKeybinds() {
    addKeyListener();
    document.addEventListener("keydown", function (e) {
		if (e.which === 123 || (e.which === 73 && pressedKeys.includes(16) && pressedKeys.includes(17))) {
            require('electron').remote.getCurrentWindow().toggleDevTools();
            pressedKeys.length = 0;
		} else if (e.which === 116 || (e.which === 82 && pressedKeys.includes(17))) {
            location.reload();
            pressedKeys.length = 0;
		}
	});
}

exports.addDebugKeybinds = addDebugKeybinds;