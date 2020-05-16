const fs = require("fs");

function getNavbarHTMLSync(filename) {
    let data = fs.readFileSync("./resources/navbar.html", "utf-8");
    return transform(data, filename);
}

function transform(string, filename) {
    return string.replace("#mark(" + filename + ")", "active").replace(/#mark\(([A-Za-z0-9./]+)\)/g, "");
}

exports.getNavbarHTMLSync = getNavbarHTMLSync;