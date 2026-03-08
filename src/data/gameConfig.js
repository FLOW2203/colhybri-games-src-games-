// ---------------------------------------------------------------------------
// COLHYBRI GAMES — Game Configuration
// ---------------------------------------------------------------------------

import { GAMES } from '../games/engine/constants.js';
import { SCIENCE_FACTS } from './scienceFacts.js';
import { GAME_NAMES } from '../i18n/index.js';

// ---------------------------------------------------------------------------
// LESSONS — one per game (26 entries), 10 languages
// ---------------------------------------------------------------------------
export const LESSONS = {
  '01': {
    fr: "La persévérance a un rythme.",
    en: "Perseverance has a rhythm.",
    es: "La perseverancia tiene un ritmo.",
    de: "Ausdauer hat einen Rhythmus.",
    el: "Η επιμονή έχει ρυθμό.",
    zh: "坚持有自己的节奏。",
    ja: "忍耐にはリズムがある。",
    hi: "दृढ़ता की एक लय होती है।",
    pt: "A perseverança tem um ritmo.",
    ru: "У упорства есть ритм.",
  },
  '02': {
    fr: "Savoir s'arrêter pour mieux repartir.",
    en: "Know when to stop to restart better.",
    es: "Saber detenerse para volver a empezar mejor.",
    de: "Wissen, wann man aufhört, um besser neu zu starten.",
    el: "Μάθε να σταματάς για να ξεκινήσεις καλύτερα.",
    zh: "懂得停下，才能更好地重新出发。",
    ja: "止まることを知れば、より良く再出発できる。",
    hi: "बेहतर शुरुआत के लिए रुकना सीखें।",
    pt: "Saber parar para recomeçar melhor.",
    ru: "Умей остановиться, чтобы начать заново.",
  },
  '03': {
    fr: "Regarder en arrière ouvre de nouvelles perspectives.",
    en: "Looking back opens new perspectives.",
    es: "Mirar atrás abre nuevas perspectivas.",
    de: "Zurückblicken eröffnet neue Perspektiven.",
    el: "Κοιτώντας πίσω ανοίγουν νέες προοπτικές.",
    zh: "回顾过去会打开新的视角。",
    ja: "振り返ることで新しい視点が開ける。",
    hi: "पीछे देखना नई दृष्टि खोलता है।",
    pt: "Olhar para trás abre novas perspetivas.",
    ru: "Взгляд назад открывает новые перспективы.",
  },
  '04': {
    fr: "Le courage, c'est traverser l'océan sans garantie.",
    en: "Courage is crossing the ocean with no guarantee.",
    es: "El coraje es cruzar el océano sin garantías.",
    de: "Mut ist, den Ozean ohne Garantie zu überqueren.",
    el: "Θάρρος είναι να διασχίζεις τον ωκεανό χωρίς εγγύηση.",
    zh: "勇气就是在没有保障的情况下横渡大洋。",
    ja: "勇気とは、保証なしに大海を渡ること。",
    hi: "साहस है बिना गारंटी के समुद्र पार करना।",
    pt: "Coragem é atravessar o oceano sem garantia.",
    ru: "Смелость — это пересечь океан без гарантий.",
  },
  '05': {
    fr: "La nature nous dépasse — et c'est magnifique.",
    en: "Nature surpasses us — and it's magnificent.",
    es: "La naturaleza nos supera — y es magnífico.",
    de: "Die Natur übertrifft uns — und das ist großartig.",
    el: "Η φύση μας ξεπερνά — και είναι υπέροχο.",
    zh: "自然超越了我们——这很壮丽。",
    ja: "自然は私たちを超える——そしてそれは素晴らしい。",
    hi: "प्रकृति हमसे आगे है — और यह शानदार है।",
    pt: "A natureza supera-nos — e isso é magnífico.",
    ru: "Природа превосходит нас — и это великолепно.",
  },
  '06': {
    fr: "L'énergie vitale se renouvelle sans cesse.",
    en: "Vital energy constantly renews itself.",
    es: "La energía vital se renueva sin cesar.",
    de: "Lebensenergie erneuert sich ständig.",
    el: "Η ζωτική ενέργεια ανανεώνεται αδιάκοπα.",
    zh: "生命能量不断自我更新。",
    ja: "生命エネルギーは絶えず更新される。",
    hi: "जीवन ऊर्जा लगातार नवीनीकृत होती है।",
    pt: "A energia vital renova-se constantemente.",
    ru: "Жизненная энергия постоянно обновляется.",
  },
  '07': {
    fr: "Un petit cerveau peut faire de grandes choses.",
    en: "A small brain can do great things.",
    es: "Un cerebro pequeño puede hacer grandes cosas.",
    de: "Ein kleines Gehirn kann Großes leisten.",
    el: "Ένας μικρός εγκέφαλος μπορεί να κάνει μεγάλα πράγματα.",
    zh: "小脑袋也能做大事。",
    ja: "小さな脳でも大きなことができる。",
    hi: "छोटा दिमाग भी बड़े काम कर सकता है।",
    pt: "Um cérebro pequeno pode fazer grandes coisas.",
    ru: "Маленький мозг может делать великие дела.",
  },
  '08': {
    fr: "La taille ne définit pas la valeur.",
    en: "Size doesn't define value.",
    es: "El tamaño no define el valor.",
    de: "Größe definiert nicht den Wert.",
    el: "Το μέγεθος δεν ορίζει την αξία.",
    zh: "大小不定义价值。",
    ja: "大きさは価値を決めない。",
    hi: "आकार मूल्य निर्धारित नहीं करता।",
    pt: "O tamanho não define o valor.",
    ru: "Размер не определяет ценность.",
  },
  '09': {
    fr: "Donner sans compter rapporte plus que garder.",
    en: "Giving without counting returns more than keeping.",
    es: "Dar sin contar da más que guardar.",
    de: "Geben ohne zu zählen bringt mehr als Behalten.",
    el: "Το να δίνεις χωρίς να μετράς αποδίδει περισσότερο από το να κρατάς.",
    zh: "不计回报的给予比保留更有价值。",
    ja: "計算なしに与えることは、保持するより多くを返す。",
    hi: "बिना गिने देना रखने से अधिक लौटाता है।",
    pt: "Dar sem contar rende mais do que guardar.",
    ru: "Отдавать не считая приносит больше, чем копить.",
  },
  '10': {
    fr: "Le courage transforme la douleur en beauté.",
    en: "Courage transforms pain into beauty.",
    es: "El coraje transforma el dolor en belleza.",
    de: "Mut verwandelt Schmerz in Schönheit.",
    el: "Το θάρρος μετατρέπει τον πόνο σε ομορφιά.",
    zh: "勇气将痛苦化为美丽。",
    ja: "勇気は痛みを美しさに変える。",
    hi: "साहस दर्द को सुंदरता में बदलता है।",
    pt: "A coragem transforma a dor em beleza.",
    ru: "Смелость превращает боль в красоту.",
  },
  '11': {
    fr: "La sérénité naît du détachement.",
    en: "Serenity is born from detachment.",
    es: "La serenidad nace del desapego.",
    de: "Gelassenheit entsteht durch Loslassen.",
    el: "Η γαλήνη γεννιέται από την αποδέσμευση.",
    zh: "平静源于放下。",
    ja: "心の平穏は執着を手放すことから生まれる。",
    hi: "शांति वैराग्य से जन्मती है।",
    pt: "A serenidade nasce do desapego.",
    ru: "Безмятежность рождается из непривязанности.",
  },
  '12': {
    fr: "Comprendre le bon moment change tout.",
    en: "Understanding the right moment changes everything.",
    es: "Comprender el momento justo lo cambia todo.",
    de: "Den richtigen Moment zu verstehen ändert alles.",
    el: "Η κατανόηση της σωστής στιγμής αλλάζει τα πάντα.",
    zh: "理解恰当的时机改变一切。",
    ja: "適切な瞬間を理解することがすべてを変える。",
    hi: "सही पल को समझना सब बदल देता है।",
    pt: "Compreender o momento certo muda tudo.",
    ru: "Понять нужный момент — значит изменить всё.",
  },
  '13': {
    fr: "La générosité vraie ne calcule pas.",
    en: "True generosity doesn't calculate.",
    es: "La verdadera generosidad no calcula.",
    de: "Wahre Großzügigkeit rechnet nicht.",
    el: "Η αληθινή γενναιοδωρία δεν υπολογίζει.",
    zh: "真正的慷慨不计算。",
    ja: "真の寛大さは計算しない。",
    hi: "सच्ची उदारता गणना नहीं करती।",
    pt: "A verdadeira generosidade não calcula.",
    ru: "Истинная щедрость не считает.",
  },
  '14': {
    fr: "Le courage est un cycle : plonger, porter, revenir.",
    en: "Courage is a cycle: dive, carry, return.",
    es: "El coraje es un ciclo: sumergirse, llevar, volver.",
    de: "Mut ist ein Kreislauf: tauchen, tragen, zurückkehren.",
    el: "Το θάρρος είναι κύκλος: βουτιά, μεταφορά, επιστροφή.",
    zh: "勇气是一个循环：潜入、承载、归来。",
    ja: "勇気はサイクル：潜り、運び、戻る。",
    hi: "साहस एक चक्र है: गोता लगाओ, ले जाओ, लौटो।",
    pt: "A coragem é um ciclo: mergulhar, carregar, voltar.",
    ru: "Смелость — это цикл: нырнуть, нести, вернуться.",
  },
  '15': {
    fr: "La coordination vaut plus que la force.",
    en: "Coordination is worth more than strength.",
    es: "La coordinación vale más que la fuerza.",
    de: "Koordination ist mehr wert als Kraft.",
    el: "Ο συντονισμός αξίζει περισσότερο από τη δύναμη.",
    zh: "协调比力量更有价值。",
    ja: "協調は力よりも価値がある。",
    hi: "समन्वय ताकत से अधिक मूल्यवान है।",
    pt: "A coordenação vale mais do que a força.",
    ru: "Координация ценнее силы.",
  },
  '16': {
    fr: "La réaction en chaîne naît de la synchronisation.",
    en: "Chain reaction is born from synchronization.",
    es: "La reacción en cadena nace de la sincronización.",
    de: "Die Kettenreaktion entsteht durch Synchronisation.",
    el: "Η αλυσιδωτή αντίδραση γεννιέται από τον συγχρονισμό.",
    zh: "连锁反应源于同步。",
    ja: "連鎖反応は同期から生まれる。",
    hi: "श्रृंखला प्रतिक्रिया सिंक्रनाइज़ेशन से जन्मती है।",
    pt: "A reação em cadeia nasce da sincronização.",
    ru: "Цепная реакция рождается из синхронизации.",
  },
  '17': {
    fr: "Contenir plus que prévu est un super-pouvoir.",
    en: "Holding more than expected is a superpower.",
    es: "Contener más de lo esperado es un superpoder.",
    de: "Mehr aufnehmen als erwartet ist eine Superkraft.",
    el: "Το να χωράς περισσότερα από το αναμενόμενο είναι υπερδύναμη.",
    zh: "容纳超出预期是一种超能力。",
    ja: "予想以上を受け止めることは超能力。",
    hi: "अपेक्षा से अधिक धारण करना एक महाशक्ति है।",
    pt: "Conter mais do que o esperado é um superpoder.",
    ru: "Вмещать больше ожидаемого — суперсила.",
  },
  '18': {
    fr: "Observer les anciens est la meilleure école.",
    en: "Watching the elders is the best school.",
    es: "Observar a los mayores es la mejor escuela.",
    de: "Den Älteren zuzuschauen ist die beste Schule.",
    el: "Παρατηρώντας τους μεγαλύτερους είναι το καλύτερο σχολείο.",
    zh: "观察长者是最好的学校。",
    ja: "年長者を観察することが最高の学校。",
    hi: "बड़ों को देखना सबसे अच्छा स्कूल है।",
    pt: "Observar os mais velhos é a melhor escola.",
    ru: "Наблюдать за старшими — лучшая школа.",
  },
  '19': {
    fr: "Le partage est une danse.",
    en: "Sharing is a dance.",
    es: "Compartir es una danza.",
    de: "Teilen ist ein Tanz.",
    el: "Το μοίρασμα είναι χορός.",
    zh: "分享是一支舞蹈。",
    ja: "分かち合いはダンスである。",
    hi: "साझा करना एक नृत्य है।",
    pt: "Partilhar é uma dança.",
    ru: "Делиться — это танец.",
  },
  '20': {
    fr: "La chaleur vient du nombre.",
    en: "Warmth comes from togetherness.",
    es: "El calor viene del grupo.",
    de: "Wärme kommt aus der Gemeinschaft.",
    el: "Η ζεστασιά έρχεται από τη συντροφιά.",
    zh: "温暖来自团聚。",
    ja: "温もりは仲間から生まれる。",
    hi: "गर्माहट एकजुटता से आती है।",
    pt: "O calor vem do grupo.",
    ru: "Тепло приходит от единства.",
  },
  '21': {
    fr: "Aider sans lien de sang est la plus haute forme d'amour.",
    en: "Helping without blood ties is the highest form of love.",
    es: "Ayudar sin lazos de sangre es la forma más alta de amor.",
    de: "Helfen ohne Blutsverwandtschaft ist die höchste Form der Liebe.",
    el: "Η βοήθεια χωρίς δεσμούς αίματος είναι η υψηλότερη μορφή αγάπης.",
    zh: "无血缘的帮助是爱的最高形式。",
    ja: "血縁なき助けは愛の最高の形。",
    hi: "बिना खून के रिश्ते के मदद करना प्रेम का सर्वोच्च रूप है।",
    pt: "Ajudar sem laço de sangue é a forma mais elevada de amor.",
    ru: "Помогать без кровных уз — высшая форма любви.",
  },
  '22': {
    fr: "Disperser le bien multiplie le bien.",
    en: "Dispersing good multiplies good.",
    es: "Dispersar el bien multiplica el bien.",
    de: "Gutes zu verbreiten vermehrt das Gute.",
    el: "Η διασπορά του καλού πολλαπλασιάζει το καλό.",
    zh: "播撒善良会让善良加倍。",
    ja: "善を広めることで善は増える。",
    hi: "अच्छाई फैलाना अच्छाई को बढ़ाता है।",
    pt: "Dispersar o bem multiplica o bem.",
    ru: "Распространять добро — значит умножать добро.",
  },
  '23': {
    fr: "La nature recycle tout, même la chaleur.",
    en: "Nature recycles everything, even heat.",
    es: "La naturaleza recicla todo, incluso el calor.",
    de: "Die Natur recycelt alles, sogar Wärme.",
    el: "Η φύση ανακυκλώνει τα πάντα, ακόμα και τη ζέστη.",
    zh: "自然回收一切，包括热量。",
    ja: "自然はすべてをリサイクルする、熱さえも。",
    hi: "प्रकृति सब कुछ पुनर्चक्रित करती है, गर्मी भी।",
    pt: "A natureza recicla tudo, até o calor.",
    ru: "Природа перерабатывает всё, даже тепло.",
  },
  '24': {
    fr: "Construire par amour, pas par obligation.",
    en: "Build with love, not obligation.",
    es: "Construir con amor, no por obligación.",
    de: "Aus Liebe bauen, nicht aus Pflicht.",
    el: "Χτίζε με αγάπη, όχι από υποχρέωση.",
    zh: "因爱而建，而非因义务。",
    ja: "義務ではなく、愛で築く。",
    hi: "प्रेम से निर्माण करें, बाध्यता से नहीं।",
    pt: "Construir com amor, não por obrigação.",
    ru: "Строить с любовью, а не по обязанности.",
  },
  '25': {
    fr: "Protéger l'essentiel suffit.",
    en: "Protecting what's essential is enough.",
    es: "Proteger lo esencial es suficiente.",
    de: "Das Wesentliche zu schützen genügt.",
    el: "Η προστασία του ουσιώδους αρκεί.",
    zh: "保护本质就足够了。",
    ja: "本質を守るだけで十分。",
    hi: "आवश्यक की रक्षा करना पर्याप्त है।",
    pt: "Proteger o essencial basta.",
    ru: "Защитить главное — этого достаточно.",
  },
  '26': {
    fr: "L'individu déclenche le collectif.",
    en: "The individual triggers the collective.",
    es: "El individuo desencadena lo colectivo.",
    de: "Das Individuum löst das Kollektiv aus.",
    el: "Το άτομο πυροδοτεί το συλλογικό.",
    zh: "个体触发集体。",
    ja: "個が集団を動かす。",
    hi: "व्यक्ति सामूहिक को प्रेरित करता है।",
    pt: "O indivíduo desencadeia o coletivo.",
    ru: "Индивид запускает коллектив.",
  },
};

// ---------------------------------------------------------------------------
// Helper: zero-pad an id to 2 digits
// ---------------------------------------------------------------------------
function padId(id) {
  return String(id).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// getGameConfig(id) — returns full config for a game by numeric or string id
// ---------------------------------------------------------------------------
export function getGameConfig(id) {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  const game = GAMES.find((g) => g.id === numericId);
  if (!game) return null;

  const pid = padId(numericId);
  const fact = SCIENCE_FACTS.find((f) => f.gameId === pid) || null;
  const names = GAME_NAMES[pid] || null;
  const lesson = LESSONS[pid] || null;

  return {
    ...game,
    names,
    fact: fact ? fact.fact : null,
    factSource: fact ? fact.source : null,
    lesson,
  };
}

// ---------------------------------------------------------------------------
// getGamesByChapter(chapter) — e.g. 'Ch.1'
// ---------------------------------------------------------------------------
export function getGamesByChapter(chapter) {
  return GAMES.filter((g) => g.chapter === chapter).map((g) => getGameConfig(g.id));
}

// ---------------------------------------------------------------------------
// getGamesByPriority(priority) — e.g. 'P1'
// ---------------------------------------------------------------------------
export function getGamesByPriority(priority) {
  return GAMES.filter((g) => g.priority === priority).map((g) => getGameConfig(g.id));
}

// ---------------------------------------------------------------------------
// getAvailableGames() — returns P1 games only (MVP)
// ---------------------------------------------------------------------------
export function getAvailableGames() {
  return [...getGamesByPriority('P1'), ...getGamesByPriority('P2'), ...getGamesByPriority('P3')];
}
