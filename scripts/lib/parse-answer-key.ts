import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CIRCLED_DIGIT_TO_LABEL: Record<string, string> = {
  "①": "1",
  "②": "2",
  "③": "3",
  "④": "4",
};

// PDF가 2단 컬럼이라, 그리드 뒤쪽(71-100번)은 왼쪽 컬럼에 남은 해설 텍스트가
// 같은 줄 앞부분에 붙어 나오는 경우가 있다. 그래서 "줄 전체"가 아니라
// "줄 끝에 오는 10개 숫자/원문자 묶음"만 느슨하게 매칭한다.
const HEADER_LINE = /(\d{1,3}(?:\s+\d{1,3}){9})\s*$/;
const ANSWER_LINE = /([①②③④](?:\s+[①②③④]){9})\s*$/;

// PDF 맨 끝에 있는 "1~100번 정답 그리드"(10문항 번호 줄 + 원문자 정답 줄이 10번
// 반복)를 pdftotext로 읽어서 { 문항번호: "1"|"2"|"3"|"4" } 맵으로 변환한다.
export async function extractAnswerKey(pdfPath: string): Promise<Map<number, string>> {
  const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
    maxBuffer: 1024 * 1024 * 20,
  });
  const lines = stdout.split("\n");

  const answerKey = new Map<number, string>();
  // 헤더 줄과 정답 줄 사이에, 왼쪽 컬럼에 남은 무관한 줄(해설작성자 표시, 다음
  // 문제 지문 등)이 끼어드는 경우가 있어서 바로 다음 줄만 보지 않고 몇 줄 안에서
  // 정답 줄을 찾는다.
  const LOOKAHEAD = 4;

  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i].match(HEADER_LINE);
    if (!headerMatch) continue;

    let answerMatch: RegExpMatchArray | null = null;
    for (let j = i + 1; j < Math.min(i + 1 + LOOKAHEAD, lines.length); j++) {
      answerMatch = lines[j].match(ANSWER_LINE);
      if (answerMatch) break;
    }
    if (!answerMatch) continue;

    const numbers = headerMatch[1].trim().split(/\s+/).map(Number);
    const symbols = answerMatch[1].trim().split(/\s+/);
    if (numbers.length !== 10 || symbols.length !== 10) continue;

    for (let j = 0; j < 10; j++) {
      answerKey.set(numbers[j], CIRCLED_DIGIT_TO_LABEL[symbols[j]]);
    }
  }

  return answerKey;
}
