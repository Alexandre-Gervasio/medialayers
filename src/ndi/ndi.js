const { spawn } = require('child_process');
const path = require('path');

// caminho do seu binário compilado
const ndiPath = path.join(__dirname, 'ndi_bridge');

const ndi = spawn(ndiPath);

// stdout (saída normal)
ndi.stdout.on('data', (data) => {
  console.log('[NDI]', data.toString());
});

// stderr (erros)
ndi.stderr.on('data', (data) => {
  console.error('[NDI ERROR]', data.toString());
});

// quando fecha
ndi.on('close', (code) => {
  console.log(`NDI process exited with code ${code}`);
});