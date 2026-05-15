const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
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
const waitingForNick = new Map();

// Função para normalizar nomes de canal (Discord converte espaços em hífens e tudo em minúsculo)
function normalizeChannelName(name) {
  return name.toLowerCase().replace(/\s+/g, '-').trim();
}

client.once('ready', () => {
  console.log(`✅ Bot logado: ${client.user.tag}`);
  console.log(`📋 ID: ${client.user.id}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const guild = message.guild;
  const member = message.member;
  const channel = message.channel;

  // Comparação normalizada: "Assistente BOT NOTAG" === "assistente-bot-notag"
  if (normalizeChannelName(channel.name) !== normalizeChannelName(ASSISTANT_CHANNEL_NAME)) {
    return;
  }

  // Se está aguardando nick
  if (waitingForNick.has(message.author.id)) {
    const nick = message.content.trim();

    if (!nick) {
      return message.reply('❌ Nick não pode estar vazio. Digite seu nick no Albion:');
    }
    if (nick.length > 32) {
      return message.reply('❌ Nick muito longo! Máximo 32 caracteres. Digite novamente:');
    }

    try {
      await member.setNickname(nick);
      waitingForNick.delete(message.author.id);

      const confirmMsg = await message.reply(`✅ Nick alterado com sucesso para: **${nick}**`);

      setTimeout(async () => {
        try { await message.delete(); await confirmMsg.delete(); } catch (e) {}
      }, 5000);

    } catch (error) {
      console.error('Erro ao renomear:', error);

      if (error.code === 50013) {
        message.reply('❌ Erro: O bot não tem permissão para alterar nicknames. Verifique se o cargo do bot está ACIMA dos usuários!');
      } else {
        message.reply('❌ Ocorreu um erro ao alterar seu nick. Tente novamente ou contate um administrador.');
      }
      waitingForNick.delete(message.author.id);
    }
    return;
  }

  // Só reage se a mensagem for "oi" (case-insensitive)
  if (message.content.trim().toLowerCase() !== 'oi') return;

  waitingForNick.set(message.author.id, true);

  try {
    await message.delete();
  } catch (e) {}

  const askMsg = await channel.send({
    content: `<@${message.author.id}>, qual seu nick no Albion?`,
    allowedMentions: { users: [message.author.id] }
  });

  // Timeout de 60 segundos
  setTimeout(async () => {
    if (waitingForNick.has(message.author.id)) {
      waitingForNick.delete(message.author.id);
      try { await askMsg.delete(); } catch (e) {}
    }
  }, 60000);
});

// Cria o canal automaticamente quando entra em um servidor
client.on('guildCreate', async (guild) => {
  try {
    const existingChannel = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(ASSISTANT_CHANNEL_NAME) 
        && ch.type === ChannelType.GuildText
    );

    if (!existingChannel) {
      await guild.channels.create({
        name: ASSISTANT_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.ManageNicknames,
            ],
          },
        ],
      });
      console.log(`✅ Canal "${ASSISTANT_CHANNEL_NAME}" criado em ${guild.name}`);
    }
  } catch (error) {
    console.error('Erro ao criar canal:', error);
  }
});

// Comando manual para criar o canal (apenas admins)
client.on('messageCreate', async (message) => {
  if (message.content === '!criar-canal' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    const guild = message.guild;

    const existingChannel = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(ASSISTANT_CHANNEL_NAME) 
        && ch.type === ChannelType.GuildText
    );

    if (existingChannel) {
      return message.reply(`❌ O canal "${ASSISTANT_CHANNEL_NAME}" já existe!`);
    }

    try {
      await guild.channels.create({
        name: ASSISTANT_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.ManageNicknames,
            ],
          },
        ],
      });
      message.reply(`✅ Canal "${ASSISTANT_CHANNEL_NAME}" criado com sucesso!`);
    } catch (error) {
      message.reply('❌ Erro ao criar canal. Verifique as permissões do bot.');
    }
  }
});

client.login(process.env.TOKEN);