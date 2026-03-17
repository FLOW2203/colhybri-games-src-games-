// ---------------------------------------------------------------------------
// COLHYBRI GAMES — i18n system
// 10 supported languages: FR, EN, ES, DE, EL, ZH, JA, HI, PT, RU
// ---------------------------------------------------------------------------

export const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'de', 'el', 'zh', 'ja', 'hi', 'pt', 'ru'];

/**
 * Return the localised string from a translation object.
 * Fallback chain: requested locale → 'fr' → 'en' → first available value.
 */
export function t(obj, locale) {
  if (!obj || typeof obj !== 'object') return obj ?? '';
  if (obj[locale] !== undefined) return obj[locale];
  if (obj.fr !== undefined) return obj.fr;
  if (obj.en !== undefined) return obj.en;
  const keys = Object.keys(obj);
  return keys.length > 0 ? obj[keys[0]] : '';
}

// ---------------------------------------------------------------------------
// UI_STRINGS — every UI label used across the app
// ---------------------------------------------------------------------------
export const UI_STRINGS = {
  play: {
    fr: 'Jouer', en: 'Play', es: 'Jugar', de: 'Spielen', el: 'Παίξε',
    zh: '开始', ja: 'プレイ', hi: 'खेलें', pt: 'Jogar', ru: 'Играть',
  },
  replay: {
    fr: 'Rejouer', en: 'Replay', es: 'Repetir', de: 'Nochmal', el: 'Ξαναπαίξε',
    zh: '重玩', ja: 'リプレイ', hi: 'फिर खेलें', pt: 'Repetir', ru: 'Заново',
  },
  challenge: {
    fr: 'Défier', en: 'Challenge', es: 'Desafiar', de: 'Herausfordern', el: 'Πρόκληση',
    zh: '挑战', ja: 'チャレンジ', hi: 'चुनौती', pt: 'Desafiar', ru: 'Вызов',
  },
  menu: {
    fr: 'Menu', en: 'Menu', es: 'Menú', de: 'Menü', el: 'Μενού',
    zh: '菜单', ja: 'メニュー', hi: 'मेनू', pt: 'Menu', ru: 'Меню',
  },
  score: {
    fr: 'Score', en: 'Score', es: 'Puntuación', de: 'Punkte', el: 'Σκορ',
    zh: '得分', ja: 'スコア', hi: 'स्कोर', pt: 'Pontuação', ru: 'Счёт',
  },
  highScore: {
    fr: 'Meilleur score', en: 'High Score', es: 'Récord', de: 'Highscore', el: 'Ρεκόρ',
    zh: '最高分', ja: 'ハイスコア', hi: 'उच्चतम स्कोर', pt: 'Recorde', ru: 'Рекорд',
  },
  newRecord: {
    fr: 'Nouveau record !', en: 'New Record!', es: '¡Nuevo récord!', de: 'Neuer Rekord!', el: 'Νέο ρεκόρ!',
    zh: '新纪录！', ja: '新記録！', hi: 'नया रिकॉर्ड!', pt: 'Novo recorde!', ru: 'Новый рекорд!',
  },
  time: {
    fr: 'Temps', en: 'Time', es: 'Tiempo', de: 'Zeit', el: 'Χρόνος',
    zh: '时间', ja: '時間', hi: 'समय', pt: 'Tempo', ru: 'Время',
  },
  lives: {
    fr: 'Vies', en: 'Lives', es: 'Vidas', de: 'Leben', el: 'Ζωές',
    zh: '生命', ja: 'ライフ', hi: 'जीवन', pt: 'Vidas', ru: 'Жизни',
  },
  muted: {
    fr: 'Son coupé', en: 'Muted', es: 'Silenciado', de: 'Stumm', el: 'Σίγαση',
    zh: '已静音', ja: 'ミュート', hi: 'म्यूट', pt: 'Mudo', ru: 'Без звука',
  },
  unmuted: {
    fr: 'Son activé', en: 'Unmuted', es: 'Con sonido', de: 'Ton an', el: 'Ήχος ενεργός',
    zh: '已开启声音', ja: 'ミュート解除', hi: 'अनम्यूट', pt: 'Com som', ru: 'Со звуком',
  },
  tapToStart: {
    fr: 'Appuyez pour commencer', en: 'Tap to Start', es: 'Toca para empezar', de: 'Tippe zum Starten', el: 'Πατήστε για εκκίνηση',
    zh: '点击开始', ja: 'タップして開始', hi: 'शुरू करने के लिए टैप करें', pt: 'Toque para começar', ru: 'Нажмите, чтобы начать',
  },
  tapToSkip: {
    fr: 'Appuyez pour passer', en: 'Tap to Skip', es: 'Toca para saltar', de: 'Tippe zum Überspringen', el: 'Πατήστε για παράλειψη',
    zh: '点击跳过', ja: 'タップしてスキップ', hi: 'स्किप करने के लिए टैप करें', pt: 'Toque para pular', ru: 'Нажмите, чтобы пропустить',
  },
  gameOver: {
    fr: 'Fin de partie', en: 'Game Over', es: 'Fin del juego', de: 'Spiel vorbei', el: 'Τέλος παιχνιδιού',
    zh: '游戏结束', ja: 'ゲームオーバー', hi: 'गेम ओवर', pt: 'Fim de jogo', ru: 'Игра окончена',
  },
  victory: {
    fr: 'Victoire !', en: 'Victory!', es: '¡Victoria!', de: 'Sieg!', el: 'Νίκη!',
    zh: '胜利！', ja: '勝利！', hi: 'जीत!', pt: 'Vitória!', ru: 'Победа!',
  },
  defeat: {
    fr: 'Défaite', en: 'Defeat', es: 'Derrota', de: 'Niederlage', el: 'Ήττα',
    zh: '失败', ja: '敗北', hi: 'हार', pt: 'Derrota', ru: 'Поражение',
  },
  didYouKnow: {
    fr: 'Le saviez-vous ?', en: 'Did you know?', es: '¿Sabías que?', de: 'Wusstest du?', el: 'Το γνωρίζατε;',
    zh: '你知道吗？', ja: '知っていましたか？', hi: 'क्या आप जानते हैं?', pt: 'Sabia que?', ru: 'Знаете ли вы?',
  },
  source: {
    fr: 'Source', en: 'Source', es: 'Fuente', de: 'Quelle', el: 'Πηγή',
    zh: '来源', ja: '出典', hi: 'स्रोत', pt: 'Fonte', ru: 'Источник',
  },
  share: {
    fr: 'Partager', en: 'Share', es: 'Compartir', de: 'Teilen', el: 'Κοινοποίηση',
    zh: '分享', ja: 'シェア', hi: 'साझा करें', pt: 'Partilhar', ru: 'Поделиться',
  },
  points: {
    fr: 'Points', en: 'Points', es: 'Puntos', de: 'Punkte', el: 'Πόντοι',
    zh: '积分', ja: 'ポイント', hi: 'अंक', pt: 'Pontos', ru: 'Очки',
  },
  streak: {
    fr: 'Série', en: 'Streak', es: 'Racha', de: 'Serie', el: 'Σερί',
    zh: '连胜', ja: 'ストリーク', hi: 'लगातार', pt: 'Sequência', ru: 'Серия',
  },
  dailyBonus: {
    fr: 'Bonus du jour', en: 'Daily Bonus', es: 'Bono diario', de: 'Tagesbonus', el: 'Ημερήσιο μπόνους',
    zh: '每日奖励', ja: 'デイリーボーナス', hi: 'दैनिक बोनस', pt: 'Bónus diário', ru: 'Ежедневный бонус',
  },
  convergenceZone: {
    fr: 'Zone de Convergence', en: 'Convergence Zone', es: 'Zona de Convergencia', de: 'Konvergenzzone', el: 'Ζώνη Σύγκλισης',
    zh: '汇聚区', ja: 'コンバージェンスゾーン', hi: 'अभिसरण क्षेत्र', pt: 'Zona de Convergência', ru: 'Зона конвергенции',
  },
  subscribe: {
    fr: "S'abonner", en: 'Subscribe', es: 'Suscribirse', de: 'Abonnieren', el: 'Εγγραφή',
    zh: '订阅', ja: '登録する', hi: 'सदस्यता लें', pt: 'Subscrever', ru: 'Подписаться',
  },
  subscribeCta: {
    fr: 'Débloquez tous les jeux', en: 'Unlock all games', es: 'Desbloquea todos los juegos', de: 'Alle Spiele freischalten', el: 'Ξεκλειδώστε όλα τα παιχνίδια',
    zh: '解锁所有游戏', ja: '全ゲームをアンロック', hi: 'सभी गेम अनलॉक करें', pt: 'Desbloqueie todos os jogos', ru: 'Откройте все игры',
  },
  comingSoon: {
    fr: 'Bientôt disponible', en: 'Coming Soon', es: 'Próximamente', de: 'Demnächst', el: 'Σύντομα',
    zh: '即将推出', ja: '近日公開', hi: 'जल्द आ रहा है', pt: 'Em breve', ru: 'Скоро',
  },
  gamesAvailable: {
    fr: 'Jeux disponibles', en: 'Games Available', es: 'Juegos disponibles', de: 'Verfügbare Spiele', el: 'Διαθέσιμα παιχνίδια',
    zh: '可用游戏', ja: '利用可能なゲーム', hi: 'उपलब्ध गेम', pt: 'Jogos disponíveis', ru: 'Доступные игры',
  },
  gameOfTheDay: {
    fr: 'Jeu du jour', en: 'Game of the Day', es: 'Juego del día', de: 'Spiel des Tages', el: 'Παιχνίδι της ημέρας',
    zh: '今日游戏', ja: '今日のゲーム', hi: 'आज का गेम', pt: 'Jogo do dia', ru: 'Игра дня',
  },
  leaderboard: {
    fr: 'Classement', en: 'Leaderboard', es: 'Clasificación', de: 'Rangliste', el: 'Κατάταξη',
    zh: '排行榜', ja: 'リーダーボード', hi: 'लीडरबोर्ड', pt: 'Classificação', ru: 'Таблица лидеров',
  },
  chapters: {
    fr: 'Chapitres', en: 'Chapters', es: 'Capítulos', de: 'Kapitel', el: 'Κεφάλαια',
    zh: '章节', ja: 'チャプター', hi: 'अध्याय', pt: 'Capítulos', ru: 'Главы',
  },
  all: {
    fr: 'Tous', en: 'All', es: 'Todos', de: 'Alle', el: 'Όλα',
    zh: '全部', ja: 'すべて', hi: 'सभी', pt: 'Todos', ru: 'Все',
  },
  holdToRest: {
    fr: 'Maintenir pour dormir', en: 'Hold to rest', es: 'Mantén para descansar', de: 'Halten zum Ruhen', el: 'Κρατήστε για ξεκούραση',
    zh: '按住休息', ja: 'ホールドで休む', hi: 'आराम के लिए दबाएं', pt: 'Segure para descansar', ru: 'Удерживайте для отдыха',
  },
  releaseToFly: {
    fr: 'Relâcher pour voler', en: 'Release to fly', es: 'Suelta para volar', de: 'Loslassen zum Fliegen', el: 'Αφήστε για πτήση',
    zh: '松开飞行', ja: 'リリースで飛ぶ', hi: 'उड़ने के लिए छोड़ें', pt: 'Solte para voar', ru: 'Отпустите для полёта',
  },
  dontRunOutOfEnergy: {
    fr: "Ne tombez pas en panne d'énergie !", en: "Don't run out of energy!", es: '¡No te quedes sin energía!', de: 'Lass die Energie nicht ausgehen!', el: 'Μην αφήσετε την ενέργεια να τελειώσει!',
    zh: '别耗尽能量！', ja: 'エネルギーを切らさないで！', hi: 'ऊर्जा खत्म न होने दें!', pt: 'Não fique sem energia!', ru: 'Не допустите конца энергии!',
  },
  outOfEnergy: {
    fr: 'Plus d\'énergie !', en: 'Out of Energy!', es: '¡Sin energía!', de: 'Energie aufgebraucht!', el: 'Χωρίς ενέργεια!',
    zh: '能量耗尽！', ja: 'エネルギー切れ！', hi: 'ऊर्जा खत्म!', pt: 'Sem energia!', ru: 'Энергия кончилась!',
  },
  timesUp: {
    fr: 'Temps écoulé !', en: "Time's Up!", es: '¡Se acabó el tiempo!', de: 'Zeit abgelaufen!', el: 'Ο χρόνος τελείωσε!',
    zh: '时间到！', ja: '時間切れ！', hi: 'समय खत्म!', pt: 'Tempo esgotado!', ru: 'Время вышло!',
  },
  energy: {
    fr: 'Énergie', en: 'Energy', es: 'Energía', de: 'Energie', el: 'Ενέργεια',
    zh: '能量', ja: 'エネルギー', hi: 'ऊर्जा', pt: 'Energia', ru: 'Энергия',
  },
  flying: {
    fr: 'EN VOL', en: 'FLYING', es: 'VOLANDO', de: 'FLUG', el: 'ΠΤΗΣΗ',
    zh: '飞行中', ja: '飛行中', hi: 'उड़ान', pt: 'VOANDO', ru: 'ПОЛЁТ',
  },
  torpor: {
    fr: 'TORPEUR', en: 'TORPOR', es: 'LETARGO', de: 'ERSTARRUNG', el: 'ΝΑΡΚΗ',
    zh: '蛰伏', ja: '休眠', hi: 'सुषुप्ति', pt: 'TORPOR', ru: 'ОЦЕПЕНЕНИЕ',
  },
  continueBtn: {
    fr: 'Continuer', en: 'Continue', es: 'Continuar', de: 'Weiter', el: 'Συνέχεια',
    zh: '继续', ja: '続ける', hi: 'जारी रखें', pt: 'Continuar', ru: 'Продолжить',
  },
  back: {
    fr: 'Retour', en: 'Back', es: 'Volver', de: 'Zurück', el: 'Πίσω',
    zh: '返回', ja: '戻る', hi: 'वापस', pt: 'Voltar', ru: 'Назад',
  },
  perfect: {
    fr: 'PARFAIT !', en: 'PERFECT!', es: '¡PERFECTO!', de: 'PERFEKT!', el: 'ΤΕΛΕΙΟ!',
    zh: '完美！', ja: 'パーフェクト！', hi: 'परफेक्ट!', pt: 'PERFEITO!', ru: 'ОТЛИЧНО!',
  },
  good: {
    fr: 'BIEN !', en: 'GOOD!', es: '¡BIEN!', de: 'GUT!', el: 'ΚΑΛΑ!',
    zh: '好！', ja: 'グッド！', hi: 'अच्छा!', pt: 'BOM!', ru: 'ХОРОШО!',
  },
  miss: {
    fr: 'RATÉ', en: 'MISS', es: 'FALLO', de: 'DANEBEN', el: 'ΑΣΤΟΧΙΑ',
    zh: '未命中', ja: 'ミス', hi: 'चूक', pt: 'FALHOU', ru: 'ПРОМАХ',
  },
  tapInSync: {
    fr: 'Tapez en rythme avec le pouls', en: 'Tap in sync with the pulse', es: 'Toca en sincronía con el pulso', de: 'Tippe im Takt mit dem Puls', el: 'Πατήστε στο ρυθμό του παλμού',
    zh: '跟着脉搏节奏点击', ja: 'パルスに合わせてタップ', hi: 'नब्ज के साथ टैप करें', pt: 'Toque em sincronia com o pulso', ru: 'Нажимайте в ритм с пульсом',
  },
  bestStreak: {
    fr: 'Meilleure série', en: 'Best Streak', es: 'Mejor racha', de: 'Beste Serie', el: 'Καλύτερο σερί',
    zh: '最佳连击', ja: 'ベストストリーク', hi: 'सर्वश्रेष्ठ श्रृंखला', pt: 'Melhor sequência', ru: 'Лучшая серия',
  },
  flyingTimeScore: {
    fr: 'score de temps de vol', en: 'flying time score', es: 'puntuación de tiempo de vuelo', de: 'Flugzeit-Punktzahl', el: 'σκορ χρόνου πτήσης',
    zh: '飞行时间得分', ja: '飛行時間スコア', hi: 'उड़ान समय स्कोर', pt: 'pontuação de tempo de voo', ru: 'очки полётного времени',
  },
  torporFact: {
    fr: 'Les colibris descendent à 3,3°C en torpeur !', en: 'Hummingbirds drop to 3.3°C in torpor!', es: '¡Los colibríes bajan a 3,3°C en letargo!', de: 'Kolibris sinken im Torpor auf 3,3°C!', el: 'Τα κολιμπρί πέφτουν στους 3,3°C σε νάρκη!',
    zh: '蜂鸟在蛰伏时体温降至3.3°C！', ja: 'ハチドリは休眠時に3.3°Cまで下がります！', hi: 'हमिंगबर्ड सुषुप्ति में 3.3°C तक गिर जाते हैं!', pt: 'Os beija-flores descem a 3,3°C em torpor!', ru: 'Колибри опускаются до 3,3°C в оцепенении!',
  },
  heartbeatFact: {
    fr: 'Le cœur d\'un colibri bat 1 260 fois par minute !', en: "A hummingbird's heart beats 1,260 times per minute!", es: '¡El corazón de un colibrí late 1.260 veces por minuto!', de: 'Das Herz eines Kolibris schlägt 1.260 Mal pro Minute!', el: 'Η καρδιά ενός κολιμπρί χτυπά 1.260 φορές το λεπτό!',
    zh: '蜂鸟的心脏每分钟跳动1260次！', ja: 'ハチドリの心臓は1分間に1,260回鼓動します！', hi: 'हमिंगबर्ड का दिल प्रति मिनट 1,260 बार धड़कता है!', pt: 'O coração de um beija-flor bate 1.260 vezes por minuto!', ru: 'Сердце колибри бьётся 1 260 раз в минуту!',
  },
  nextGame: {
    fr: 'Jeu suivant', en: 'Next Game', es: 'Siguiente juego', de: 'Nächstes Spiel', el: 'Επόμενο παιχνίδι',
    zh: '下一个游戏', ja: '次のゲーム', hi: 'अगला गेम', pt: 'Próximo jogo', ru: 'Следующая игра',
  },
  goldenTickets: {
    fr: 'Golden Tickets', en: 'Golden Tickets', es: 'Golden Tickets', de: 'Golden Tickets', el: 'Golden Tickets',
    zh: '黄金票', ja: 'ゴールデンチケット', hi: 'गोल्डन टिकट', pt: 'Golden Tickets', ru: 'Золотые билеты',
  },
  loading: {
    fr: 'Chargement...', en: 'Loading...', es: 'Cargando...', de: 'Laden...', el: 'Φόρτωση...',
    zh: '加载中...', ja: '読み込み中...', hi: 'लोड हो रहा है...', pt: 'Carregando...', ru: 'Загрузка...',
  },
  parrotsGiveTokens: {
    fr: 'Les perroquets donnent 10/10 jetons', en: 'Parrots give 10/10 tokens', es: 'Los loros dan 10/10 fichas', de: 'Papageien geben 10/10 Token', el: 'Οι παπαγάλοι δίνουν 10/10 μάρκες',
    zh: '鹦鹉给出10/10代币', ja: 'オウムは10/10トークンを与えます', hi: 'तोते 10/10 टोकन देते हैं', pt: 'Papagaios dão 10/10 fichas', ru: 'Попугаи дают 10/10 жетонов',
  },
  withoutHesitation: {
    fr: 'sans hésitation !', en: 'without hesitation!', es: '¡sin dudar!', de: 'ohne zu zögern!', el: 'χωρίς δισταγμό!',
    zh: '毫不犹豫！', ja: 'ためらいなく！', hi: 'बिना हिचकिचाहट!', pt: 'sem hesitação!', ru: 'без колебаний!',
  },
  swipeTokensToPartner: {
    fr: 'Glissez les jetons → vers votre partenaire', en: 'Swipe tokens → to your partner', es: 'Desliza fichas → a tu compañero', de: 'Wische Token → zu deinem Partner', el: 'Σύρετε μάρκες → στον σύντροφό σας',
    zh: '滑动代币 → 给你的伙伴', ja: 'トークンをスワイプ → パートナーへ', hi: 'टोकन स्वाइप करें → अपने साथी को', pt: 'Deslize fichas → para o seu parceiro', ru: 'Свайпните жетоны → партнёру',
  },
  fast: {
    fr: 'RAPIDE !', en: 'FAST!', es: '¡RÁPIDO!', de: 'SCHNELL!', el: 'ΓΡΗΓΟΡΑ!',
    zh: '快速！', ja: '速い！', hi: 'तेज़!', pt: 'RÁPIDO!', ru: 'БЫСТРО!',
  },
  ok: {
    fr: 'OK', en: 'OK', es: 'OK', de: 'OK', el: 'ΟΚ',
    zh: '还行', ja: 'OK', hi: 'ठीक', pt: 'OK', ru: 'ОК',
  },
  tooSlow: {
    fr: 'Trop lent...', en: 'Too slow...', es: 'Muy lento...', de: 'Zu langsam...', el: 'Πολύ αργά...',
    zh: '太慢了...', ja: '遅すぎ...', hi: 'बहुत धीमा...', pt: 'Muito lento...', ru: 'Слишком медленно...',
  },
  parrotsShareWithoutHesitation: {
    fr: 'Les perroquets partagent sans hésitation !', en: 'Parrots share without hesitation!', es: '¡Los loros comparten sin dudar!', de: 'Papageien teilen ohne zu zögern!', el: 'Οι παπαγάλοι μοιράζονται χωρίς δισταγμό!',
    zh: '鹦鹉毫不犹豫地分享！', ja: 'オウムはためらいなく分かち合います！', hi: 'तोते बिना हिचकिचाहट साझा करते हैं!', pt: 'Papagaios partilham sem hesitação!', ru: 'Попугаи делятся без колебаний!',
  },
  tokens: {
    fr: 'jetons', en: 'tokens', es: 'fichas', de: 'Token', el: 'μάρκες',
    zh: '代币', ja: 'トークン', hi: 'टोकन', pt: 'fichas', ru: 'жетонов',
  },
  pts: {
    fr: 'pts', en: 'pts', es: 'pts', de: 'Pkt', el: 'πόν',
    zh: '分', ja: 'pt', hi: 'अंक', pt: 'pts', ru: 'очк',
  },
};

// ---------------------------------------------------------------------------
// CHAPTER_TITLES
// ---------------------------------------------------------------------------
export const CHAPTER_TITLES = {
  'Ch.1': {
    fr: 'Le Colibri', en: 'The Hummingbird', es: 'El Colibrí', de: 'Der Kolibri', el: 'Ο Κολιμπρί',
    zh: '蜂鸟', ja: 'ハチドリ', hi: 'हमिंगबर्ड', pt: 'O Beija-flor', ru: 'Колибри',
  },
  'Ch.2': {
    fr: 'Le Perroquet', en: 'The Parrot', es: 'El Loro', de: 'Der Papagei', el: 'Ο Παπαγάλος',
    zh: '鹦鹉', ja: 'オウム', hi: 'तोता', pt: 'O Papagaio', ru: 'Попугай',
  },
  'Ch.3': {
    fr: 'Le Toucan', en: 'The Toucan', es: 'El Tucán', de: 'Der Tukan', el: 'Ο Τουκάν',
    zh: '巨嘴鸟', ja: 'オオハシ', hi: 'टूकन', pt: 'O Tucano', ru: 'Тукан',
  },
  'Ch.4': {
    fr: "L'Architecte", en: 'The Architect', es: 'El Arquitecto', de: 'Der Architekt', el: 'Ο Αρχιτέκτονας',
    zh: '建筑师', ja: '建築家', hi: 'वास्तुकार', pt: 'O Arquiteto', ru: 'Архитектор',
  },
  'Ch.5': {
    fr: 'Le Pélican', en: 'The Pelican', es: 'El Pelícano', de: 'Der Pelikan', el: 'Ο Πελεκάνος',
    zh: '鹈鹕', ja: 'ペリカン', hi: 'पेलिकन', pt: 'O Pelicano', ru: 'Пеликан',
  },
  Bonus: {
    fr: 'Bonus', en: 'Bonus', es: 'Bonus', de: 'Bonus', el: 'Μπόνους',
    zh: '额外关卡', ja: 'ボーナス', hi: 'बोनस', pt: 'Bónus', ru: 'Бонус',
  },
};

// ---------------------------------------------------------------------------
// LEGENDS — narrative intro / victory / defeat for each chapter
// ---------------------------------------------------------------------------
export const LEGENDS = {
  'Ch.1': {
    intro: {
      fr: "Le colibri possède le cœur le plus rapide du monde animal. Ses ailes battent 80 fois par seconde et il est le seul oiseau à voler en arrière.",
      en: "The hummingbird has the fastest heart in the animal kingdom. Its wings beat 80 times per second and it is the only bird that can fly backwards.",
      es: "El colibrí tiene el corazón más rápido del reino animal. Sus alas baten 80 veces por segundo y es el único pájaro capaz de volar hacia atrás.",
      de: "Der Kolibri hat das schnellste Herz im Tierreich. Seine Flügel schlagen 80 Mal pro Sekunde und er ist der einzige Vogel, der rückwärts fliegen kann.",
      el: "Ο κολιμπρί έχει την πιο γρήγορη καρδιά στο ζωικό βασίλειο. Τα φτερά του χτυπούν 80 φορές το δευτερόλεπτο και είναι το μόνο πουλί που πετά ανάποδα.",
      zh: "蜂鸟拥有动物王国中最快的心脏。它的翅膀每秒拍打80次，是唯一能倒飞的鸟类。",
      ja: "ハチドリは動物界で最も速い心臓を持っています。翼は毎秒80回羽ばたき、後ろ向きに飛べる唯一の鳥です。",
      hi: "हमिंगबर्ड के पास जानवरों की दुनिया में सबसे तेज़ दिल है। इसके पंख प्रति सेकंड 80 बार फड़फड़ाते हैं और यह एकमात्र पक्षी है जो पीछे की ओर उड़ सकता है।",
      pt: "O beija-flor tem o coração mais rápido do reino animal. As suas asas batem 80 vezes por segundo e é o único pássaro que voa para trás.",
      ru: "У колибри самое быстрое сердце в животном мире. Его крылья бьют 80 раз в секунду, и это единственная птица, способная летать задом наперёд.",
    },
    victory: {
      fr: "Le colibri a triomphé ! Son cœur infatigable a battu tous les records.",
      en: "The hummingbird triumphed! Its tireless heart broke every record.",
      es: "¡El colibrí triunfó! Su corazón incansable batió todos los récords.",
      de: "Der Kolibri hat triumphiert! Sein unermüdliches Herz brach alle Rekorde.",
      el: "Ο κολιμπρί θριάμβευσε! Η ακούραστη καρδιά του έσπασε κάθε ρεκόρ.",
      zh: "蜂鸟胜利了！它不知疲倦的心脏打破了所有纪录。",
      ja: "ハチドリが勝利しました！その不屈の心臓があらゆる記録を破りました。",
      hi: "हमिंगबर्ड ने जीत हासिल की! उसके अथक दिल ने हर रिकॉर्ड तोड़ दिया।",
      pt: "O beija-flor triunfou! O seu coração incansável bateu todos os recordes.",
      ru: "Колибри победил! Его неутомимое сердце побило все рекорды.",
    },
    defeat: {
      fr: "Le colibri doit reprendre son souffle. Même les plus rapides ont besoin de repos.",
      en: "The hummingbird must catch its breath. Even the fastest need rest.",
      es: "El colibrí necesita recuperar el aliento. Hasta los más rápidos necesitan descanso.",
      de: "Der Kolibri muss Atem holen. Selbst die Schnellsten brauchen Ruhe.",
      el: "Ο κολιμπρί πρέπει να πάρει ανάσα. Ακόμα και οι πιο γρήγοροι χρειάζονται ξεκούραση.",
      zh: "蜂鸟需要喘口气。即使是最快的也需要休息。",
      ja: "ハチドリは息を整えなければなりません。最速でも休息は必要です。",
      hi: "हमिंगबर्ड को साँस लेनी चाहिए। सबसे तेज़ को भी आराम की ज़रूरत होती है।",
      pt: "O beija-flor precisa recuperar o fôlego. Até os mais rápidos precisam de descanso.",
      ru: "Колибри должен перевести дух. Даже самым быстрым нужен отдых.",
    },
  },
  'Ch.2': {
    intro: {
      fr: "Dans la légende Jataka, le perroquet donne sans compter. Il plonge dans le lac et survole les flammes pour sauver la forêt.",
      en: "In the Jataka legend, the parrot gives selflessly. It dives into the lake and flies over flames to save the forest.",
      es: "En la leyenda Jataka, el loro da sin calcular. Se sumerge en el lago y vuela sobre las llamas para salvar el bosque.",
      de: "In der Jataka-Legende gibt der Papagei selbstlos. Er taucht in den See und fliegt über die Flammen, um den Wald zu retten.",
      el: "Στον μύθο Τζάτακα, ο παπαγάλος προσφέρει ανιδιοτελώς. Βουτά στη λίμνη και πετά πάνω από τις φλόγες για να σώσει το δάσος.",
      zh: "在本生故事中，鹦鹉无私奉献。它潜入湖中，飞越火焰来拯救森林。",
      ja: "ジャータカ伝説で、オウムは無私に与えます。湖に潜り、炎を越えて森を救います。",
      hi: "जातक कथा में, तोता निःस्वार्थ भाव से देता है। वह झील में गोता लगाता है और जंगल को बचाने के लिए आग के ऊपर उड़ता है।",
      pt: "Na lenda Jataka, o papagaio dá sem calcular. Mergulha no lago e voa sobre as chamas para salvar a floresta.",
      ru: "В легенде Джатака попугай отдаёт бескорыстно. Он ныряет в озеро и летит сквозь пламя, чтобы спасти лес.",
    },
    victory: {
      fr: "Le perroquet a sauvé la forêt ! Sa générosité a éteint les flammes.",
      en: "The parrot saved the forest! Its generosity extinguished the flames.",
      es: "¡El loro salvó el bosque! Su generosidad apagó las llamas.",
      de: "Der Papagei hat den Wald gerettet! Seine Großzügigkeit löschte die Flammen.",
      el: "Ο παπαγάλος έσωσε το δάσος! Η γενναιοδωρία του έσβησε τις φλόγες.",
      zh: "鹦鹉拯救了森林！它的慷慨扑灭了火焰。",
      ja: "オウムが森を救いました！その寛大さが炎を消しました。",
      hi: "तोते ने जंगल बचा लिया! उसकी उदारता ने आग बुझा दी।",
      pt: "O papagaio salvou a floresta! A sua generosidade extinguiu as chamas.",
      ru: "Попугай спас лес! Его щедрость погасила пламя.",
    },
    defeat: {
      fr: "Les flammes sont trop fortes. Mais le perroquet reviendra, il revient toujours.",
      en: "The flames are too strong. But the parrot will return — it always does.",
      es: "Las llamas son demasiado fuertes. Pero el loro volverá, siempre lo hace.",
      de: "Die Flammen sind zu stark. Aber der Papagei wird zurückkehren — das tut er immer.",
      el: "Οι φλόγες είναι πολύ δυνατές. Αλλά ο παπαγάλος θα επιστρέψει — πάντα το κάνει.",
      zh: "火焰太猛烈了。但鹦鹉会回来的，它总会回来。",
      ja: "炎が強すぎます。しかしオウムは戻ってきます——いつもそうです。",
      hi: "आग बहुत तेज़ है। लेकिन तोता वापस आएगा — वह हमेशा आता है।",
      pt: "As chamas são demasiado fortes. Mas o papagaio voltará — sempre volta.",
      ru: "Пламя слишком сильное. Но попугай вернётся — он всегда возвращается.",
    },
  },
  'Ch.3': {
    intro: {
      fr: "Le toucan est le jardinier de la forêt tropicale. En dispersant les graines, il fait pousser l'avenir.",
      en: "The toucan is the tropical forest's gardener. By dispersing seeds, it grows the future.",
      es: "El tucán es el jardinero de la selva tropical. Al dispersar semillas, cultiva el futuro.",
      de: "Der Tukan ist der Gärtner des Regenwaldes. Durch die Verbreitung von Samen lässt er die Zukunft wachsen.",
      el: "Ο τουκάν είναι ο κηπουρός του τροπικού δάσους. Διασπείροντας σπόρους, καλλιεργεί το μέλλον.",
      zh: "巨嘴鸟是热带雨林的园丁。通过传播种子，它播种未来。",
      ja: "オオハシは熱帯雨林の庭師です。種を散布することで、未来を育てます。",
      hi: "टूकन उष्णकटिबंधीय वन का माली है। बीज फैलाकर, यह भविष्य उगाता है।",
      pt: "O tucano é o jardineiro da floresta tropical. Ao dispersar sementes, faz crescer o futuro.",
      ru: "Тукан — садовник тропического леса. Рассеивая семена, он выращивает будущее.",
    },
    victory: {
      fr: "Le toucan a semé la forêt de demain. Chaque graine est une promesse.",
      en: "The toucan seeded tomorrow's forest. Every seed is a promise.",
      es: "El tucán sembró el bosque del mañana. Cada semilla es una promesa.",
      de: "Der Tukan hat den Wald von morgen gesät. Jeder Same ist ein Versprechen.",
      el: "Ο τουκάν έσπειρε το δάσος του αύριο. Κάθε σπόρος είναι μια υπόσχεση.",
      zh: "巨嘴鸟播种了明天的森林。每一颗种子都是一个承诺。",
      ja: "オオハシが明日の森の種を蒔きました。すべての種は約束です。",
      hi: "टूकन ने कल के जंगल के बीज बोए। हर बीज एक वादा है।",
      pt: "O tucano semeou a floresta de amanhã. Cada semente é uma promessa.",
      ru: "Тукан посеял лес будущего. Каждое семя — это обещание.",
    },
    defeat: {
      fr: "Quelques graines sont tombées, mais le toucan n'abandonne jamais sa mission.",
      en: "A few seeds were lost, but the toucan never abandons its mission.",
      es: "Algunas semillas se perdieron, pero el tucán nunca abandona su misión.",
      de: "Ein paar Samen gingen verloren, aber der Tukan gibt seine Mission nie auf.",
      el: "Μερικοί σπόροι χάθηκαν, αλλά ο τουκάν δεν εγκαταλείπει ποτέ την αποστολή του.",
      zh: "有些种子丢失了，但巨嘴鸟从不放弃自己的使命。",
      ja: "いくつかの種は失われましたが、オオハシは決して使命を諦めません。",
      hi: "कुछ बीज खो गए, लेकिन टूकन कभी अपना मिशन नहीं छोड़ता।",
      pt: "Algumas sementes perderam-se, mas o tucano nunca abandona a sua missão.",
      ru: "Несколько семян было потеряно, но тукан никогда не бросает свою миссию.",
    },
  },
  'Ch.4': {
    intro: {
      fr: "Dans la légende Haïda, Dukdukdiya construit son nid par amour. Chaque brindille est un battement d'aile offert.",
      en: "In the Haida legend, Dukdukdiya builds its nest with love. Every twig is a wing-beat offered.",
      es: "En la leyenda Haida, Dukdukdiya construye su nido con amor. Cada ramita es un aleteo ofrecido.",
      de: "In der Haida-Legende baut Dukdukdiya sein Nest aus Liebe. Jedes Ästchen ist ein geschenkter Flügelschlag.",
      el: "Στον μύθο Χάιντα, ο Ντουκντουκντίγια χτίζει τη φωλιά του με αγάπη. Κάθε κλαδάκι είναι ένα χτύπημα φτερού.",
      zh: "在海达传说中，杜克杜克迪亚用爱筑巢。每一根树枝都是一次翅膀的馈赠。",
      ja: "ハイダの伝説で、ドゥクドゥクディヤは愛で巣を作ります。すべての小枝は翼の一振りの贈り物です。",
      hi: "हैदा की कथा में, दुकदुकदिया प्रेम से अपना घोंसला बनाता है। हर टहनी पंखों की एक भेंट है।",
      pt: "Na lenda Haida, Dukdukdiya constrói o ninho com amor. Cada graveto é uma batida de asa oferecida.",
      ru: "В легенде Хайда Дукдукдия строит гнездо с любовью. Каждая веточка — подарённый взмах крыла.",
    },
    victory: {
      fr: "Le nid est achevé ! Dukdukdiya a construit un foyer digne de son amour.",
      en: "The nest is complete! Dukdukdiya built a home worthy of its love.",
      es: "¡El nido está terminado! Dukdukdiya construyó un hogar digno de su amor.",
      de: "Das Nest ist fertig! Dukdukdiya hat ein Zuhause gebaut, das seiner Liebe würdig ist.",
      el: "Η φωλιά ολοκληρώθηκε! Ο Ντουκντουκντίγια έχτισε ένα σπίτι αντάξιο της αγάπης του.",
      zh: "巢完成了！杜克杜克迪亚建造了配得上它的爱的家。",
      ja: "巣が完成しました！ドゥクドゥクディヤはその愛にふさわしい家を建てました。",
      hi: "घोंसला पूरा हो गया! दुकदुकदिया ने अपने प्रेम के योग्य घर बनाया।",
      pt: "O ninho está completo! Dukdukdiya construiu um lar digno do seu amor.",
      ru: "Гнездо завершено! Дукдукдия построил дом, достойный своей любви.",
    },
    defeat: {
      fr: "Le nid s'est effondré, mais l'amour de Dukdukdiya le reconstruira.",
      en: "The nest collapsed, but Dukdukdiya's love will rebuild it.",
      es: "El nido se derrumbó, pero el amor de Dukdukdiya lo reconstruirá.",
      de: "Das Nest ist eingestürzt, aber Dukdukdiyas Liebe wird es wieder aufbauen.",
      el: "Η φωλιά κατέρρευσε, αλλά η αγάπη του Ντουκντουκντίγια θα την ξαναχτίσει.",
      zh: "巢塌了，但杜克杜克迪亚的爱会重建它。",
      ja: "巣は崩れましたが、ドゥクドゥクディヤの愛が再び築くでしょう。",
      hi: "घोंसला गिर गया, लेकिन दुकदुकदिया का प्रेम इसे फिर बनाएगा।",
      pt: "O ninho desmoronou, mas o amor de Dukdukdiya irá reconstruí-lo.",
      ru: "Гнездо рухнуло, но любовь Дукдукдии восстановит его.",
    },
  },
  'Ch.5': {
    intro: {
      fr: "Les pélicans chassent en groupe, formant des demi-cercles parfaits. Un seul signal déclenche la synchronisation de tous.",
      en: "Pelicans hunt in groups, forming perfect semi-circles. A single signal triggers everyone's synchronization.",
      es: "Los pelícanos cazan en grupo formando semicírculos perfectos. Una sola señal desencadena la sincronización de todos.",
      de: "Pelikane jagen in Gruppen und bilden perfekte Halbkreise. Ein einziges Signal löst die Synchronisation aller aus.",
      el: "Οι πελεκάνοι κυνηγούν ομαδικά, σχηματίζοντας τέλειους ημικύκλους. Ένα μόνο σήμα ενεργοποιεί τον συγχρονισμό όλων.",
      zh: "鹈鹕成群狩猎，形成完美的半圆。一个信号就能触发所有成员的同步。",
      ja: "ペリカンは群れで狩りをし、完璧な半円を形成します。一つの合図で全員が同期します。",
      hi: "पेलिकन समूह में शिकार करते हैं, पूर्ण अर्ध-वृत्त बनाते हैं। एक ही संकेत सबके सिंक्रनाइज़ेशन को शुरू करता है।",
      pt: "Os pelicanos caçam em grupo, formando semicírculos perfeitos. Um único sinal desencadeia a sincronização de todos.",
      ru: "Пеликаны охотятся группой, образуя идеальные полукруги. Один сигнал запускает синхронизацию всех.",
    },
    victory: {
      fr: "La pêche est un succès ! L'intelligence collective a encore frappé.",
      en: "The catch is a success! Collective intelligence strikes again.",
      es: "¡La pesca es un éxito! La inteligencia colectiva triunfa de nuevo.",
      de: "Der Fang ist ein Erfolg! Die kollektive Intelligenz hat wieder zugeschlagen.",
      el: "Η ψαριά πέτυχε! Η συλλογική νοημοσύνη χτυπά ξανά.",
      zh: "捕鱼成功！集体智慧再次取得胜利。",
      ja: "漁が成功しました！集団知性がまた勝利しました。",
      hi: "शिकार सफल रहा! सामूहिक बुद्धिमत्ता ने फिर से काम किया।",
      pt: "A pesca foi um sucesso! A inteligência coletiva voltou a vencer.",
      ru: "Улов удался! Коллективный разум снова победил.",
    },
    defeat: {
      fr: "Les poissons se sont échappés. Le groupe doit se resynchroniser.",
      en: "The fish escaped. The group must resynchronize.",
      es: "Los peces escaparon. El grupo debe resincronizarse.",
      de: "Die Fische sind entkommen. Die Gruppe muss sich neu synchronisieren.",
      el: "Τα ψάρια ξέφυγαν. Η ομάδα πρέπει να επανασυγχρονιστεί.",
      zh: "鱼逃走了。群体必须重新同步。",
      ja: "魚が逃げました。グループは再同期しなければなりません。",
      hi: "मछलियाँ भाग गईं। समूह को फिर से सिंक्रनाइज़ होना होगा।",
      pt: "Os peixes escaparam. O grupo precisa ressincronizar-se.",
      ru: "Рыба ускользнула. Группе нужно пересинхронизироваться.",
    },
  },
};

// ---------------------------------------------------------------------------
// GAME_NAMES — all 26 games in 10 languages, keyed by zero-padded id
// ---------------------------------------------------------------------------
export const GAME_NAMES = {
  '01': {
    fr: 'Heartbeat Rush', en: 'Heartbeat Rush', es: 'Latido Frenético', de: 'Herzschlag-Rausch', el: 'Καρδιακός Παλμός',
    zh: '心跳冲刺', ja: 'ハートビートラッシュ', hi: 'हार्टबीट रश', pt: 'Batida Cardíaca', ru: 'Биение сердца',
  },
  '02': {
    fr: 'Torpeur', en: 'Torpor', es: 'Letargo', de: 'Erstarrung', el: 'Νάρκη',
    zh: '蛰伏', ja: '休眠', hi: 'सुषुप्ति', pt: 'Torpor', ru: 'Оцепенение',
  },
  '03': {
    fr: 'Reverse Flight', en: 'Reverse Flight', es: 'Vuelo Inverso', de: 'Rückwärtsflug', el: 'Ανάστροφη Πτήση',
    zh: '倒飞', ja: 'リバースフライト', hi: 'रिवर्स फ्लाइट', pt: 'Voo Reverso', ru: 'Полёт назад',
  },
  '04': {
    fr: '800km La Traversée', en: '800km The Crossing', es: '800km La Travesía', de: '800km Die Überquerung', el: '800km Η Διάσχιση',
    zh: '800公里大穿越', ja: '800km 大横断', hi: '800km पार', pt: '800km A Travessia', ru: '800км Переправа',
  },
  '05': {
    fr: 'Wing Beat Challenge', en: 'Wing Beat Challenge', es: 'Desafío de Aleteo', de: 'Flügelschlag-Challenge', el: 'Πρόκληση Φτερουγίσματος',
    zh: '振翅挑战', ja: 'ウィングビートチャレンジ', hi: 'विंग बीट चैलेंज', pt: 'Desafio de Asas', ru: 'Вызов взмахов',
  },
  '06': {
    fr: '300 Cheeseburgers', en: '300 Cheeseburgers', es: '300 Hamburguesas', de: '300 Cheeseburger', el: '300 Τσίζμπεργκερ',
    zh: '300个芝士汉堡', ja: '300チーズバーガー', hi: '300 चीज़बर्गर', pt: '300 Cheeseburgers', ru: '300 Чизбургеров',
  },
  '07': {
    fr: 'Super Brain', en: 'Super Brain', es: 'Súper Cerebro', de: 'Superhirn', el: 'Σούπερ Εγκέφαλος',
    zh: '超级大脑', ja: 'スーパーブレイン', hi: 'सुपर ब्रेन', pt: 'Super Cérebro', ru: 'Супер мозг',
  },
  '08': {
    fr: 'Timbre Express', en: 'Stamp Express', es: 'Sello Express', de: 'Briefmarken Express', el: 'Γραμματόσημο Εξπρές',
    zh: '邮票快递', ja: 'スタンプエクスプレス', hi: 'स्टैम्प एक्सप्रेस', pt: 'Selo Expresso', ru: 'Марка Экспресс',
  },
  '09': {
    fr: 'Don Bec-à-Bec', en: 'Beak-to-Beak Gift', es: 'Pico a Pico', de: 'Schnabel-Geschenk', el: 'Ράμφος με Ράμφος',
    zh: '喙对喙的礼物', ja: 'くちばしの贈り物', hi: 'चोंच से चोंच', pt: 'Bico a Bico', ru: 'Клюв к клюву',
  },
  '10': {
    fr: 'Transformation Arc-en-ciel', en: 'Rainbow Transformation', es: 'Transformación Arcoíris', de: 'Regenbogen-Verwandlung', el: 'Μεταμόρφωση Ουράνιου Τόξου',
    zh: '彩虹变身', ja: 'レインボー変身', hi: 'इंद्रधनुष परिवर्तन', pt: 'Transformação Arco-íris', ru: 'Радужное превращение',
  },
  '11': {
    fr: 'Zéro Jalousie', en: 'Zero Jealousy', es: 'Cero Celos', de: 'Null Eifersucht', el: 'Μηδέν Ζήλια',
    zh: '零嫉妒', ja: 'ゼロ嫉妬', hi: 'शून्य ईर्ष्या', pt: 'Zero Ciúme', ru: 'Ноль ревности',
  },
  '12': {
    fr: 'Le Perroquet Comprend', en: 'The Parrot Understands', es: 'El Loro Comprende', de: 'Der Papagei versteht', el: 'Ο Παπαγάλος Καταλαβαίνει',
    zh: '鹦鹉理解', ja: 'オウムは理解する', hi: 'तोता समझता है', pt: 'O Papagaio Compreende', ru: 'Попугай понимает',
  },
  '13': {
    fr: '10 sur 10', en: '10 out of 10', es: '10 de 10', de: '10 von 10', el: '10 στα 10',
    zh: '十全十美', ja: '10点満点', hi: '10 में 10', pt: '10 em 10', ru: '10 из 10',
  },
  '14': {
    fr: 'Plongeon Sacré', en: 'Sacred Dive', es: 'Zambullida Sagrada', de: 'Heiliger Tauchgang', el: 'Ιερή Βουτιά',
    zh: '神圣之潜', ja: '聖なるダイブ', hi: 'पवित्र गोता', pt: 'Mergulho Sagrado', ru: 'Священное погружение',
  },
  '15': {
    fr: 'Semi-Cercle', en: 'Semi-Circle', es: 'Semicírculo', de: 'Halbkreis', el: 'Ημικύκλιο',
    zh: '半圆阵', ja: 'セミサークル', hi: 'अर्ध-वृत्त', pt: 'Semicírculo', ru: 'Полукруг',
  },
  '16': {
    fr: 'Signal Domino', en: 'Domino Signal', es: 'Señal Dominó', de: 'Domino-Signal', el: 'Σήμα Ντόμινο',
    zh: '多米诺信号', ja: 'ドミノシグナル', hi: 'डोमिनो सिग्नल', pt: 'Sinal Dominó', ru: 'Сигнал домино',
  },
  '17': {
    fr: '11 Litres', en: '11 Liters', es: '11 Litros', de: '11 Liter', el: '11 Λίτρα',
    zh: '11升', ja: '11リットル', hi: '11 लीटर', pt: '11 Litros', ru: '11 Литров',
  },
  '18': {
    fr: 'École des Pélicans', en: 'Pelican School', es: 'Escuela de Pelícanos', de: 'Pelikanschule', el: 'Σχολείο Πελεκάνων',
    zh: '鹈鹕学校', ja: 'ペリカンスクール', hi: 'पेलिकन स्कूल', pt: 'Escola de Pelicanos', ru: 'Школа пеликанов',
  },
  '19': {
    fr: 'Lancer de Fruits', en: 'Fruit Toss', es: 'Lanzamiento de Frutas', de: 'Früchtewerfen', el: 'Ρίψη Φρούτων',
    zh: '抛水果', ja: 'フルーツトス', hi: 'फल फेंक', pt: 'Lançamento de Frutas', ru: 'Бросок фруктов',
  },
  '20': {
    fr: 'Dortoir à 6', en: 'Dorm for 6', es: 'Dormitorio para 6', de: 'Schlafsaal für 6', el: 'Κοιτώνας για 6',
    zh: '六鸟同眠', ja: '6羽の寝床', hi: '6 का छात्रावास', pt: 'Dormitório para 6', ru: 'Спальня на 6',
  },
  '21': {
    fr: 'Helpers at the Nest', en: 'Helpers at the Nest', es: 'Ayudantes del Nido', de: 'Nesthelfer', el: 'Βοηθοί στη Φωλιά',
    zh: '巢穴帮手', ja: '巣のヘルパー', hi: 'घोंसले के सहायक', pt: 'Ajudantes no Ninho', ru: 'Помощники в гнезде',
  },
  '22': {
    fr: 'Super Disperseur', en: 'Super Disperser', es: 'Súper Dispersor', de: 'Super-Verbreiter', el: 'Σούπερ Διασκορπιστής',
    zh: '超级播种者', ja: 'スーパー散布者', hi: 'सुपर डिस्पर्सर', pt: 'Super Dispersor', ru: 'Суперсеятель',
  },
  '23': {
    fr: 'Radiateur Naturel', en: 'Natural Radiator', es: 'Radiador Natural', de: 'Natürlicher Kühler', el: 'Φυσικό Καλοριφέρ',
    zh: '天然散热器', ja: '天然ラジエーター', hi: 'प्राकृतिक रेडिएटर', pt: 'Radiador Natural', ru: 'Природный радиатор',
  },
  '24': {
    fr: 'Nid de Dukdukdiya', en: "Dukdukdiya's Nest", es: 'Nido de Dukdukdiya', de: 'Dukdukdiyas Nest', el: 'Φωλιά του Ντουκντουκντίγια',
    zh: '杜克杜克迪亚之巢', ja: 'ドゥクドゥクディヤの巣', hi: 'दुकदुकदिया का घोंसला', pt: 'Ninho de Dukdukdiya', ru: 'Гнездо Дукдукдии',
  },
  '25': {
    fr: 'Bouclier de Heigig', en: "Heigig's Shield", es: 'Escudo de Heigig', de: 'Heigigs Schild', el: 'Ασπίδα του Χέιγκιγκ',
    zh: '海格格之盾', ja: 'ヘイギグの盾', hi: 'हेइगिग की ढाल', pt: 'Escudo de Heigig', ru: 'Щит Хейгига',
  },
  '26': {
    fr: "L'Éveilleur", en: 'The Awakener', es: 'El Despertador', de: 'Der Erwecker', el: 'Ο Αφυπνιστής',
    zh: '唤醒者', ja: '目覚めの者', hi: 'जागृतकर्ता', pt: 'O Despertador', ru: 'Пробудитель',
  },
};
