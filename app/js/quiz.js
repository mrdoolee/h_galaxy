// 해석 문제 진행 상태: 한 문제씩, 처음 고른 답만 점수에 넣는다.
export function createQuiz(questions) {
  let index = 0;
  let score = 0;
  let answered = false;
  let finished = false;

  return {
    get index() { return index; },
    get total() { return questions.length; },
    get current() { return questions[index]; },
    get answered() { return answered; },
    get score() { return score; },
    get finished() { return finished; },

    /** 보기 i를 고른다. 이미 답했으면 null. */
    choose(i) {
      if (answered || finished) return null;
      answered = true;
      const q = questions[index];
      const correct = i === q.answer;
      if (correct) score++;
      return { correct, answer: q.answer, explain: q.explain };
    },

    /** 다음 문제로. 답하기 전이거나 마지막 문제였으면 false(마지막이면 finished). */
    next() {
      if (!answered || finished) return false;
      if (index === questions.length - 1) { finished = true; return false; }
      index++;
      answered = false;
      return true;
    },
  };
}
