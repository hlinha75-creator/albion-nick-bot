// ========== FUNÇÕES FAQ - ADICIONAR AO SEU index.js ==========

// 1. ADICIONAR NO TOPO (após os requires):
const FAQ_PATH = path.join(__dirname, 'faq.json');
const FAQ_CHANNEL_NAME = 'faq-staff';

// 2. ADICIONAR APÓS AS FUNÇÕES DE BANCO DE DADOS:

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

function extractKeywords(text) {
  const stopwords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'no', 'na', 'por', 'para', 'com', 'e', 'ou', 'mas', 'que', 'se', 'como', 'quando', 'onde', 'quem', 'qual', 'o que', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'meu', 'minha', 'seu', 'sua', 'este', 'esta', 'esse', 'essa', 'eu', 'tu', 'ele', 'ela', 'nos', 'eles', 'elas', 'mim', 'ti', 'me', 'te', 'lhe', 'aqui', 'ai', 'la', 'agora', 'antes', 'depois', 'sempre', 'nunca', 'ja', 'ainda', 'logo', 'entao', 'assim', 'talvez', 'contudo', 'entretanto', 'todavia', 'portanto', 'pois', 'porque', 'quando', 'enquanto', 'caso', 'mesmo_que', 'ainda_que'];

  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.includes(w));
}

function calculateSimilarity(text1, text2) {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];

  return intersection.length / union.length;
}

function findFAQAnswer(question) {
  const faq = loadFAQ();
  if (faq.questions.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of faq.questions) {
    const questionScore = calculateSimilarity(question, entry.question);
    const keywordScore = calculateSimilarity(question, entry.keywords.join(' '));
    const score = questionScore * 0.7 + keywordScore * 0.3;

    if (score > bestScore && score >= 0.3) {
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

function resolvePendingQuestion(pendingId, answer, answeredBy) {
  const faq = loadFAQ();
  const index = faq.pending.findIndex(p => p.id === pendingId);
  if (index === -1) return null;

  const pending = faq.pending[index];
  pending.answered = true;
  pending.answered_at = new Date().toISOString();
  pending.answered_by = answeredBy;

  const entry = addFAQEntry(pending.question, answer, answeredBy);

  faq.pending.splice(index, 1);
  saveFAQ(faq);

  return { pending, entry };
}

// 3. ADICIONAR NO EVENTO 'ready':
console.log(`📚 FAQ: ${FAQ_PATH}`);

// 4. ADICIONAR NOVO EVENTO messageCreate (ANTES do evento original de cadastro):
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelName = normalizeChannelName(message.channel.name);
  const isAssistantChannel = channelName === normalizeChannelName(ASSISTANT_CHANNEL_NAME);
  const isFAQStaffChannel = channelName === normalizeChannelName(FAQ_CHANNEL_NAME);

  if (message.content.startsWith('!')) return;
  if (message.content.trim().toLowerCase() === 'oi') return;
  if (userStates.has(message.author.id)) return;

  // === CANAL DE STAFF ===
  if (isFAQStaffChannel && !message.author.bot) {
    // Resposta por reply
    if (message.reference && message.reference.messageId) {
      const faq = loadFAQ();
      const pending = faq.pending.find(p => p.message_id === message.reference.messageId);

      if (pending && !pending.answered) {
        const answer = message.content.trim();
        if (!answer) {
          return message.reply('❌ A resposta não pode estar vazia.');
        }

        const result = resolvePendingQuestion(pending.id, answer, message.author.tag);

        if (result) {
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

    // !responder <id> <resposta>
    if (message.content.toLowerCase().startsWith('!responder ')) {
      const args = message.content.slice(11).trim();
      const spaceIndex = args.indexOf(' ');

      if (spaceIndex === -1) {
        return message.reply('❌ Uso: `!responder <id> <resposta>`');
      }

      const pendingId = args.slice(0, spaceIndex).trim();
      const answer = args.slice(spaceIndex + 1).trim();

      const faq = loadFAQ();
      const pending = faq.pending.find(p => p.id === pendingId);

      if (!pending) {
        return message.reply('❌ Pergunta pendente não encontrada.');
      }

      const result = resolvePendingQuestion(pendingId, answer, message.author.tag);

      if (result) {
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
          .addFields(
            { name: '📝 Pergunta', value: pending.question, inline: false },
            { name: '💬 Resposta', value: answer, inline: false }
          )
          .setTimestamp();

        await message.reply({ embeds: [confirmEmbed] });
      }
      return;
    }

    // !pendentes
    if (message.content.toLowerCase() === '!pendentes') {
      const faq = loadFAQ();
      const pending = faq.pending.filter(p => !p.answered);

      if (pending.length === 0) {
        return message.reply('📭 Nenhuma pergunta pendente.');
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`📋 Perguntas Pendentes (${pending.length})`)
        .setDescription(
          pending.map(p => 
            `**ID:** \`${p.id}\`\n**Pergunta:** ${p.question}\n**Por:** ${p.user_tag}\n`
          ).join('\n---\n')
        )
        .setFooter({ text: 'Responda com !responder <id> <resposta> ou responda a mensagem' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    return;
  }

  // === CANAL ASSISTENTE - DETECTAR PERGUNTAS ===
  if (!isAssistantChannel) return;

  const content = message.content.trim();
  if (content.length < 5) return;

  const questionIndicators = ['?', 'como', 'qual', 'quais', 'onde', 'quando', 'por que', 'porque', 'quem', 'o que', 'oq', 'o q', 'como faço', 'como faco', 'como fazer', 'onde fica', 'onde esta', 'onde está', 'como consigo', 'como pegar', 'como usar', 'como funciona', 'para que serve', 'pra que serve', 'qual é', 'qual e', 'quanto custa', 'quanto é', 'tem como', 'da pra', 'dá pra', 'posso', 'consigo', 'saber', 'sabe', 'ajuda', 'ajudar', 'me ajuda', 'preciso de', 'queria saber', 'gostaria de saber', 'duvida', 'dúvida', 'pergunta'];

  const isQuestion = content.endsWith('?') || questionIndicators.some(ind => content.toLowerCase().includes(ind));

  if (!isQuestion) return;

  const faqAnswer = findFAQAnswer(content);

  if (faqAnswer) {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('💬 Pergunta Frequente')
      .setDescription(faqAnswer.answer)
      .setFooter({ text: `Usada ${faqAnswer.usage_count}x | Adicionada por ${faqAnswer.added_by}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  const faq = loadFAQ();

  const similarPending = faq.pending.find(p => 
    !p.answered && calculateSimilarity(content, p.question) > 0.6
  );

  if (similarPending) {
    await message.reply(`⏳ Sua pergunta já está sendo analisada pela staff!\n📋 ID: \`${similarPending.id}\``);
    return;
  }

  const pending = addPendingQuestion(content, message.author.id, message.author.tag, message.channel.id, message.id);

  try {
    const guild = message.guild;
    let staffChannel = guild.channels.cache.find(
      ch => normalizeChannelName(ch.name) === normalizeChannelName(FAQ_CHANNEL_NAME) && ch.type === ChannelType.GuildText
    );

    if (!staffChannel) {
      staffChannel = await guild.channels.create({
        name: FAQ_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
      });

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

    pending.message_id = staffMsg.id;
    saveFAQ(faq);

  } catch (e) {
    console.error('Erro ao enviar para staff:', e);
  }

  await message.reply(`🤔 Ainda não sei responder isso, mas já encaminhei sua pergunta para a staff!\n⏳ Assim que alguém responder, te aviso aqui.\n📋 ID: \`${pending.id}\``);
});

// 5. ADICIONAR COMANDOS NO EVENTO DE COMANDOS EXISTENTE:

// Dentro do segundo client.on('messageCreate', ...), adicionar:

if (message.content.toLowerCase() === '!faq') {
  const faq = loadFAQ();
  const questions = faq.questions;

  if (questions.length === 0) {
    return message.reply('📭 Nenhuma pergunta no FAQ ainda.');
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
    return message.reply('🔍 Não encontrei nada no FAQ. Tente reformular ou pergunte no chat!');
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
