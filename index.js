require('dotenv').config();
const express = require('express');
const { Client, REST, Routes, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
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

// Lance le serveur Express
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
        "Commun Gold": 12.5,
        "Commun Holographique": 2.5,
    },
    Rare: {
        "Rare Normale": 24.5,
        "Rare Gold": 8.75,
        "Rare Holographique": 1.5,
        "Rare Glitch": 0.25,
    },
    Epique: {
        "Epique Normale": 7,
        "Epique Gold": 2.5,
        "Epique Holographique": 0.5,
    },
    Legendaire: {
        "Légendaire Normale": 3.5,
        "Légendaire Gold": 1.25,
        "Légendaire Holographique": 0.25,
    },
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

// Fonction pour enregistrer les commandes
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
        console.log('Déploiement des commandes...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Commandes enregistrées avec succès !');
    } catch (error) {
        console.error('Erreur lors de l’enregistrement des commandes :', error);
    }
}

// Lorsqu'il est prêt
client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    // Enregistrer les commandes au démarrage
    registerCommands();
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

        player.collection.push(cardDetails.name);
        player.cooldown = now + 3 * 60 * 60 * 1000; // 3 heures de cooldown
        saveData(playerData);

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Vous avez obtenu une nouvelle carte : ${cardDetails.name}`)
            .setDescription(`Rareté : ${drawnCard.type}`)
            .setImage(cardDetails.image)
            .setColor('#FFD700');

        await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'pc-collec') {
        // Gestion de la collection similaire à votre code existant
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
            .setColor('#FFD700');

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
            return await interaction.reply(`Aucun joueur trouvé avec l'ID : ${userIdToReset}`);
        }

        playerData[userIdToReset].cooldown = 0;
        saveData(playerData);

        await interaction.reply(`Le cooldown du joueur avec l'ID **${userIdToReset}** a été réinitialisé.`);
    }
});

// Connexion du bot à Discord
client.login(process.env.BOT_TOKEN);
