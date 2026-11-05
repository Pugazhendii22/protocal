const fs = require('fs');
const path = require('path');
const root = '/home/user';
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  return '<script>\n' + code.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
});
html = html.replace('<title>', '<!-- single-file build: index.html + src/*.js inlined -->\n<title>');
fs.writeFileSync(path.join(root, 'protocol-explorer.html'), html);
console.log('wrote protocol-explorer.html', (html.length / 1024).toFixed(0) + ' KB');
