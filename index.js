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
const FAQ_CHANNEL_NAME = 'faq-staff'; // Canal onde staff responde perguntas pendentes
const DB_PATH = path.join(__dirname, 'players.json');
const FAQ_PATH = path.join(__dirname, 'faq.json');

// ========== BANCO DE DADOS JSON (PLAYERS) ==========
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

// ========== BANCO DE DADOS JSON (FAQ) ==========
function loadFAQ() {
  if (!fs.existsSync(FAQ_PATH)) return { questions: [], pending: [] };
  try {
    return JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8'));
  } catch {
    return { questions: [], pending: [] };
  }
}

function saveFAQ(data) {
  fs.writeFileSync(FAQ_PATH, JSON.stringify(data, null, 2));
}

// Adiciona uma pergunta/resposta ao FAQ
function addFAQEntry(question, answer, addedBy) {
  const faq = loadFAQ();
  const entry = {
    id: Date.now().toString(),
    question: question.trim().toLowerCase(),
    answer: answer.trim(),
    keywords: extractKeywords(question),
    added_by: addedBy,
    created_at: new Date().toISOString(),
    usage_count: 0
  };
  faq.questions.push(entry);
  saveFAQ(faq);
  return entry;
}

// Extrai palavras-chave simples da pergunta (remove stopwords comuns)
function extractKeywords(text) {
  const stopwords = ['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre', 'durante', 'ante', 'apos', 'ate', 'desde', 'e', 'ou', 'mas', 'nem', 'que', 'se', 'porque', 'como', 'quando', 'onde', 'quem', 'qual', 'quais', 'cujo', 'cuja', 'cujos', 'cujas', 'quanto', 'quantos', 'quanta', 'quantas', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas', 'vosso', 'vossa', 'vossos', 'vossas', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo', 'eu', 'tu', 'ele', 'ela', 'nos', 'vos', 'eles', 'elas', 'mim', 'ti', 'si', 'me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes', 'meu', 'teu', 'seu', 'nosso', 'vosso', 'nele', 'nela', 'neles', 'nelas', 'dele', 'dela', 'deles', 'delas', 'comigo', 'contigo', 'consigo', 'conosco', 'convosco', 'aqui', 'ai', 'la', 'ali', 'acola', 'agora', 'antes', 'depois', 'sempre', 'nunca', 'jamais', 'ja', 'ainda', 'logo', 'depois', 'logo', 'entao', 'assim', 'talvez', 'quica', 'porventura', 'outrossim', 'ademais', 'alias', 'contudo', 'entretanto', 'todavia', 'no_entanto', 'senao', 'portanto', 'logo', 'pois', 'porque', 'porquanto', 'visto_que', 'ja_que', 'uma_vez_que', 'assim_que', 'desde_que', 'a_fim_de_que', 'para_que', 'quando', 'enquanto', 'antes_que', 'depois_que', 'ate_que', 'sempre_que', 'caso', 'desde_que', 'a_nao_ser_que', 'salvo_se', 'exceto_se', 'nem_que', 'mesmo_que', 'ainda_que', 'posto_que', 'conquanto', 'bem_como', 'assim_como', 'tal_qual', 'tal_como', 'conforme', 'segundo', 'consoante', 'conforme', 'consoante', 'a_medida_que', 'a_proporcao_que', 'quanto_mais', 'quanto_menos', 'tanto_mais', 'tanto_menos', 'mais_que', 'menos_que', 'tao_quanto', 'tanto_quanto', 'tal_qual', 'tao_como', 'assim_como', 'como_se', 'como_que', 'que nem', 'igual_a', 'parecido_com', 'semelhante_a', 'diferente_de', 'distinto_de', 'longe_de', 'perto_de', 'ao_lado_de', 'em_frente_a', 'em_cima_de', 'embaixo_de', 'dentro_de', 'fora_de', 'depois_de', 'antes_de', 'atras_de', 'diante_de', 'acima_de', 'abaixo_de', 'alem_de', 'aquem_de', 'apesar_de', 'a_despeito_de', 'gracas_a', 'devido_a', 'por_causa_de', 'em_virtude_de', 'em_nome_de', 'em_honra_de', 'em_memoria_de', 'em_prol_de', 'em_prejuizo_de', 'em_favor_de', 'em_defesa_de', 'em_busca_de', 'em_vez_de', 'em_lugar_de', 'em_troca_de', 'em_retribuicao_a', 'em_resposta_a', 'em_referencia_a', 'em_relacao_a', 'em_respeito_a', 'em_obediencia_a', 'em_desobediencia_a', 'em_conformidade_com', 'em_desacordo_com', 'em_harmonia_com', 'em_desarmonia_com', 'em_contacto_com', 'em_ligacao_com', 'em_conjunto_com', 'em_colaboracao_com', 'em_cooperacao_com', 'em_competicao_com', 'em_conflito_com', 'em_guerra_com', 'em_paz_com', 'em_amizade_com', 'em_inimizade_com', 'em_love_com', 'em_odio_com', 'em_solidariedade_com', 'em_oposicao_a', 'em_confronto_com', 'em_comparacao_com', 'em_contraste_com', 'em_proporcao_a', 'em_funcao_de', 'em_termos_de', 'em_nome_de', 'em_representacao_de', 'em_substituicao_a', 'em_complemento_a', 'em_adicao_a', 'em_suplemento_a', 'em_contribuicao_para', 'em_dedicacao_a', 'em_homenagem_a', 'em_reconhecimento_de', 'em_agradecimento_a', 'em_pagamento_de', 'em_cumprimento_a', 'em_atencao_a', 'em_respeito_a', 'em_consideracao_a', 'em_vista_de', 'em_face_de', 'em_presenca_de', 'em_absencia_de', 'em_memoria_de', 'em_honra_de', 'em_nome_de', 'em_prol_de', 'em_prejuizo_de', 'em_favor_de', 'em_defesa_de', 'em_busca_de', 'em_vez_de', 'em_lugar_de', 'em_troca_de', 'em_retribuicao_a', 'em_resposta_a', 'em_referencia_a', 'em_relacao_a', 'em_respeito_a', 'em_obediencia_a', 'em_desobediencia_a', 'em_conformidade_com', 'em_desacordo_com', 'em_harmonia_com', 'em_desarmonia_com', 'em_contacto_com', 'em_ligacao_com', 'em_conjunto_com', 'em_colaboracao_com', 'em_cooperacao_com', 'em_competicao_com', 'em_conflito_com', 'em_guerra_com', 'em_paz_com', 'em_amizade_com', 'em_inimizade_com', 'em_love_com', 'em_odio_com', 'em_solidariedade_com', 'em_oposicao_a', 'em_confronto_com', 'em_comparacao_com', 'em_contraste_com', 'em_proporcao_a', 'em_funcao_de', 'em_termos_de'];

  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w));
}

// Calcula score de similaridade entre duas strings (baseado em palavras-chave)
function calculateSimilarity(text1, text2) {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];

  return intersection.length / union.length;
}

// Busca a melhor resposta no FAQ
function findFAQAnswer(question) {
  const faq = loadFAQ();
  if (faq.questions.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of faq.questions) {
    // Verifica similaridade com a pergunta original
    const questionScore = calculateSimilarity(question, entry.question);
    // Verifica similaridade com palavras-chave
    const keywordScore = calculateSimilarity(question, entry.keywords.join(' '));
    // Score combinado (prioriza match direto na pergunta)
    const score = questionScore * 0.7 + keywordScore * 0.3;

    if (score > bestScore && score >= 0.3) { // Threshold de 30%
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    bestMatch.usage_count++;
    saveFAQ(faq);
  }

  return bestMatch;
}

// Adiciona pergunta pendente
function addPendingQuestion(question, userId, userTag, channelId, messageId) {
  const faq = loadFAQ();
  const pending = {
    id: Date.now().toString(),
    question: question.trim(),
    user_id: userId,
    user_tag: userTag,
    channel_id: channelId,
    message_id: messageId,
    created_at: new Date().toISOString(),
    answered: false
  };
  faq.pending.push(pending);
  saveFAQ(faq);
  return pending;
}

// Marca pergunta pendente como respondida e adiciona ao FAQ
function resolvePendingQuestion(pendingId, answer, answeredBy) {
  const faq = loadFAQ();
  const index = faq.pending.findIndex(p => p.id === pendingId);
  if (index === -1) return null;

  const pending = faq.pending[index];
  pending.answered = true;
  pending.answered_at = new Date().toISOString();
  pending.answered_by = answeredBy;

  // Move para o FAQ
  const entry = addFAQEntry(pending.question, answer, answeredBy);

  // Remove da lista de pendentes
  faq.pending.splice(index, 1);
  saveFAQ(faq);

  return { pending, entry };
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
  console.log(`📚 FAQ: ${FAQ_PATH}`);
});

// ========== SISTEMA FAQ - DETECÇÃO DE PERGUNTAS ==========
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelName = normalizeChannelName(message.channel.name);
  const isAssistantChannel = channelName === normalizeChannelName(ASSISTANT_CHANNEL_NAME);
  const isFAQStaffChannel = channelName === normalizeChannelName(FAQ_CHANNEL_NAME);

  // Ignora mensagens que são comandos ou triggers do sistema antigo
  if (message.content.startsWith('!')) return;
  if (message.content.trim().toLowerCase() === 'oi') return;
  if (userStates.has(message.author.id)) return; // Usuário em fluxo de cadastro

  // === CANAL DE STAFF - RESPOSTAS A PERGUNTAS PENDENTES ===
  if (isFAQStaffChannel && !message.author.bot) {
    // Verifica se é resposta a uma pergunta pendente (formato: !responder <id> <resposta>)
    // Ou resposta direta a uma thread de pergunta
    if (message.reference && message.reference.messageId) {
      const faq = loadFAQ();
      const pending = faq.pending.find(p => p.message_id === message.reference.messageId);

      if (pending && !pending.answered) {
        const answer = message.content.trim();
        if (!answer) {
          return message.reply('❌ A resposta não pode estar vazia. Escreva a resposta na mensagem.');
        }

        const result = resolvePendingQuestion(pending.id, answer, message.author.tag);

        if (result) {
          // Notifica o usuário original
          try {
            const userChannel = await client.channels.fetch(pending.channel_id);
            if (userChannel) {
              const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Sua pergunta foi respondida!')
                .setDescription(`**Pergunta:** ${pending.question}\n\n**Resposta:** ${answer}`)
                .setFooter({ text: `Respondido por: ${message.author.tag}` })
                .setTimestamp();

              await userChannel.send({
                content: `<@${pending.user_id}>`,
                embeds: [embed]
              });
            }
          } catch (e) {
            console.error('Erro ao notificar usuário:', e);
          }

          const confirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ FAQ Atualizado!')
            .setDescription(`A pergunta foi respondida e adicionada ao FAQ automaticamente.`)
            .addFields(
              { name: '📝 Pergunta', value: pending.question, inline: false },
              { name: '💬 Resposta', value: answer, inline: false }
            )
            .setTimestamp();

          await message.reply({ embeds: [confirmEmbed] });
        }
        return;
      }
    }

    // Comando manual: !responder <id> <resposta>
    if (message.content.toLowerCase().startsWith('!responder ')) {
      const args = message.content.slice(11).trim();
      const spaceIndex = args.indexOf(' ');

      if (spaceIndex === -1) {
        return message.reply('❌ Uso correto: `!responder <id> <resposta>`');
      }

      const pendingId = args.slice(0, spaceIndex).trim();
      const answer = args.slice(spaceIndex + 1).trim();

      const faq = loadFAQ();
      const pending = faq.pending.find(p => p.id === pendingId);

      if (!pending) {
        return message.reply('❌ Pergunta pendente não encontrada. Verifique o ID.');
      }

      const result = resolvePendingQuestion(pendingId, answer, message.author.tag);

      if (result) {
        // Notifica o usuário original
        try {
          const userChannel = await client.channels.fetch(pending.channel_id);
          if (userChannel) {
            const embed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('✅ Sua pergunta foi respondida!')
              .setDescription(`**Pergunta:** ${pending.question}\n\n**Resposta:** ${answer}`)
              .setFooter({ text: `Respondido por: ${message.author.tag}` })
              .setTimestamp();

            await userChannel.send({
              content: `<@${pending.user_id}>`,
              embeds: [embed]
            });
          }
        } catch (e) {
          console.error('Erro ao notificar usuário:', e);
        }

        const confirmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ FAQ Atualizado!')
          .setDescription(`A pergunta foi respondida e adicionada ao FAQ automaticamente.`)
          .addFields(
            { name: '📝 Pergunta', value: pending.question, inline: false },
            { name: '💬 Resposta', value: answer, inline: false }
          )
          .setTimestamp();

        await message.reply({ embeds: [confirmEmbed] });
      }
      return;
    }

    // Comando: !pendentes - lista perguntas pendentes
    if (message.content.toLowerCase() === '!pendentes') {
      const faq = loadFAQ();
      const pending = faq.pending.filter(p => !p.answered);

      if (pending.length === 0) {
        return message.reply('📭 Nenhuma pergunta pendente no momento.');
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`📋 Perguntas Pendentes (${pending.length})`)
        .setDescription(
          pending.map(p => 
            `**ID:** \`${p.id}\`\n**Pergunta:** ${p.question}\n**Por:** ${p.user_tag} | <t:${Math.floor(new Date(p.created_at).getTime()/1000)}:R>\n`
          ).join('\n---\n')
        )
        .setFooter({ text: 'Responda com !responder <id> <resposta> ou responda a mensagem da pergunta' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    return; // Outras mensagens no canal staff são ignoradas
  }

  // === CANAL ASSISTENTE - DETECTAR PERGUNTAS ===
  if (!isAssistantChannel) return;

  const content = message.content.trim();
  if (content.length < 5) return; // Ignora mensagens muito curtas

  // Verifica se parece uma pergunta (termina com ? ou contém palavras de pergunta)
  const questionIndicators = ['?', 'como', 'qual', 'quais', 'onde', 'quando', 'por que', 'porque', 'quem', 'o que', 'oq', 'oq ', 'oq?', 'o q', 'oq eh', 'o que é', 'o que e', 'como faço', 'como faco', 'como fazer', 'onde fica', 'onde esta', 'onde está', 'como consigo', 'como pegar', 'como usar', 'como funciona', 'para que serve', 'pra que serve', 'qual é', 'qual e', 'quais sao', 'quais são', 'quanto custa', 'quanto é', 'quanto e', 'tem como', 'da pra', 'dá pra', 'posso', 'consigo', 'consegui', 'conseguir', 'saber', 'sabe', 'ajuda', 'ajudar', 'me ajuda', 'preciso de', 'preciso saber', 'queria saber', 'gostaria de saber', 'duvida', 'dúvida', 'pergunta'];

  const isQuestion = content.endsWith('?') || questionIndicators.some(ind => content.toLowerCase().includes(ind));

  if (!isQuestion) return; // Não parece uma pergunta

  // Tenta encontrar resposta no FAQ
  const faqAnswer = findFAQAnswer(content);

  if (faqAnswer) {
    // Encontrou resposta!
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('💬 Pergunta Frequente')
      .setDescription(faqAnswer.answer)
      .setFooter({ text: `Usada ${faqAnswer.usage_count}x | Adicionada por ${faqAnswer.added_by}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // Não encontrou resposta - envia para staff
  const faq = loadFAQ();

  // Verifica se pergunta similar já está pendente
  const similarPending = faq.pending.find(p => 
    !p.answered && calculateSimilarity(content, p.question) > 0.6
  );

  if (similarPending) {
    await message.reply(`⏳ Sua pergunta já está sendo analisada pela staff! Aguarde um momento.\n📋 ID: \`${similarPending.id}\``);
    return;
  }

  // Cria pergunta pendente
  const pending = addPendingQuestion(content, message.author.id, message.author.tag, message.channel.id, message.id);

  // Envia para canal de staff
  try {
    const guild = message.guild;
    let staffChannel = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(FAQ_CHANNEL_NAME) && ch.type === ChannelType.GuildText
    );

    if (!staffChannel) {
      // Cria canal de staff se não existir
      staffChannel = await guild.channels.create({
        name: FAQ_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
      });

      // Tenta dar permissão para cargos de staff (Admin, Moderador, etc.)
      const staffRoles = guild.roles.cache.filter(r => 
        r.name.toLowerCase().includes('staff') || 
        r.name.toLowerCase().includes('admin') || 
        r.name.toLowerCase().includes('mod') ||
        r.name.toLowerCase().includes('moderador') ||
        r.name.toLowerCase().includes('gerente')
      );

      for (const role of staffRoles.values()) {
        await staffChannel.permissionOverwrites.create(role, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }
    }

    const staffEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('❓ Nova Pergunta Pendente')
      .setDescription(`**Pergunta:** ${content}`)
      .addFields(
        { name: '👤 Usuário', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: '📍 Canal', value: `<#${message.channel.id}>`, inline: true },
        { name: '🆔 ID', value: pending.id, inline: true }
      )
      .setFooter({ text: 'Responda a esta mensagem ou use !responder <id> <resposta>' })
      .setTimestamp();

    const staffMsg = await staffChannel.send({ embeds: [staffEmbed] });

    // Atualiza o message_id da pergunta pendente para referência futura
    pending.message_id = staffMsg.id;
    saveFAQ(faq);

  } catch (e) {
    console.error('Erro ao enviar para staff:', e);
  }

  // Responde ao usuário
  await message.reply(`🤔 Ainda não sei responder isso, mas já encaminhei sua pergunta para a staff!\n⏳ Assim que alguém responder, te aviso aqui e a pergunta será adicionada ao FAQ automaticamente.\n📋 ID da pergunta: \`${pending.id}\``);
});

// ========== FLUXO ORIGINAL: CADASTRO DE PLAYERS ==========
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

  // ===== FAQ COMANDOS PÚBLICOS =====
  if (message.content.toLowerCase() === '!faq') {
    const faq = loadFAQ();
    const questions = faq.questions;

    if (questions.length === 0) {
      return message.reply('📭 Nenhuma pergunta no FAQ ainda. Faça uma pergunta que a staff vai responder!');
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 Perguntas Frequentes')
      .setDescription(
        questions.slice(0, 15).map((q, i) => 
          `**${i + 1}.** ${q.question}\n↳ ${q.answer.substring(0, 100)}${q.answer.length > 100 ? '...' : ''}`
        ).join('\n\n')
      )
      .setFooter({ text: `${questions.length} perguntas no total | Use !pergunta <texto> para buscar` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
    return;
  }

  if (message.content.toLowerCase().startsWith('!pergunta ')) {
    const query = message.content.slice(10).trim();
    if (!query) {
      return message.reply('❌ Uso: `!pergunta <sua pergunta>`');
    }

    const faq = loadFAQ();
    let results = [];

    for (const entry of faq.questions) {
      const score = calculateSimilarity(query, entry.question);
      if (score > 0.2) {
        results.push({ entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      return message.reply('🔍 Não encontrei nada relacionado no FAQ. Tente reformular ou pergunte no chat que a staff responde!');
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🔍 Resultados da Busca')
      .setDescription(
        results.slice(0, 5).map((r, i) => 
          `**${i + 1}.** ${r.entry.question}\n↳ ${r.entry.answer}`
        ).join('\n\n')
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
    return;
  }

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

// Cria canal ao entrar no servidor.
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