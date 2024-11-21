const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Sert les images à partir du dossier 'assets'
app.use('/images', express.static(path.join(__dirname, 'assets')));

app.listen(port, () => {
    console.log(`Serveur lancé sur http://localhost:${port}`);
});
