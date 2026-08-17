const sharp = require('sharp');
const fs = require('fs');

// Tamaño estándar para capa de icono adaptativo Android (1084x1084)
const width = 1084;
const height = 1084;

// Definición de sombra difusa transparente sin fondo
const svgShadow = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="28" />
      <feOffset dx="0" dy="16" result="offsetblur" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.45" />
      </feComponentTransfer>
      <feMerge> 
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="542" cy="542" r="230" fill="#000000" filter="url(#shadow)" opacity="0.6" />
</svg>
`;

// Guardar en la carpeta assets/images/shadow.png
sharp(Buffer.from(svgShadow))
  .png()
  .toFile('./assets/images/shadow.png')
  .then(() => {
    console.log('✅ Archivo shadow.png creado con éxito en ./assets/images/shadow.png');
  })
  .catch((err) => {
    console.error('❌ Error creando la sombra:', err);
  });