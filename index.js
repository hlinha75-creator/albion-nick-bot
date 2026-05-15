const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const ASSISTANT_CHANNEL_NAME = 'Assistente BOT NOTAG';
const DB_PATH = path.join(__dirname, 'players.json');

// ========== BANCO DE DADOS JSON ==========
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return { players: [] };
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { players: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getPlayer(discordId) {
  const db = loadDB();
  return db.players.find(p => p.discord_id === discordId);
}

function savePlayer(data) {
  const db = loadDB();
  const index = db.players.findIndex(p => p.discord_id === data.discord_id);

  if (index >= 0) {
    db.players[index] = { ...db.players[index], ...data, updated_at: new Date().toISOString() };
  } else {
    db.players.push({ ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }

  saveDB(db);
  return true;
}

// ========== OCR + PARSER ==========
async function extractStatsFromImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: m => console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`)
    });

    const text = result.data.text;
    console.log('[OCR] Texto extraído:\n', text);

    return parseAlbionStats(text);
  } catch (error) {
    console.error('[OCR] Erro:', error);
    return null;
  }
}

function parseAlbionStats(text) {
  const extract = (regex) => {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };

  return {
    total_fame: extract(/Total\s+Fame\s*[:=]?\s*([\d.,]+\s*[bmk]?)/i),
    pvp_fame: extract(/Fame\s+for\s+Killing\s+Players\s*[:=]?\s*([\d.,]+\s*[bmk]?)/i),
    gathering_fame: extract(/Fame\s+for\s+Gathering\s*[:=]?\s*([\d.,]+\s*[bmk]?)/i),
    crafting_fame: extract(/Fame\s+for\s+Crafting\s*[:=]?\s*([\d.,]+\s*[bmk]?)/i),
    total_kills: extract(/Total\s+Killed\s+Players\s*[:=]?\s*([\d,]+)/i),
    raw_text: text
  };
}

// ========== UTILS ==========
function normalizeChannelName(name) {
  return name.toLowerCase().replace(/\s+/g, '-').trim();
}

const userStates = new Map();

// ========== EVENTOS DISCORD ==========
client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  console.log(`📁 Banco de dados: ${DB_PATH}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (normalizeChannelName(message.channel.name) !== normalizeChannelName(ASSISTANT_CHANNEL_NAME)) return;

  const authorId = message.author.id;
  const state = userStates.get(authorId);

  // ===== FLUXO 2: AGUARDANDO SCREENSHOT =====
  if (state?.status === 'waiting_screenshot') {
    if (message.attachments.size === 0) {
      return message.reply('❌ Envie uma **screenshot do seu perfil no Albion** (aperte a tecla **Y** no jogo).\n📎 Anexe a imagem aqui.');
    }

    const imageUrl = message.attachments.first().url;
    const processingMsg = await message.reply('🔍 Analisando sua screenshot... isso pode levar alguns segundos.');

    try {
      const stats = await extractStatsFromImage(imageUrl);

      if (!stats || !stats.total_fame) {
        await processingMsg.edit('❌ Não consegui ler os stats da imagem.\n📝 Tente enviar uma screenshot mais nítida (aperte **Y** no jogo).');
        return;
      }

      savePlayer({
        discord_id: authorId,
        discord_tag: message.author.tag,
        albion_nick: state.albion_nick,
        total_fame: stats.total_fame,
        pvp_fame: stats.pvp_fame,
        gathering_fame: stats.gathering_fame,
        crafting_fame: stats.crafting_fame,
        total_kills: stats.total_kills,
        profile_image_url: imageUrl
      });

      userStates.delete(authorId);

      try { await message.delete(); } catch (e) {}

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Stats Registrados!')
        .setDescription(`**${state.albion_nick}** foi cadastrado no banco da guild.`)
        .addFields(
          { name: '🏆 Total Fame', value: stats.total_fame || 'N/A', inline: true },
          { name: '⚔️ PvP Fame', value: stats.pvp_fame || 'N/A', inline: true },
          { name: '🌾 Gathering', value: stats.gathering_fame || 'N/A', inline: true },
          { name: '⚒️ Crafting', value: stats.crafting_fame || 'N/A', inline: true },
          { name: '💀 Total Kills', value: stats.total_kills || 'N/A', inline: true }
        )
        .setFooter({ text: 'Albion Guild Database • NOTAG' })
        .setTimestamp();

      await processingMsg.edit({ content: null, embeds: [embed] });

      setTimeout(async () => {
        try { await processingMsg.delete(); } catch (e) {}
      }, 15000);

    } catch (error) {
      console.error(error);
      await processingMsg.edit('❌ Erro ao processar a imagem. Tente novamente.');
    }
    return;
  }

  // ===== FLUXO 1: AGUARDANDO NICK =====
  if (state?.status === 'waiting_nick') {
    const nick = message.content.trim();

    if (!nick) {
      return message.reply('❌ Nick não pode estar vazio. Digite seu nick no Albion:');
    }
    if (nick.length > 32) {
      return message.reply('❌ Nick muito longo! Máximo 32 caracteres. Digite novamente:');
    }

    try {
      await message.member.setNickname(nick);

      userStates.set(authorId, { status: 'waiting_screenshot', albion_nick: nick });

      try { await message.delete(); } catch (e) {}

      const askScreenshot = await message.channel.send({
        content: `<@${authorId}>, nick alterado para **${nick}**!\n\n📸 Agora envie uma **screenshot do seu perfil no Albion** (aperte a tecla **Y** no jogo) para registrarmos seus stats no banco da guild.\n\n📎 **Anexe a imagem aqui neste chat.**`
      });

      setTimeout(async () => {
        if (userStates.get(authorId)?.status === 'waiting_screenshot') {
          userStates.delete(authorId);
          try { await askScreenshot.delete(); } catch (e) {}
        }
      }, 300000);

    } catch (error) {
      console.error('Erro ao renomear:', error);
      if (error.code === 50013) {
        message.reply('❌ Sem permissão para renomear. Verifique a hierarquia de cargos!');
      } else {
        message.reply('❌ Erro ao alterar nick. Tente novamente.');
      }
      userStates.delete(authorId);
    }
    return;
  }

  // ===== TRIGGER INICIAL: "oi" =====
  if (message.content.trim().toLowerCase() !== 'oi') return;

  const existing = getPlayer(authorId);
  if (existing) {
    await message.reply(`⚠️ Você já está cadastrado como **${existing.albion_nick}**.\n🔄 Se quiser atualizar seus stats, use o comando \`!atualizar\``);
    return;
  }

  userStates.set(authorId, { status: 'waiting_nick', albion_nick: null });

  try { await message.delete(); } catch (e) {}

  await message.channel.send({
    content: `<@${authorId}>, qual seu nick no Albion?`
  });
});

// ========== COMANDOS ADICIONAIS ==========
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (normalizeChannelName(message.channel.name) !== normalizeChannelName(ASSISTANT_CHANNEL_NAME)) return;

  if (message.content.toLowerCase().startsWith('!stats')) {
    const target = message.mentions.members.first() || message.member;
    const player = getPlayer(target.id);

    if (!player) {
      return message.reply(`❌ **${target.displayName}** ainda não cadastrou seus stats.\n👉 Digite \`oi\` no canal para começar.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📊 Stats de ${player.albion_nick}`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: '🏆 Total Fame', value: player.total_fame || 'N/A', inline: true },
        { name: '⚔️ PvP Fame', value: player.pvp_fame || 'N/A', inline: true },
        { name: '🌾 Gathering', value: player.gathering_fame || 'N/A', inline: true },
        { name: '⚒️ Crafting', value: player.crafting_fame || 'N/A', inline: true },
        { name: '💀 Total Kills', value: player.total_kills || 'N/A', inline: true },
        { name: '📅 Atualizado', value: new Date(player.updated_at).toLocaleDateString('pt-BR'), inline: true }
      )
      .setFooter({ text: `Discord: ${player.discord_tag}` });

    message.reply({ embeds: [embed] });
  }

  if (message.content.toLowerCase() === '!ranking') {
    const db = loadDB();
    const sorted = [...db.players]
      .filter(p => p.total_fame)
      .sort((a, b) => parseFloat(b.total_fame) - parseFloat(a.total_fame))
      .slice(0, 10);

    if (sorted.length === 0) {
      return message.reply('📭 Nenhum player cadastrado ainda.');
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Ranking da Guild - Total Fame')
      .setDescription(sorted.map((p, i) => 
        `${i + 1}. **${p.albion_nick}** — ${p.total_fame || '0'}`
      ).join('\n'));

    message.reply({ embeds: [embed] });
  }

  if (message.content.toLowerCase() === '!atualizar') {
    const player = getPlayer(authorId);
    if (!player) {
      return message.reply('❌ Você não está cadastrado. Digite `oi` para começar.');
    }

    userStates.set(authorId, { status: 'waiting_screenshot', albion_nick: player.albion_nick });
    message.reply('📸 Envie uma nova screenshot do seu perfil no Albion para atualizar seus stats.');
  }

  if (message.content === '!criar-canal' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const guild = message.guild;
    const existing = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(ASSISTANT_CHANNEL_NAME) && ch.type === ChannelType.GuildText
    );

    if (existing) return message.reply(`❌ Canal já existe!`);

    await guild.channels.create({
      name: ASSISTANT_CHANNEL_NAME,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ManageNicknames] },
      ],
    });
    message.reply(`✅ Canal criado!`);
  }
});

// Cria canal ao entrar no servidor
client.on('guildCreate', async (guild) => {
  try {
    const existing = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(ASSISTANT_CHANNEL_NAME) && ch.type === ChannelType.GuildText
    );
    if (!existing) {
      await guild.channels.create({
        name: ASSISTANT_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ManageNicknames] },
        ],
      });
    }
  } catch (e) { console.error(e); }
});

client.login(process.env.TOKEN);