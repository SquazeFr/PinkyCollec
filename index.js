require('dotenv').config();
const express = require('express');
const { Client, REST, Routes, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Fichiers pour les données
const DATA_FILE = './data.json';
const CARDS_FILE = './cards.json';

// Créez une instance du bot
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

// Créez une instance d'Express pour servir les images
const app = express();
const port = 3000;

// Sert les images à partir du dossier 'assets'
app.use('/images', express.static(path.join(__dirname, 'assets')));

// Lance le serveur Express (Keep-Alive)
app.get('/', (req, res) => {
    res.send('Le bot est en ligne !');
});
app.listen(port, () => {
    console.log(`Serveur lancé sur http://localhost:${port}`);
});

// Chargement des cartes
function loadCards() {
    if (fs.existsSync(CARDS_FILE)) {
        return JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
    }
    console.error('Le fichier cards.json est introuvable.');
    return [];
}

const cards = loadCards();

// Chargement ou création du fichier de données
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return {};
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
}

// Initialisation des données
const playerData = loadData();

// Probabilités pour les cartes
const rarityProbabilities = {
    Commun: {
        "Commun Normale": 35,
        "Commun ✨ ": 12.5,
        "Commun 🌈 ": 2.5,
    },
    Rare: {
        "Rare Normale": 24.5,
        "Rare ✨ ": 8.75,
        "Rare 🌈 ": 1.5,
        "Rare Glitch": 0.25,
    },
    Epique: {
        "Epique Normale": 7,
        "Epique ✨ ": 2.5,
        "Epique 🌈 ": 0.5,
    },
    Legendaire: {
        "Légendaire Normale": 3.5,
        "Légendaire ✨ ": 1.25,
        "Légendaire 🌈 ": 0.25,
    },
};

// Couleurs par rareté
const rarityColors = {
    "Commun Normale": '#A0A0A0', // Gris
    "Commun ✨ ": '#FFD700', // Or
    "Commun 🌈": '#C0C0C0', // Argent
    "Rare Normale": '#1E90FF', // Bleu
    "Rare ✨ ": '#FFD700', // Or
    "Rare 🌈": '#8A2BE2', // Violet
    "Rare Glitch": '#FF1493', // Rose
    "Epique Normale": '#FF4500', // Orange
    "Epique ✨ ": '#FFD700', // Or
    "Epique 🌈": '#8B008B', // Violet foncé
    "Légendaire Normale": '#DAA520', // Doré
    "Légendaire ✨ ": '#FFD700', // Or
    "Légendaire 🌈": '#FF69B4', // Rose vif
};

// Fonction pour tirer une carte en fonction des probabilités
function drawCard() {
    const rarityKeys = Object.keys(rarityProbabilities);
    const allCards = [];

    // Construire une liste pondérée de toutes les cartes possibles
    rarityKeys.forEach(rarity => {
        const subTypes = rarityProbabilities[rarity];
        Object.keys(subTypes).forEach(subType => {
            const weight = subTypes[subType];
            for (let i = 0; i < weight * 10; i++) { // Multiplier par 10 pour éviter les erreurs de précision
                allCards.push({ rarity, type: subType });
            }
        });
    });

    // Tirer une carte aléatoire dans la liste pondérée
    const randomIndex = Math.floor(Math.random() * allCards.length);
    return allCards[randomIndex];
}

// Fonction pour enregistrer les commandes globales
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    const commands = [
        {
            name: 'pc-open',
            description: 'Ouvre un booster.',
        },
        {
            name: 'pc-collec',
            description: 'Affiche votre collection de cartes.',
        },
        {
            name: 'pc-list',
            description: 'Affiche la liste de toutes les cartes disponibles.',
        },
        {
            name: 'pc-see',
            description: 'Affiche les détails d’une carte spécifique.',
            options: [
                {
                    name: 'carte',
                    type: 3, // STRING
                    description: 'Le nom de la carte à afficher',
                    required: true,
                },
            ],
        },
        {
            name: 'pco-reset-cooldown',
            description: 'Réinitialise le cooldown d’un joueur (Staff uniquement).',
            options: [
                {
                    name: 'id',
                    type: 3, // STRING
                    description: 'ID Discord du joueur',
                    required: true,
                },
            ],
        },
    ];

    try {
        console.log('Déploiement des commandes globales...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Commandes globales enregistrées avec succès !');
    } catch (error) {
        console.error('Erreur lors de l’enregistrement des commandes :', error);
    }
}

// Lorsqu'il est prêt
client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    
    // Enregistrer les commandes au démarrage
    registerCommands();

    // Mise en place du statut rotatif
    const statuses = [
        "Venez tenter votre chance !",
        "Capturer les tous !",
        "Made by SquazeFr & Daiymoon",
    ];

    let index = 0;
    setInterval(() => {
        const status = statuses[index];
        client.user.setActivity(status, { type: "PLAYING" });
        index = (index + 1) % statuses.length; // Boucle circulaire
    }, 10000); // Change toutes les 10 secondes
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id;

    // S'assurer que le joueur a des données
    if (!playerData[userId]) {
        playerData[userId] = {
            collection: [],
            cooldown: 0,
        };
        saveData(playerData);
    }

    if (commandName === 'pc-open') {
        const now = Date.now();
        const player = playerData[userId];

        // Vérifier si l'utilisateur est sous cooldown
        if (player.cooldown > now) {
            const timeLeft = Math.ceil((player.cooldown - now) / (60 * 60 * 1000));
            return await interaction.reply(`Vous devez attendre encore ${timeLeft} heure(s) avant d'ouvrir un booster.`);
        }

        // Tirage de la carte
        const drawnCard = drawCard();

        // Chercher une carte correspondante dans la base
        const cardDetails = cards.find(c => c.rarity === drawnCard.type);

        if (!cardDetails) {
            console.error(`Carte introuvable pour : ${JSON.stringify(drawnCard)}`);
            return await interaction.reply("Une erreur est survenue lors de l'ouverture du booster.");
        }

        // Vérifiez si la carte est déjà dans la collection
        const existingCard = player.collection.find(c => c.name === cardDetails.name);
        if (existingCard) {
            existingCard.count += 1; // Incrémente le compteur
        } else {
            player.collection.push({ name: cardDetails.name, count: 1 }); // Ajoute la carte avec un compteur de 1
        }

        player.cooldown = now + 3 * 60 * 60 * 1000; // 3 heures de cooldown
        saveData(playerData);

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Vous avez obtenu une nouvelle carte : ${cardDetails.name}`)
            .setDescription(`Rareté : ${drawnCard.type}`)
            .setImage(cardDetails.image)
            .setColor(rarityColors[drawnCard.type]); // Utilisez la couleur basée sur la rareté

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'pc-collec') {
        const player = playerData[userId];
        if (!player.collection || player.collection.length === 0) {
            return await interaction.reply("Votre collection est vide.");
        }

        const description = player.collection
            .map(card => `${card.name} - ${card .count}`) // Affiche le nom et le nombre d'exemplaires
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('Votre collection de cartes')
            .setDescription(description)
            .setColor('#00FF00');

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'pc-list') {
        const embed = new EmbedBuilder()
            .setTitle('Liste des cartes disponibles')
            .setDescription(cards.map(card => `${card.name} - ${card.rarity}`).join('\n'))
            .setColor('#00AAFF');

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'pc-see') {
        const cardName = interaction.options.getString('carte');
        const card = cards.find(c => c.name.toLowerCase() === cardName.toLowerCase());

        if (!card) {
            return await interaction.reply(`Carte '${cardName}' introuvable.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(card.name)
            .setDescription(`Rareté : ${card.rarity}`)
            .setImage(card.image)
            .setColor(rarityColors[card.rarity]); // Utilisez la couleur basée sur la rareté

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'pco-reset-cooldown') {
        const staffRoleName = "Staff"; // Nom exact du rôle
        const memberRoles = interaction.member.roles.cache;

        // Vérifiez si l'utilisateur possède le rôle "Staff"
        if (!memberRoles.some(role => role.name === staffRoleName)) {
            return await interaction.reply("Vous n'avez pas la permission d'utiliser cette commande. Ce rôle est réservé au personnel ayant le rôle 'Staff'.");
        }

        const userIdToReset = interaction.options.getString('id');

        if (!playerData[userIdToReset]) {
            return await interaction.reply(`Aucune donnée trouvée pour l'utilisateur avec l'ID : ${userIdToReset}`);
        }

        playerData[userIdToReset].cooldown = 0;
        saveData(playerData);

        await interaction.reply(`Le cooldown du joueur avec l'ID : ${userIdToReset} a été réinitialisé.`);
    }
});

// Connexion du bot
client.login(process.env.BOT_TOKEN);