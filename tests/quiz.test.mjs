import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ } from '../app/js/config.js';
import { createQuiz } from '../app/js/quiz.js';

test('QUIZ follows the agreed 7 questions', () => {
  assert.equal(QUIZ.length, 7);
  assert.deepEqual(QUIZ.map(q => q.answer), [0, 0, 1, 0, 0, 1, 0]);
  assert.match(QUIZ[0].text, /은하 밖/);
  for (const q of QUIZ) {
    assert.equal(q.options.length, 4);
    assert.ok(q.explain.length > 0);
  }
  assert.equal(QUIZ[5].figure, 'shapes');
  assert.equal(QUIZ[5].options[QUIZ[5].answer].shape, 'flat');
  assert.equal(QUIZ[6].figure, 'compare');
  assert.match(QUIZ[6].explain, /8500 pc/);
  assert.match(QUIZ[6].explain, /납작/);
});

test('createQuiz scores only the first choice and needs an answer before next', () => {
  const quiz = createQuiz(QUIZ);
  assert.equal(quiz.index, 0);
  assert.equal(quiz.total, 7);
  assert.equal(quiz.next(), false, 'cannot skip before answering');
  const r = quiz.choose(QUIZ[0].answer);
  assert.deepEqual(r, { correct: true, answer: QUIZ[0].answer, explain: QUIZ[0].explain });
  assert.equal(quiz.choose(1), null, 'second choice ignored');
  assert.equal(quiz.score, 1);
  assert.equal(quiz.answered, true);
  assert.equal(quiz.next(), true);
  assert.equal(quiz.index, 1);
  assert.equal(quiz.current, QUIZ[1]);
});

test('createQuiz finishes after the last question', () => {
  const quiz = createQuiz(QUIZ);
  for (let i = 0; i < 7; i++) {
    quiz.choose(3); // 모두 ④ — 정답 없음
    const moved = quiz.next();
    assert.equal(moved, i < 6);
  }
  assert.equal(quiz.finished, true);
  assert.equal(quiz.score, 0);
});
