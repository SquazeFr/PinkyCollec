const path = require('path');
const express = require('express');

const app = express();
const port = 3000;

// Dossier où les images sont stockées
const imagesDirectory = path.join(__dirname, 'assets');

// Configurer Express pour servir le dossier des images
app.use('/images', express.static(imagesDirectory));

// Démarrer le serveur Express
app.listen(port, () => {
    console.log(`Serveur lancé sur http://localhost:${port}`);
});

module.exports = app; // Exporter l'application Express si tu souhaites l'utiliser ailleurs
