/**
 * LaBibliothequeVivanteScene — Quiz: questions écologie et solidarité.
 * Bonne réponse = livre débloqué, séries = livre doré.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface QuizQuestion {
  question: string;
  correct: string;
  wrong: string[];
}

export class LaBibliothequeVivanteScene extends BaseGameScene {
  private questions: QuizQuestion[] = [
    {
      question: "Combien de litres d'eau faut-il pour produire 1kg de boeuf?",
      correct: '15 000 litres',
      wrong: ['500 litres', '2 000 litres', '8 000 litres'],
    },
    {
      question: 'Quel % des déchets plastiques sont recyclés dans le monde?',
      correct: '9%',
      wrong: ['25%', '50%', '75%'],
    },
    {
      question: "Combien d'espèces disparaissent chaque jour?",
      correct: '150',
      wrong: ['10', '50', '500'],
    },
    {
      question: "Quelle est la durée de vie d'un sac plastique dans la nature?",
      correct: '450 ans',
      wrong: ['10 ans', '50 ans', '100 ans'],
    },
    {
      question: "Quel % de l'eau sur Terre est de l'eau douce accessible?",
      correct: '0,5%',
      wrong: ['5%', '15%', '30%'],
    },
  ];

  private currentIndex: number = 0;
  private consecutiveCorrect: number = 0;
  private booksUnlocked: number = 0;
  private questionText!: Phaser.GameObjects.Text;
  private answerButtons: Phaser.GameObjects.Container[] = [];
  private feedbackText!: Phaser.GameObjects.Text;
  private bookShelf: Phaser.GameObjects.Rectangle[] = [];
  private bookLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('GameScene_la-bibliotheque-vivante');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Book shelf at top
    this.add.text(width / 2, height * 0.05, 'Bibliothèque Vivante', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    for (let i = 0; i < this.questions.length; i++) {
      const bx = width * 0.15 + i * (width * 0.7 / this.questions.length);
      const book = this.add.rectangle(bx, height * 0.12, 30, 45, 0x555555);
      book.setStrokeStyle(1, 0x888888);
      this.bookShelf.push(book);
      const lbl = this.add.text(bx, height * 0.12, '📕', { fontSize: '14px' }).setOrigin(0.5).setAlpha(0.3);
      this.bookLabels.push(lbl);
    }

    // Question text
    this.questionText = this.add.text(width / 2, height * 0.28, '', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'Arial', align: 'center',
      wordWrap: { width: width * 0.85 },
    }).setOrigin(0.5);

    // Feedback text
    this.feedbackText = this.add.text(width / 2, height * 0.85, '', {
      fontSize: '18px', color: '#88ff88', fontFamily: 'Arial', align: 'center',
      wordWrap: { width: width * 0.85 },
    }).setOrigin(0.5);

    this.showQuestion();
  }

  private showQuestion(): void {
    if (this.currentIndex >= this.questions.length) {
      this.finishQuiz();
      return;
    }

    const { width, height } = this.scale;
    const q = this.questions[this.currentIndex];
    this.questionText.setText(`Q${this.currentIndex + 1}: ${q.question}`);
    this.feedbackText.setText('');

    // Clear old buttons
    this.answerButtons.forEach(b => b.destroy());
    this.answerButtons = [];

    // Shuffle answers
    const answers = [q.correct, ...q.wrong];
    Phaser.Utils.Array.Shuffle(answers);

    const startY = height * 0.42;
    const btnH = 55;
    const gap = 10;

    for (let i = 0; i < answers.length; i++) {
      const y = startY + i * (btnH + gap);
      const bg = this.add.rectangle(width / 2, y, width * 0.8, btnH, 0x334455);
      bg.setStrokeStyle(2, 0x5588aa);
      bg.setInteractive();

      const txt = this.add.text(width / 2, y, answers[i], {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial',
      }).setOrigin(0.5);

      const container = this.add.container(0, 0, [bg, txt]);
      this.answerButtons.push(container);

      const answer = answers[i];
      bg.on('pointerdown', () => {
        this.handleAnswer(answer, q.correct);
      });
    }
  }

  private handleAnswer(selected: string, correct: string): void {
    const scoring = this.jeu.scoring;

    // Disable all buttons
    this.answerButtons.forEach(b => {
      const bg = b.list[0] as Phaser.GameObjects.Rectangle;
      bg.removeAllListeners();
    });

    if (selected === correct) {
      // Règle: Bonne réponse = débloquer un livre (+scoring.bonne_reponse pts)
      GameState.addScore(scoring.bonne_reponse);
      this.consecutiveCorrect++;
      this.booksUnlocked++;

      // Update book shelf
      if (this.currentIndex < this.bookShelf.length) {
        const isGolden = this.consecutiveCorrect >= 3;
        this.bookShelf[this.currentIndex].setFillStyle(isGolden ? 0xffd700 : 0x228B22);
        this.bookLabels[this.currentIndex].setText(isGolden ? '📙' : '📗').setAlpha(1);
      }

      // Règle: 3 bonnes réponses consécutives = livre doré (+scoring.livre_dore pts, +10 solidarité)
      if (this.consecutiveCorrect >= 3) {
        GameState.addScore(scoring.livre_dore);
        GameState.addSolidarite(10);
        // Règle: Série de 3 bonus
        GameState.addScore(scoring.serie_3);
        this.consecutiveCorrect = 0; // Reset streak
        this.feedbackText.setText('Correct ! Livre doré débloqué !').setColor('#ffd700');
      } else {
        this.feedbackText.setText('Correct !').setColor('#88ff88');
      }
    } else {
      // Règle: Mauvaise réponse = explication pédagogique (pas de malus)
      this.consecutiveCorrect = 0;
      this.feedbackText.setText(`La bonne réponse était : ${correct}`).setColor('#ff8888');
    }

    // Next question after delay
    this.time.delayedCall(2000, () => {
      this.currentIndex++;
      this.showQuestion();
    });
  }

  // Règle: Partager un livre avec un autre joueur = +solidarité
  private finishQuiz(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    this.questionText.setText('Quiz terminé !');
    this.answerButtons.forEach(b => b.destroy());
    this.answerButtons = [];

    // Share button for solidarity
    const shareBtn = this.add.rectangle(width / 2, height * 0.5, 200, 50, 0x4488cc);
    shareBtn.setInteractive();
    const shareTxt = this.add.text(width / 2, height * 0.5, 'Partager un livre', {
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    shareBtn.on('pointerdown', () => {
      GameState.addScore(scoring.partage);
      GameState.addSolidarite(5);
      this.feedbackText.setText('Livre partagé ! +solidarité').setColor('#88ff88');
      shareBtn.removeAllListeners();
      shareBtn.setFillStyle(0x336699);

      this.time.delayedCall(1500, () => {
        GameState.triggerGameOver();
      });
    });

    this.time.delayedCall(5000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
  }
}

registerScene('la-bibliotheque-vivante', LaBibliothequeVivanteScene);
