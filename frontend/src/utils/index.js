
// ---------- helpers ----------
export function prettyPrintSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(2)} ${sizes[i]}`;
}


export function getConfig() {
    return fetch("/config.json")
        .then(response => response.json())
        .catch(error => {
            console.error(error);
            return null;
        });
}
